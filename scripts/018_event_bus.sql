-- Phase 2 · Event bus (durable outbox)
--
-- Deliberately NOT a message queue. A queue is infrastructure to run, monitor
-- and pay for; at this stage a table plus a worker gives the same guarantees
-- (durability, retry, dead-lettering, replay) with nothing new to operate.
-- Swap in a real queue when throughput demands it — the handler interface
-- doesn't change.

create table if not exists public.platform_events (
  id bigserial primary key,
  user_id uuid references auth.users(id) on delete cascade,
  event_type text not null,
    -- learning.evidence_recorded | learning.session_completed
    -- assessment.requested | curriculum.requested
    -- scores.refresh_requested
  payload jsonb not null default '{}',
  -- Collapses duplicate work: several exam answers in one submission should
  -- trigger ONE assessment run, not twenty.
  dedupe_key text,
  status text not null default 'pending',   -- pending | processing | done | failed
  attempts int not null default 0,
  max_attempts int not null default 3,
  last_error text,
  run_after timestamptz not null default now(),   -- backoff / debounce
  locked_at timestamptz,
  locked_by text,
  created_at timestamptz not null default now(),
  processed_at timestamptz
);

create index if not exists platform_events_claim_idx
  on public.platform_events (status, run_after)
  where status = 'pending';
create index if not exists platform_events_user_idx
  on public.platform_events (user_id, created_at desc);

-- One pending event per dedupe key. Repeated emissions push the run time out
-- instead of piling up — debounce, not drop.
create unique index if not exists platform_events_dedupe_idx
  on public.platform_events (dedupe_key)
  where status = 'pending' and dedupe_key is not null;

alter table public.platform_events enable row level security;
-- No client policies: the event log is server-side only.

-- ── Emit ────────────────────────────────────────────────────────────────────
create or replace function public.emit_event(
  p_event_type text,
  p_user_id    uuid  default null,
  p_payload    jsonb default '{}'::jsonb,
  p_dedupe_key text  default null,
  p_delay_seconds int default 0
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id bigint;
begin
  insert into public.platform_events (event_type, user_id, payload, dedupe_key, run_after)
  values (p_event_type, p_user_id, coalesce(p_payload, '{}'::jsonb), p_dedupe_key,
          now() + make_interval(secs => p_delay_seconds))
  on conflict (dedupe_key) where status = 'pending' and dedupe_key is not null
  do update set
    -- Debounce: keep one event, push its run time out, merge the payload.
    run_after = now() + make_interval(secs => p_delay_seconds),
    payload   = public.platform_events.payload || excluded.payload
  returning id into v_id;

  return v_id;
end;
$$;

-- ── Claim ───────────────────────────────────────────────────────────────────
-- SKIP LOCKED means several workers can run concurrently without processing the
-- same event twice.
create or replace function public.claim_events(
  p_worker_id text,
  p_limit     int default 10
)
returns setof public.platform_events
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  with claimed as (
    select id from public.platform_events
    where status = 'pending' and run_after <= now()
    order by run_after
    limit p_limit
    for update skip locked
  )
  update public.platform_events e
  set status = 'processing', locked_at = now(), locked_by = p_worker_id,
      attempts = e.attempts + 1
  from claimed c
  where e.id = c.id
  returning e.*;
end;
$$;

-- ── Complete / fail ─────────────────────────────────────────────────────────
create or replace function public.complete_event(p_id bigint)
returns void language sql security definer set search_path = public as $$
  update public.platform_events
  set status = 'done', processed_at = now(), locked_at = null, last_error = null
  where id = p_id;
$$;

create or replace function public.fail_event(p_id bigint, p_error text)
returns void
language plpgsql security definer set search_path = public as $$
declare v_attempts int; v_max int;
begin
  select attempts, max_attempts into v_attempts, v_max
  from public.platform_events where id = p_id;

  if v_attempts >= v_max then
    -- Dead-letter: keep the row so failures are inspectable, never silent.
    update public.platform_events
    set status = 'failed', last_error = p_error, locked_at = null, processed_at = now()
    where id = p_id;
  else
    -- Exponential backoff: 30s, 120s, 270s...
    update public.platform_events
    set status = 'pending', last_error = p_error, locked_at = null,
        run_after = now() + make_interval(secs => 30 * (v_attempts * v_attempts))
    where id = p_id;
  end if;
end;
$$;

-- ── Recover stuck events ────────────────────────────────────────────────────
-- A worker that crashes mid-run leaves rows in 'processing' forever.
create or replace function public.requeue_stale_events(p_stale_minutes int default 10)
returns int
language plpgsql security definer set search_path = public as $$
declare v_count int;
begin
  update public.platform_events
  set status = 'pending', locked_at = null, locked_by = null
  where status = 'processing'
    and locked_at < now() - make_interval(mins => p_stale_minutes);
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

create or replace view public.event_queue_health as
select event_type, status, count(*) as count,
       min(created_at) as oldest, max(attempts) as max_attempts
from public.platform_events
group by event_type, status;

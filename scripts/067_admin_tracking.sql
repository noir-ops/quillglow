-- ═══════════════════════════════════════════════════════════════════════════
-- 067 — Admin tracking & counters
--
-- Supabase returns at most 1,000 rows per query. Many admin pages fetched
-- rows and counted them in the browser, so every figure above 1,000 was
-- silently wrong: User Emails showed 1,000 of 23k learners (and "email all
-- users" reached ~1,000), engagement could never exceed ~4%, growth charts
-- dropped months, syllabus adoption topped out at 1,000, AI cost totals
-- were understated. These functions count and page INSIDE the database,
-- so every number is exact at any size.
--
-- All functions are SECURITY DEFINER and callable only by the service role
-- (the admin panel's server code). Safe to re-run.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Contact tickets: threading columns, status list, reopen on reply ───────
-- These columns are written by the apps but were added by hand, never in a
-- migration; "if not exists" makes this correct either way.
alter table public.contact_messages
  add column if not exists thread_id        uuid,
  add column if not exists parent_id        uuid,
  add column if not exists is_admin_reply   boolean not null default false,
  add column if not exists sent_via_email   boolean not null default false,
  add column if not exists email_message_id text;

create index if not exists contact_messages_parent_idx  on public.contact_messages (parent_id);
create index if not exists contact_messages_thread_idx  on public.contact_messages (thread_id);
create index if not exists contact_messages_created_idx on public.contact_messages (created_at desc);

-- One status list for everything that writes tickets. The original table
-- allowed only open/in_progress/resolved/closed, yet the admin panel sets
-- 'pending' and counts 'replied'. NOT VALID: existing rows are not
-- re-checked, so this can't fail on whatever is already stored.
alter table public.contact_messages drop constraint if exists contact_messages_status_check;
alter table public.contact_messages add constraint contact_messages_status_check
  check (status in ('open', 'pending', 'in_progress', 'replied', 'resolved', 'closed')) not valid;

-- A ticket is a ROOT row; replies (admin, learner follow-ups, email replies)
-- are child rows on the same thread and must not be counted as tickets.
create or replace function public.contact_is_root(m public.contact_messages)
returns boolean language sql immutable as $$
  select m.parent_id is null and (m.thread_id is null or m.thread_id = m.id)
$$;

-- When a LEARNER replies (support page or by email), reopen the ticket so it
-- shows as needing attention. Before this, a ticket marked replied/resolved
-- stayed that way after the learner answered, and nobody saw it.
create or replace function public.reopen_ticket_on_learner_reply()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_root uuid := coalesce(new.thread_id, new.parent_id);
begin
  if not coalesce(new.is_admin_reply, false) and new.parent_id is not null and v_root is not null and v_root <> new.id then
    update public.contact_messages
       set status = 'open', updated_at = now()
     where id = v_root and status <> 'open';
  end if;
  return new;
end;
$$;
drop trigger if exists trg_reopen_ticket_on_learner_reply on public.contact_messages;
create trigger trg_reopen_ticket_on_learner_reply
after insert on public.contact_messages
for each row execute function public.reopen_ticket_on_learner_reply();

-- ── Tickets list + stats ────────────────────────────────────────────────────
-- Buckets: all | open (new or awaiting an admin — 'open' and legacy
-- 'pending') | in_progress | replied (awaiting the learner) | resolved | closed
create or replace function public.admin_list_tickets(
  p_search text default null, p_bucket text default 'all', p_limit int default 25, p_offset int default 0
)
returns table (
  id uuid, ticket_number text, name text, email text, subject text, message text, status text,
  created_at timestamptz, message_count bigint, last_activity_at timestamptz, last_from_learner boolean,
  total_count bigint
)
language sql stable security definer set search_path = public as $$
  with roots as (
    select m.* from public.contact_messages m
    where public.contact_is_root(m)
      and (p_bucket is null or p_bucket = 'all'
           or (p_bucket = 'open' and m.status in ('open', 'pending'))
           or m.status = p_bucket)
      and (coalesce(p_search, '') = ''
           or m.name ilike '%' || p_search || '%' or m.email ilike '%' || p_search || '%'
           or m.subject ilike '%' || p_search || '%' or m.ticket_number ilike '%' || p_search || '%'
           or m.message ilike '%' || p_search || '%')
  ),
  threads as (
    select r.id as root_id,
           count(c.id) as replies,
           max(c.created_at) as last_reply_at,
           (array_agg(c.is_admin_reply order by c.created_at desc))[1] as last_is_admin
    from roots r
    left join public.contact_messages c on c.thread_id = r.id and c.id <> r.id
    group by r.id
  )
  select r.id, r.ticket_number, r.name, r.email, r.subject, r.message, r.status, r.created_at,
         1 + coalesce(t.replies, 0),
         greatest(r.created_at, coalesce(t.last_reply_at, r.created_at)),
         coalesce(not t.last_is_admin, true),
         count(*) over ()
  from roots r left join threads t on t.root_id = r.id
  order by greatest(r.created_at, coalesce(t.last_reply_at, r.created_at)) desc
  limit greatest(p_limit, 1) offset greatest(p_offset, 0)
$$;

create or replace function public.admin_ticket_stats()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'total',        count(*),
    'open',         count(*) filter (where status in ('open', 'pending')),
    'in_progress',  count(*) filter (where status = 'in_progress'),
    'replied',      count(*) filter (where status = 'replied'),
    'resolved',     count(*) filter (where status = 'resolved'),
    'closed',       count(*) filter (where status = 'closed'),
    'new_today',    count(*) filter (where created_at >= date_trunc('day', now())),
    'new_30d',      count(*) filter (where created_at >= now() - interval '30 days'),
    'new_prev_30d', count(*) filter (where created_at >= now() - interval '60 days' and created_at < now() - interval '30 days'),
    'oldest_open_at', min(created_at) filter (where status in ('open', 'pending'))
  )
  from public.contact_messages m
  where public.contact_is_root(m)
$$;

-- ── Users with emails (User Emails page) ────────────────────────────────────
create or replace function public.admin_list_user_emails(
  p_search text default null, p_limit int default 25, p_offset int default 0
)
returns table (id uuid, display_name text, email text, created_at timestamptz, last_sign_in_at timestamptz, total_count bigint)
language sql stable security definer set search_path = public, auth as $$
  select u.id, p.display_name, u.email::text, coalesce(p.created_at, u.created_at), u.last_sign_in_at, count(*) over ()
  from auth.users u
  left join public.profiles p on p.id = u.id
  where u.email is not null and u.email <> ''
    and (coalesce(p_search, '') = '' or u.email ilike '%' || p_search || '%' or p.display_name ilike '%' || p_search || '%')
  order by coalesce(p.created_at, u.created_at) desc
  limit greatest(p_limit, 1) offset greatest(p_offset, 0)
$$;

-- Every matching email, as ONE array value — a single row, so the 1,000-row
-- limit can't cut it short ("email all users" previously reached ~1,000).
create or replace function public.admin_all_user_emails(p_search text default null)
returns text[]
language sql stable security definer set search_path = public, auth as $$
  select coalesce(array_agg(distinct lower(u.email::text)), '{}')
  from auth.users u
  left join public.profiles p on p.id = u.id
  where u.email is not null and u.email <> ''
    and (coalesce(p_search, '') = '' or u.email ilike '%' || p_search || '%' or p.display_name ilike '%' || p_search || '%')
$$;

-- ── Dashboard ───────────────────────────────────────────────────────────────
-- "Paying Genius" uses user_plan() (scripts/066), the one Genius rule —
-- previously "active subscriptions" counted every free learner's
-- auto-created Scholar row (status 'active').
-- "Active learners" = signed in within the window (auth.users), not a
-- profile's updated_at (which changes when a profile is edited).
create or replace function public.admin_dashboard_stats()
returns jsonb language sql stable security definer set search_path = public, auth as $$
  select jsonb_build_object(
    'users_total',        (select count(*) from public.profiles),
    'users_new_30d',      (select count(*) from public.profiles where created_at >= now() - interval '30 days'),
    'users_new_prev_30d', (select count(*) from public.profiles where created_at >= now() - interval '60 days' and created_at < now() - interval '30 days'),
    'active_7d',          (select count(*) from auth.users where last_sign_in_at >= now() - interval '7 days'),
    'active_30d',         (select count(*) from auth.users where last_sign_in_at >= now() - interval '30 days'),
    'genius_paying',      (select count(*) from public.subscriptions s where s.plan_type = 'genius' and public.user_plan(s.user_id) = 'genius'),
    'genius_new_30d',     (select count(*) from public.subscriptions s where s.plan_type = 'genius' and s.created_at >= now() - interval '30 days' and public.user_plan(s.user_id) = 'genius'),
    'genius_new_prev_30d',(select count(*) from public.subscriptions s where s.plan_type = 'genius' and s.created_at >= now() - interval '60 days' and s.created_at < now() - interval '30 days'),
    'tickets',            public.admin_ticket_stats(),
    'signups_by_month', (
      select coalesce(jsonb_agg(jsonb_build_object('month', to_char(m, 'YYYY-MM'), 'count', coalesce(c.n, 0)) order by m), '[]')
      from generate_series(date_trunc('month', now()) - interval '11 months', date_trunc('month', now()), interval '1 month') m
      left join (select date_trunc('month', created_at) mo, count(*) n from public.profiles
                 where created_at >= date_trunc('month', now()) - interval '11 months' group by 1) c on c.mo = m
    ),
    'signups_by_day', (
      select coalesce(jsonb_agg(jsonb_build_object('day', to_char(d, 'YYYY-MM-DD'), 'count', coalesce(c.n, 0)) order by d), '[]')
      from generate_series(date_trunc('day', now()) - interval '6 days', date_trunc('day', now()), interval '1 day') d
      left join (select date_trunc('day', created_at) dy, count(*) n from public.profiles
                 where created_at >= date_trunc('day', now()) - interval '6 days' group by 1) c on c.dy = d
    )
  )
$$;

-- ── Subscriptions ───────────────────────────────────────────────────────────
create or replace function public.admin_subscription_stats()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'rows_total',     count(*),
    'scholar_rows',   count(*) filter (where plan_type <> 'genius'),
    'genius_paying',  count(*) filter (where plan_type = 'genius' and public.user_plan(user_id) = 'genius'),
    'by_status', (
      select coalesce(jsonb_object_agg(status, n), '{}')
      from (select status, count(*) n from public.subscriptions where plan_type = 'genius' group by status) x
    )
  )
  from public.subscriptions
$$;

-- p_filter: all | genius (paying) | scholar | <a status> (among Genius rows)
create or replace function public.admin_list_subscriptions(
  p_search text default null, p_filter text default 'all', p_limit int default 25, p_offset int default 0
)
returns table (
  id uuid, user_id uuid, plan_type text, status text, current_period_start timestamptz, current_period_end timestamptz,
  cancel_at_period_end boolean, created_at timestamptz, polar_customer_id text, polar_subscription_id text,
  display_name text, avatar_url text, email text, effective_plan text, total_count bigint
)
language sql stable security definer set search_path = public, auth as $$
  select s.id, s.user_id, s.plan_type, s.status, s.current_period_start, s.current_period_end,
         coalesce(s.cancel_at_period_end, false), s.created_at, s.polar_customer_id, s.polar_subscription_id,
         p.display_name, p.avatar_url, u.email::text, public.user_plan(s.user_id), count(*) over ()
  from public.subscriptions s
  left join public.profiles p on p.id = s.user_id
  left join auth.users u on u.id = s.user_id
  where (p_filter is null or p_filter = 'all'
         or (p_filter = 'genius' and s.plan_type = 'genius' and public.user_plan(s.user_id) = 'genius')
         or (p_filter = 'scholar' and s.plan_type <> 'genius')
         or (s.plan_type = 'genius' and s.status = p_filter))
    and (coalesce(p_search, '') = ''
         or u.email ilike '%' || p_search || '%' or p.display_name ilike '%' || p_search || '%'
         or s.polar_customer_id ilike '%' || p_search || '%' or s.polar_subscription_id ilike '%' || p_search || '%')
  order by s.created_at desc
  limit greatest(p_limit, 1) offset greatest(p_offset, 0)
$$;

-- ── Curriculum: learner adoption per syllabus and per subject ──────────────
create or replace function public.admin_syllabus_adoption()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'learners_total', (select count(*) from public.profiles),
    'with_selection', (select count(*) from public.profiles where primary_syllabus is not null or secondary_syllabus is not null),
    'by_syllabus', (
      select coalesce(jsonb_agg(jsonb_build_object('syllabus', syllabus, 'primary', prim, 'secondary', sec)), '[]')
      from (
        select syllabus, sum(prim) prim, sum(sec) sec from (
          select primary_syllabus syllabus, 1 prim, 0 sec from public.profiles where primary_syllabus is not null
          union all
          select secondary_syllabus, 0, 1 from public.profiles where secondary_syllabus is not null
        ) t group by syllabus
      ) x
    ),
    'by_subject', (
      select coalesce(jsonb_agg(jsonb_build_object('syllabus', syllabus, 'subject', subject, 'learners', n)), '[]')
      from (select syllabus, subject, count(distinct user_id) n from public.learner_subjects group by 1, 2) y
    )
  )
$$;

-- ── AI usage totals ─────────────────────────────────────────────────────────
drop function if exists public.admin_ai_usage_summary();
-- p_days: only calls in the last N days (null = all time), so the per-feature
-- table matches the 7/30/90-day window the page's header shows.
create or replace function public.admin_ai_usage_summary(p_days int default null)
returns jsonb language sql stable security definer set search_path = public as $$
  with w as (
    select * from public.ai_usage_log
    where p_days is null or created_at >= now() - make_interval(days => p_days)
  )
  select jsonb_build_object(
    'totals', (select jsonb_build_object(
        'calls', count(*), 'cost', coalesce(sum(estimated_cost), 0),
        'input_tokens', coalesce(sum(input_tokens), 0), 'output_tokens', coalesce(sum(output_tokens), 0),
        'cache_hits', count(*) filter (where cache_hit), 'failures', count(*) filter (where not success))
      from w),
    'by_task', (
      select coalesce(jsonb_agg(jsonb_build_object('task', task, 'calls', calls, 'cost', cost, 'cache_hits', hits, 'failures', fails) order by cost desc), '[]')
      from (select coalesce(task, 'unknown') task, count(*) calls, coalesce(sum(estimated_cost), 0) cost,
                   count(*) filter (where cache_hit) hits, count(*) filter (where not success) fails
            from w group by 1) t
    ),
    'by_model', (
      select coalesce(jsonb_agg(jsonb_build_object('provider', provider, 'model', model, 'calls', calls, 'cost', cost,
                                                   'input_tokens', it, 'output_tokens', ot) order by cost desc), '[]')
      from (select provider, model, count(*) calls, coalesce(sum(estimated_cost), 0) cost,
                   coalesce(sum(input_tokens), 0) it, coalesce(sum(output_tokens), 0) ot
            from w group by provider, model) m
    )
  )
$$;

-- ── Audit log action counts ────────────────────────────────────────────────
create or replace function public.admin_audit_action_counts()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'total', (select count(*) from public.audit_log),
    'by_action', (select coalesce(jsonb_agg(jsonb_build_object('action', action, 'count', n) order by n desc), '[]')
                  from (select action, count(*) n from public.audit_log group by action) a)
  )
$$;

-- ── Grants: service role only ───────────────────────────────────────────────
do $$
declare f text;
begin
  foreach f in array array[
    'public.admin_list_tickets(text, text, int, int)', 'public.admin_ticket_stats()',
    'public.admin_list_user_emails(text, int, int)', 'public.admin_all_user_emails(text)',
    'public.admin_dashboard_stats()', 'public.admin_subscription_stats()',
    'public.admin_list_subscriptions(text, text, int, int)', 'public.admin_syllabus_adoption()',
    'public.admin_ai_usage_summary(int)', 'public.admin_audit_action_counts()',
    'public.reopen_ticket_on_learner_reply()'
  ] loop
    execute format('revoke execute on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end $$;

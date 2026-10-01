-- Milestone 3 · AI Gateway: usage tracking, cost control, caching
--
-- Spec §26 requires every AI request to record user, task, agent, provider,
-- model, input/output tokens, latency, estimated cost and success/failure —
-- so that AI Cost Per Active User becomes measurable.
--
-- Spec §27 requires identical requests not to hit a model twice.

-- ── Per-request usage log ───────────────────────────────────────────────────
create table if not exists public.ai_usage_log (
  id bigserial primary key,
  user_id uuid references auth.users(id) on delete set null,
  task text not null,                 -- AITask: tutoring | classification | ...
  agent text,                         -- study_ai | sprout_ai | unified_core
  provider text not null,             -- groq | reasoning | long_context | ...
  model text not null,
  input_tokens int not null default 0,
  output_tokens int not null default 0,
  latency_ms int not null default 0,
  estimated_cost numeric(12,6) not null default 0,
  success boolean not null default true,
  error text,
  cache_hit boolean not null default false,
  fallback_depth int not null default 0,   -- 0 = primary route succeeded
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists ai_usage_user_time_idx on public.ai_usage_log (user_id, created_at desc);
create index if not exists ai_usage_task_idx on public.ai_usage_log (task, created_at desc);
create index if not exists ai_usage_time_idx on public.ai_usage_log (created_at desc);
create index if not exists ai_usage_provider_idx on public.ai_usage_log (provider, model);

alter table public.ai_usage_log enable row level security;
-- Server-side writes only; no client policies.

-- ── Model pricing (so cost isn't hard-coded in application code) ────────────
create table if not exists public.ai_model_pricing (
  provider text not null,
  model text not null,
  input_cost_per_1m numeric(12,4) not null default 0,
  output_cost_per_1m numeric(12,4) not null default 0,
  updated_at timestamptz not null default now(),
  primary key (provider, model)
);

alter table public.ai_model_pricing enable row level security;

drop policy if exists "pricing readable" on public.ai_model_pricing;
create policy "pricing readable" on public.ai_model_pricing
  for select to authenticated using (true);

insert into public.ai_model_pricing (provider, model, input_cost_per_1m, output_cost_per_1m) values
  ('groq',         'llama-3.3-70b-versatile', 0.59,  0.79),
  ('fast',         'gpt-4.1-mini',            0.40,  1.60),
  ('fast',         'gemini-2.5-flash',        0.30,  2.50),
  ('reasoning',    'gpt-5.4-mini',            0.375, 2.25),
  ('reasoning',    'gpt-4.1',                 2.00,  8.00),
  ('long_context', 'gemini-2.5-pro',          1.25, 10.00),
  ('long_context', 'gpt-4.1',                 2.00,  8.00),
  ('embedding',    'text-embedding-3-small',  0.02,  0.00)
on conflict (provider, model) do nothing;

-- ── Response cache (spec §27) ───────────────────────────────────────────────
create table if not exists public.ai_response_cache (
  cache_key text primary key,          -- hash of task + normalized prompt + model
  task text not null,
  provider text not null,
  model text not null,
  response text not null,
  input_tokens int not null default 0,
  output_tokens int not null default 0,
  hit_count int not null default 0,
  created_at timestamptz not null default now(),
  last_hit_at timestamptz,
  expires_at timestamptz not null
);

create index if not exists ai_cache_expiry_idx on public.ai_response_cache (expires_at);

alter table public.ai_response_cache enable row level security;
-- Server-side only. Caching user-specific content across users would leak data;
-- the gateway only caches tasks explicitly marked cacheable and never caches
-- anything built from student memory or private uploads.

create or replace function public.get_cached_ai_response(p_cache_key text)
returns table (response text, provider text, model text, input_tokens int, output_tokens int)
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.ai_response_cache c
  set hit_count = c.hit_count + 1, last_hit_at = now()
  where c.cache_key = p_cache_key and c.expires_at > now();

  return query
  select c.response, c.provider, c.model, c.input_tokens, c.output_tokens
  from public.ai_response_cache c
  where c.cache_key = p_cache_key and c.expires_at > now();
end;
$$;

create or replace function public.purge_expired_ai_cache()
returns int
language plpgsql security definer set search_path = public as $$
declare v int;
begin
  delete from public.ai_response_cache where expires_at < now();
  get diagnostics v = row_count;
  return v;
end;
$$;

-- ── Cost reporting (spec §26: AI Cost / MAU) ────────────────────────────────
create or replace view public.ai_cost_daily as
select
  date_trunc('day', created_at)::date as day,
  task,
  provider,
  model,
  count(*) as requests,
  count(*) filter (where cache_hit) as cache_hits,
  count(*) filter (where not success) as failures,
  sum(input_tokens) as input_tokens,
  sum(output_tokens) as output_tokens,
  round(sum(estimated_cost), 4) as cost,
  round(avg(latency_ms)) as avg_latency_ms
from public.ai_usage_log
group by 1, 2, 3, 4;

create or replace function public.ai_cost_per_active_user(p_days int default 30)
returns table (
  period_days int,
  total_cost numeric,
  active_users int,
  cost_per_active_user numeric,
  total_requests int,
  cache_hit_rate numeric
)
language sql stable security definer set search_path = public as $$
  select
    p_days,
    round(coalesce(sum(estimated_cost), 0), 4),
    count(distinct user_id)::int,
    round(
      coalesce(sum(estimated_cost), 0) / nullif(count(distinct user_id), 0), 4
    ),
    count(*)::int,
    round(
      count(*) filter (where cache_hit)::numeric / nullif(count(*), 0) * 100, 2
    )
  from public.ai_usage_log
  where created_at >= now() - make_interval(days => p_days);
$$;

-- ── Record a request ────────────────────────────────────────────────────────
create or replace function public.record_ai_usage(
  p_user_id uuid,
  p_task text,
  p_agent text,
  p_provider text,
  p_model text,
  p_input_tokens int,
  p_output_tokens int,
  p_latency_ms int,
  p_success boolean default true,
  p_error text default null,
  p_cache_hit boolean default false,
  p_fallback_depth int default 0,
  p_metadata jsonb default '{}'::jsonb
)
returns bigint
language plpgsql security definer set search_path = public as $$
declare
  v_in  numeric := 0;
  v_out numeric := 0;
  v_cost numeric := 0;
  v_id bigint;
begin
  -- Price from the table, not from application code, so a price change is a
  -- SQL update rather than a deploy.
  select input_cost_per_1m, output_cost_per_1m into v_in, v_out
  from public.ai_model_pricing
  where provider = p_provider and model = p_model;

  v_cost := (coalesce(p_input_tokens, 0) / 1000000.0) * coalesce(v_in, 0)
          + (coalesce(p_output_tokens, 0) / 1000000.0) * coalesce(v_out, 0);

  insert into public.ai_usage_log (
    user_id, task, agent, provider, model, input_tokens, output_tokens,
    latency_ms, estimated_cost, success, error, cache_hit, fallback_depth, metadata
  ) values (
    p_user_id, p_task, p_agent, p_provider, p_model,
    coalesce(p_input_tokens, 0), coalesce(p_output_tokens, 0),
    coalesce(p_latency_ms, 0), v_cost, p_success, p_error,
    p_cache_hit, p_fallback_depth, coalesce(p_metadata, '{}'::jsonb)
  )
  returning id into v_id;

  return v_id;
end;
$$;

grant execute on function public.ai_cost_per_active_user(int) to authenticated;

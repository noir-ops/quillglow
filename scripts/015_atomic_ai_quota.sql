-- Phase 0 · Step 3 — Atomic AI quota enforcement
--
-- Problems with the existing setup:
--   1. `incrementUsage()` does SELECT-then-UPDATE in application code. Two
--      concurrent AI requests both read the same count and both write count+1,
--      so one request is free. Under load, quota silently leaks.
--   2. Nothing ever *checks* the count. Usage is recorded, never enforced.
--   3. `usage_tracking` has an UPDATE policy for `authenticated`, so a user with
--      their anon key could rewrite their own counters.
--
-- This migration fixes all three: one atomic function does check-and-increment
-- inside a single statement, and it is SECURITY DEFINER so counters are only
-- writable through it.

-- ── Per-feature granularity ─────────────────────────────────────────────────
-- Keep the existing aggregate columns (nothing reading them breaks), and add a
-- per-feature breakdown so you can see which feature is burning the budget.
alter table public.usage_tracking
  add column if not exists feature_usage jsonb not null default '{}'::jsonb;

-- ── Plan limits ─────────────────────────────────────────────────────────────
create table if not exists public.plan_limits (
  plan_type text not null,
  feature   text not null,
  monthly_limit int not null,   -- -1 = unlimited
  primary key (plan_type, feature)
);

alter table public.plan_limits enable row level security;

create policy "plan limits are readable by everyone"
  on public.plan_limits for select to authenticated using (true);

-- Defaults. Tune these; 'ai_total' is the umbrella cap across all AI features.
insert into public.plan_limits (plan_type, feature, monthly_limit) values
  ('scholar', 'ai_total',        100),
  ('scholar', 'mock_exam',        10),
  ('scholar', 'essay',            10),
  ('scholar', 'study_agent',       5),
  ('scholar', 'audio_overview',    3),
  ('scholar', 'tutor_chat',       50),
  ('genius',  'ai_total',         -1),
  ('genius',  'mock_exam',        -1),
  ('genius',  'essay',            -1),
  ('genius',  'study_agent',      -1),
  ('genius',  'audio_overview',   -1),
  ('genius',  'tutor_chat',       -1)
on conflict (plan_type, feature) do nothing;

-- ── Atomic check-and-consume ────────────────────────────────────────────────
create or replace function public.consume_ai_quota(
  p_user_id uuid,
  p_feature text,
  p_amount  int default 1
)
returns table (allowed boolean, used int, "limit" int, remaining int, plan text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_month        text := to_char(now(), 'YYYY-MM');
  v_plan         text;
  v_feature_lim  int;
  v_total_lim    int;
  v_feature_used int;
  v_total_used   int;
begin
  -- Resolve the user's plan (default free tier).
  select coalesce(s.plan_type, 'scholar') into v_plan
  from public.subscriptions s
  where s.user_id = p_user_id and s.status = 'active'
  limit 1;

  v_plan := coalesce(v_plan, 'scholar');

  select pl.monthly_limit into v_feature_lim
  from public.plan_limits pl
  where pl.plan_type = v_plan and pl.feature = p_feature;

  select pl.monthly_limit into v_total_lim
  from public.plan_limits pl
  where pl.plan_type = v_plan and pl.feature = 'ai_total';

  -- Unknown feature falls back to the umbrella cap.
  v_feature_lim := coalesce(v_feature_lim, v_total_lim, -1);
  v_total_lim   := coalesce(v_total_lim, -1);

  -- Ensure a row exists for this user+month, then lock it. The lock is what
  -- makes concurrent requests serialise instead of racing.
  insert into public.usage_tracking (user_id, month_year)
  values (p_user_id, v_month)
  on conflict (user_id, month_year) do nothing;

  select
    coalesce((ut.feature_usage ->> p_feature)::int, 0),
    coalesce(ut.ai_generations_used, 0)
  into v_feature_used, v_total_used
  from public.usage_tracking ut
  where ut.user_id = p_user_id and ut.month_year = v_month
  for update;

  -- Deny without incrementing if either cap would be exceeded.
  if (v_feature_lim >= 0 and v_feature_used + p_amount > v_feature_lim)
     or (v_total_lim >= 0 and v_total_used + p_amount > v_total_lim) then
    return query select
      false,
      v_feature_used,
      v_feature_lim,
      greatest(v_feature_lim - v_feature_used, 0),
      v_plan;
    return;
  end if;

  update public.usage_tracking ut
  set feature_usage = jsonb_set(
        ut.feature_usage,
        array[p_feature],
        to_jsonb(v_feature_used + p_amount),
        true
      ),
      ai_generations_used = v_total_used + p_amount,
      updated_at = now()
  where ut.user_id = p_user_id and ut.month_year = v_month;

  return query select
    true,
    v_feature_used + p_amount,
    v_feature_lim,
    case when v_feature_lim < 0 then -1
         else greatest(v_feature_lim - v_feature_used - p_amount, 0) end,
    v_plan;
end;
$$;

-- ── Refund (call when an AI request fails after quota was consumed) ─────────
create or replace function public.refund_ai_quota(
  p_user_id uuid,
  p_feature text,
  p_amount  int default 1
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_month text := to_char(now(), 'YYYY-MM');
begin
  update public.usage_tracking ut
  set feature_usage = jsonb_set(
        ut.feature_usage,
        array[p_feature],
        to_jsonb(greatest(coalesce((ut.feature_usage ->> p_feature)::int, 0) - p_amount, 0)),
        true
      ),
      ai_generations_used = greatest(coalesce(ut.ai_generations_used, 0) - p_amount, 0),
      updated_at = now()
  where ut.user_id = p_user_id and ut.month_year = v_month;
end;
$$;

-- ── Read-only status (for dashboards / upgrade prompts) ────────────────────
create or replace function public.get_ai_quota_status(p_user_id uuid)
returns table (feature text, used int, "limit" int, remaining int, plan text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_month text := to_char(now(), 'YYYY-MM');
  v_plan  text;
begin
  select coalesce(s.plan_type, 'scholar') into v_plan
  from public.subscriptions s
  where s.user_id = p_user_id and s.status = 'active'
  limit 1;
  v_plan := coalesce(v_plan, 'scholar');

  return query
  select
    pl.feature,
    coalesce((ut.feature_usage ->> pl.feature)::int, 0) as used,
    pl.monthly_limit as "limit",
    case when pl.monthly_limit < 0 then -1
         else greatest(pl.monthly_limit - coalesce((ut.feature_usage ->> pl.feature)::int, 0), 0)
    end as remaining,
    v_plan
  from public.plan_limits pl
  left join public.usage_tracking ut
    on ut.user_id = p_user_id and ut.month_year = v_month
  where pl.plan_type = v_plan;
end;
$$;

-- ── Lock down direct writes ────────────────────────────────────────────────
-- Counters must only change through the functions above.
drop policy if exists "Users can update their own usage" on public.usage_tracking;
drop policy if exists "Users can insert their own usage" on public.usage_tracking;

revoke insert, update, delete on public.usage_tracking from authenticated;

grant execute on function public.consume_ai_quota(uuid, text, int) to authenticated;
grant execute on function public.get_ai_quota_status(uuid) to authenticated;
-- refund is server-only (service role); deliberately not granted to authenticated.

create index if not exists usage_tracking_user_month_idx
  on public.usage_tracking (user_id, month_year);

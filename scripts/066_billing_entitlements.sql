-- ═══════════════════════════════════════════════════════════════════════════
-- 066 — Billing & entitlements (Phase 0 + Phase 1 of the gating proposal)
--
--  1. Polar sync columns on subscriptions + a webhook event log
--  2. ONE definition of "Genius" (user_plan / my_plan), used everywhere
--  3. Per-feature entitlements; the hidden 100-a-month umbrella is retired
--  4. consume / refund / status functions rewritten on top of (2) and locked
--     down — see "Security fixes" below
--
-- Safe to re-run.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Subscription columns ─────────────────────────────────────────────────
-- The polar_* columns are written by the app but were never in a migration
-- (added by hand); "if not exists" makes this correct either way.
alter table public.subscriptions
  add column if not exists polar_customer_id     text,
  add column if not exists polar_subscription_id text,
  add column if not exists polar_product_id      text,
  add column if not exists polar_checkout_id     text,
  add column if not exists cancel_at_period_end  boolean not null default false,
  add column if not exists past_due_at           timestamptz,
  add column if not exists ended_at              timestamptz,
  add column if not exists recurring_interval    text,
  add column if not exists polar_modified_at     timestamptz;

create index if not exists subscriptions_polar_subscription_idx on public.subscriptions (polar_subscription_id);
create index if not exists subscriptions_polar_checkout_idx     on public.subscriptions (polar_checkout_id);
create index if not exists subscriptions_polar_customer_idx     on public.subscriptions (polar_customer_id);

-- Every webhook delivery, by its webhook-id: makes redelivery a no-op and
-- leaves an audit trail. Server (service role) only — no RLS policies.
create table if not exists public.polar_webhook_events (
  webhook_id            text primary key,
  event_type            text not null,
  polar_subscription_id text,
  user_id               uuid,
  outcome               text not null,   -- applied | stale | unmatched | ignored
  received_at           timestamptz not null default now()
);
alter table public.polar_webhook_events enable row level security;

-- ── 2. One definition of Genius ─────────────────────────────────────────────
-- Genius when the subscription row is a genius plan AND:
--   active / trialing  — and either Polar-backed (Polar sync keeps the status
--                        honest) or not past its period end (family-wallet
--                        and other one-off grants expire on their own)
--   canceling          — until the period the learner paid for ends
--   past_due           — for a 3-day grace period, then Scholar
-- Everything else is Scholar.
create or replace function public.user_plan(p_user_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select case when exists (
    select 1
    from public.subscriptions s
    where s.user_id = p_user_id
      and s.plan_type = 'genius'
      and (
        (s.status in ('active', 'trialing')
          and (s.polar_subscription_id is not null
               or s.polar_checkout_id is not null
               or s.current_period_end is null
               or s.current_period_end > now()))
        or (s.status = 'canceling'
          and (s.current_period_end is null or s.current_period_end > now()))
        or (s.status = 'past_due'
          and coalesce(s.past_due_at, s.current_period_end, now()) > now() - interval '3 days')
      )
  ) then 'genius' else 'scholar' end
$$;

-- The signed-in learner's own plan (what the UI should read).
create or replace function public.my_plan()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select public.user_plan(auth.uid())
$$;

-- ── 3. Entitlements ─────────────────────────────────────────────────────────
-- Every metered feature has its own visible monthly limit. Units are
-- requests, except flashcards (cards generated). -1 = no limit; 0 = not
-- included in the plan. Genius values are fair-use ceilings.
-- All of these can be changed later from Admin → Plan Limits.
insert into public.plan_limits (plan_type, feature, monthly_limit) values
  -- The hidden umbrella is retired: per-feature limits only.
  ('scholar', 'ai_total',            -1), ('genius', 'ai_total',            -1),
  -- Safety net for a feature that has no row of its own.
  ('scholar', '_default',             5), ('genius', '_default',           300),
  -- Learn
  ('scholar', 'tutor_chat',          60), ('genius', 'tutor_chat',        2000),
  ('scholar', 'quilly_chat',         60), ('genius', 'quilly_chat',       2000),
  ('scholar', 'revision_notes',       5), ('genius', 'revision_notes',     300),
  ('scholar', 'flashcards',         100), ('genius', 'flashcards',        3000),
  ('scholar', 'mind_map',             5), ('genius', 'mind_map',           300),
  ('scholar', 'audio_overview',       5), ('genius', 'audio_overview',     200),
  ('scholar', 'writereal_detect',    10), ('genius', 'writereal_detect',   500),
  ('scholar', 'writereal_grammar',    3), ('genius', 'writereal_grammar',  500),
  ('scholar', 'writereal_humanize',   3), ('genius', 'writereal_humanize', 500),
  ('scholar', 'writereal_paraphrase', 3), ('genius', 'writereal_paraphrase', 500),
  -- Prepare
  ('scholar', 'study_agent',          1), ('genius', 'study_agent',        100),
  ('scholar', 'study_plan',           3), ('genius', 'study_plan',         100),
  ('scholar', 'task_suggestions',    50), ('genius', 'task_suggestions',  1000),
  ('scholar', 'syllabus_analysis',    5), ('genius', 'syllabus_analysis',  100),
  ('scholar', 'weekly_review',        2), ('genius', 'weekly_review',       60),
  ('scholar', 'exam_questions',       3), ('genius', 'exam_questions',     300),
  ('scholar', 'mock_exam',            5), ('genius', 'mock_exam',          300),
  ('scholar', 'essay',                1), ('genius', 'essay',              100),
  -- AI Hub
  ('scholar', 'echomind',             3), ('genius', 'echomind',           300),
  ('scholar', 'stress_relief',      100), ('genius', 'stress_relief',      300),
  ('scholar', 'quest_generation',     5), ('genius', 'quest_generation',   300),
  -- Retired (Browse was merged into Study AI)
  ('scholar', 'search_summary',       0), ('genius', 'search_summary',       0)
on conflict (plan_type, feature) do update set monthly_limit = excluded.monthly_limit;

-- ── 4. Quota functions ──────────────────────────────────────────────────────
-- Security fixes vs 015:
--  * consume / status took any p_user_id from any signed-in caller, so one
--    learner could use up — or read — another learner's allowance. A signed-in
--    caller may now only act on themselves (the server's service role, which
--    has no auth.uid(), is unaffected).
--  * consume accepted a negative p_amount, which a learner could call
--    directly to give themselves unlimited usage. Amounts must be 1–1000.
--  * refund was meant to be server-only, but Postgres grants EXECUTE on new
--    functions to PUBLIC by default and 015 never revoked it — so learners
--    could refund themselves. Revoked below, and the function now refuses
--    any signed-in caller as well.

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
  if auth.uid() is not null and auth.uid() <> p_user_id then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if p_amount is null or p_amount < 1 or p_amount > 1000 then
    raise exception 'invalid amount' using errcode = '22023';
  end if;

  v_plan := public.user_plan(p_user_id);

  select pl.monthly_limit into v_feature_lim
  from public.plan_limits pl where pl.plan_type = v_plan and pl.feature = p_feature;
  if v_feature_lim is null then
    select pl.monthly_limit into v_feature_lim
    from public.plan_limits pl where pl.plan_type = v_plan and pl.feature = '_default';
  end if;
  v_feature_lim := coalesce(v_feature_lim, 0);

  select pl.monthly_limit into v_total_lim
  from public.plan_limits pl where pl.plan_type = v_plan and pl.feature = 'ai_total';
  v_total_lim := coalesce(v_total_lim, -1);

  insert into public.usage_tracking (user_id, month_year)
  values (p_user_id, v_month)
  on conflict (user_id, month_year) do nothing;

  select coalesce((ut.feature_usage ->> p_feature)::int, 0), coalesce(ut.ai_generations_used, 0)
  into v_feature_used, v_total_used
  from public.usage_tracking ut
  where ut.user_id = p_user_id and ut.month_year = v_month
  for update;

  if (v_feature_lim >= 0 and v_feature_used + p_amount > v_feature_lim)
     or (v_total_lim >= 0 and v_total_used + p_amount > v_total_lim) then
    return query select false, v_feature_used, v_feature_lim,
      greatest(v_feature_lim - v_feature_used, 0), v_plan;
    return;
  end if;

  update public.usage_tracking ut
  set feature_usage = jsonb_set(ut.feature_usage, array[p_feature], to_jsonb(v_feature_used + p_amount), true),
      ai_generations_used = v_total_used + p_amount,
      updated_at = now()
  where ut.user_id = p_user_id and ut.month_year = v_month;

  return query select true, v_feature_used + p_amount, v_feature_lim,
    case when v_feature_lim < 0 then -1 else greatest(v_feature_lim - v_feature_used - p_amount, 0) end,
    v_plan;
end;
$$;

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
  if auth.uid() is not null then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if p_amount is null or p_amount < 1 then
    return;
  end if;
  update public.usage_tracking ut
  set feature_usage = jsonb_set(ut.feature_usage, array[p_feature],
        to_jsonb(greatest(coalesce((ut.feature_usage ->> p_feature)::int, 0) - p_amount, 0)), true),
      ai_generations_used = greatest(coalesce(ut.ai_generations_used, 0) - p_amount, 0),
      updated_at = now()
  where ut.user_id = p_user_id and ut.month_year = v_month;
end;
$$;

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
  if auth.uid() is not null and auth.uid() <> p_user_id then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  v_plan := public.user_plan(p_user_id);
  return query
  select
    pl.feature,
    coalesce((ut.feature_usage ->> pl.feature)::int, 0),
    pl.monthly_limit,
    case when pl.monthly_limit < 0 then -1
         else greatest(pl.monthly_limit - coalesce((ut.feature_usage ->> pl.feature)::int, 0), 0) end,
    v_plan
  from public.plan_limits pl
  left join public.usage_tracking ut on ut.user_id = p_user_id and ut.month_year = v_month
  where pl.plan_type = v_plan
    and pl.feature not in ('_default', 'ai_total', 'search_summary');
end;
$$;

-- ── Grants ──────────────────────────────────────────────────────────────────
revoke execute on function public.user_plan(uuid)                    from public, anon, authenticated;
revoke execute on function public.refund_ai_quota(uuid, text, int)   from public, anon, authenticated;
revoke execute on function public.consume_ai_quota(uuid, text, int)  from public, anon;
revoke execute on function public.get_ai_quota_status(uuid)          from public, anon;
revoke execute on function public.my_plan()                          from public, anon;

grant execute on function public.user_plan(uuid)                     to service_role;
grant execute on function public.refund_ai_quota(uuid, text, int)    to service_role;
grant execute on function public.consume_ai_quota(uuid, text, int)   to authenticated, service_role;
grant execute on function public.get_ai_quota_status(uuid)           to authenticated, service_role;
grant execute on function public.my_plan()                           to authenticated, service_role;

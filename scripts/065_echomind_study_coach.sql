-- EchoMind × Study Planner.
--
-- 1. echomind_usage — one row per EchoMind session START (including a weekly
--    review test). The free-plan limit ("3 sessions a month") used to count
--    rows in echomind_logs, which has two problems:
--      * echomind_logs gets a row for EVERY message, so a free learner's
--        "3 sessions" was really 3 messages — the first session ended after
--        three replies.
--      * learners can now delete their EchoMind history, which would have
--        reset their usage count.
--    Rows are written by the server (service role) only; learners can read
--    their own but not insert, change or delete them.
--
-- 2. study_plan_review_feedback gets the weekly review TEST result, so the
--    feedback shown after a weekly review can refer to the actual score.

create table if not exists public.echomind_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null default 'session',   -- 'session' | 'weekly_review'
  created_at timestamptz not null default now()
);

create index if not exists echomind_usage_user_created_idx
  on public.echomind_usage (user_id, created_at desc);

alter table public.echomind_usage enable row level security;

drop policy if exists "echomind_usage_select_own" on public.echomind_usage;
create policy "echomind_usage_select_own"
  on public.echomind_usage for select
  using (auth.uid() = user_id);
-- No insert/update/delete policies on purpose: only the server writes here.

alter table public.study_plan_review_feedback
  add column if not exists score_percentage numeric,
  add column if not exists attempt_id uuid;

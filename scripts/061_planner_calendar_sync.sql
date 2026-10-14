-- Links study_plan_goals to tasks, and adds what's needed for weekly review
-- tasks and editable durations.
--
-- Root cause this fixes: the Planner page's Calendar and Task List
-- (components/planner/calendar-view.tsx, task-list.tsx) read ONLY from the
-- generic `tasks` table. Exporting a StudyPilot plan writes to
-- `study_plan_goals` — a completely separate table the calendar never reads.
-- So an exported plan appeared under "My Study Plans" but never on the
-- calendar. The fix is to mirror each goal into `tasks` on create/edit/
-- complete, linked by plan_goal_id, so the calendar's existing rendering
-- (including its "+N more" multi-item-per-day handling) picks it up with no
-- rebuild needed.

alter table public.tasks
  add column if not exists plan_goal_id uuid references public.study_plan_goals(id) on delete cascade,
  add column if not exists plan_id uuid references public.study_plans(id) on delete cascade,
  add column if not exists estimated_hours integer,
  -- Flags the auto-generated weekly review/exam task so it can be styled
  -- distinctly and located for the completion→feedback flow.
  add column if not exists is_review boolean not null default false;

create index if not exists tasks_plan_goal_id_idx on public.tasks (plan_goal_id);
create index if not exists tasks_plan_id_idx on public.tasks (plan_id);

comment on column public.tasks.plan_goal_id is
  'Mirrors a study_plan_goals row. Editing or completing either side should keep both in sync.';
comment on column public.tasks.is_review is
  'True for the auto-generated weekly review/exam task appended after each week of a plan.';

-- study_plan_goals also gets is_review, so the export route and the weekly
-- review flow can tell a real study goal apart from the review checkpoint
-- without depending on title-string matching.
alter table public.study_plan_goals
  add column if not exists is_review boolean not null default false;

-- ── Weekly review feedback ───────────────────────────────────────────────
-- Stores what the AI proposed after a learner completes a week's review
-- task: which subjects/topics to reinforce and why, based on that week's
-- actual completion data. Read by the planner UI to show "Suggested
-- changes" rather than silently rewriting the plan.
create table if not exists public.study_plan_review_feedback (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.study_plans(id) on delete cascade,
  review_task_id uuid references public.tasks(id) on delete set null,
  user_id uuid not null references auth.users(id) on delete cascade,
  week_number integer not null,
  completed_count integer not null default 0,
  total_count integer not null default 0,
  suggestions jsonb not null default '[]'::jsonb,
  applied boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists study_plan_review_feedback_plan_idx
  on public.study_plan_review_feedback (plan_id, week_number);

alter table public.study_plan_review_feedback enable row level security;

drop policy if exists "review_feedback_select_own" on public.study_plan_review_feedback;
create policy "review_feedback_select_own"
  on public.study_plan_review_feedback for select
  using (auth.uid() = user_id);

drop policy if exists "review_feedback_insert_own" on public.study_plan_review_feedback;
create policy "review_feedback_insert_own"
  on public.study_plan_review_feedback for insert
  with check (auth.uid() = user_id);

drop policy if exists "review_feedback_update_own" on public.study_plan_review_feedback;
create policy "review_feedback_update_own"
  on public.study_plan_review_feedback for update
  using (auth.uid() = user_id);

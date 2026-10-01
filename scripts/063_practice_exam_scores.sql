-- Practice exam MCQ scores.
--
-- Practice Exams grade each multiple-choice question on screen as the
-- learner answers it, but the result was never saved anywhere — so none of
-- it could count toward the combined "Mock Exam Score". One row is written
-- when every MCQ in a generated practice exam has been answered.
--
-- Mock exams (mock_exam_attempts) and essays (essay_attempts) already store
-- their scores; this fills the one gap so all three can be combined.

create table if not exists public.practice_exam_scores (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  -- Nullable: a practice exam can be graded before/without being saved.
  generated_exam_id uuid,
  subject text,
  correct_count integer not null,
  total_count integer not null check (total_count > 0),
  score_percentage numeric not null check (score_percentage between 0 and 100),
  created_at timestamptz not null default now()
);

create index if not exists practice_exam_scores_user_idx
  on public.practice_exam_scores (user_id, created_at desc);

alter table public.practice_exam_scores enable row level security;

drop policy if exists "practice_scores_select_own" on public.practice_exam_scores;
create policy "practice_scores_select_own"
  on public.practice_exam_scores for select
  using (auth.uid() = user_id);

drop policy if exists "practice_scores_insert_own" on public.practice_exam_scores;
create policy "practice_scores_insert_own"
  on public.practice_exam_scores for insert
  with check (auth.uid() = user_id);

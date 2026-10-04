-- Learner subject selection
--
-- Migration 057 let a learner choose a primary/secondary syllabus. But a
-- syllabus can carry a lot of subjects (WAEC currently has 9) and almost no
-- learner sits all of them. Without this, the Study Agent either offers every
-- subject in the syllabus or falls back to free text and guesses.
--
-- One row per subject the learner actually studies, scoped to the syllabus it
-- came from — the same subject name can exist under two syllabi and they are
-- not interchangeable (IGCSE Biology ≠ WAEC Biology).

create table if not exists public.learner_subjects (
  user_id    uuid not null references auth.users(id) on delete cascade,
  syllabus   text not null,
  subject    text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, syllabus, subject)
);

comment on table public.learner_subjects is
  'Subjects a learner is actually studying, within their selected syllabi. Scopes the Study Agent and planner.';

create index if not exists learner_subjects_user_idx
  on public.learner_subjects (user_id);

alter table public.learner_subjects enable row level security;

-- A learner manages only their own rows.
drop policy if exists "learner_subjects_select_own" on public.learner_subjects;
create policy "learner_subjects_select_own"
  on public.learner_subjects for select
  using (auth.uid() = user_id);

drop policy if exists "learner_subjects_insert_own" on public.learner_subjects;
create policy "learner_subjects_insert_own"
  on public.learner_subjects for insert
  with check (auth.uid() = user_id);

drop policy if exists "learner_subjects_delete_own" on public.learner_subjects;
create policy "learner_subjects_delete_own"
  on public.learner_subjects for delete
  using (auth.uid() = user_id);

-- ── Subjects offered by each syllabus ───────────────────────────────────────
-- Derived from imported curriculum, so newly indexed subjects become
-- selectable with no code change — same principle as available_syllabi.
-- depth 0 rows are the subject nodes themselves; counting depth-2 concepts
-- tells us whether a subject is actually usable yet.
create or replace view public.available_subjects as
select
  syllabus,
  subject,
  count(*) filter (where depth = 2) as concept_count,
  count(*) filter (where depth = 1) as topic_count
from public.learning_concepts
group by syllabus, subject
having count(*) filter (where depth = 2) > 0
order by syllabus, subject;

comment on view public.available_subjects is
  'Subjects with at least one seeded concept — source of truth for the learner subject picker.';

grant select on public.available_subjects to authenticated;

-- Learner syllabus selection
--
-- Every AI surface already accepts a `syllabus` argument (RAG namespaces,
-- the orchestrator, Exam Readiness) but nothing ever supplied one — callers
-- passed null and the learner had no way to say what they're studying.
-- This stores that choice once, on the profile, so every feature can read it.
--
-- Two slots, deliberately:
--   primary   — what readiness/planning is scored against; the default filter
--   secondary — a second syllabus the learner also studies (e.g. sitting both
--               WAEC and JAMB). Included in retrieval, but never overrides
--               primary for scoring, so a single readiness number stays
--               meaningful.

alter table public.profiles
  add column if not exists primary_syllabus text,
  add column if not exists secondary_syllabus text;

-- A learner shouldn't be able to pick the same syllabus twice — that would
-- silently double-weight it in retrieval.
alter table public.profiles
  drop constraint if exists profiles_syllabus_distinct_check;
alter table public.profiles
  add constraint profiles_syllabus_distinct_check
  check (
    secondary_syllabus is null
    or primary_syllabus is null
    or secondary_syllabus <> primary_syllabus
  );

comment on column public.profiles.primary_syllabus is
  'Learner''s main syllabus (e.g. WAEC). Scoping for Exam Readiness, planner, and default RAG namespace.';
comment on column public.profiles.secondary_syllabus is
  'Optional second syllabus. Included in RAG retrieval; never used for primary readiness scoring.';

-- ── Available syllabi ───────────────────────────────────────────────────────
-- The selectable list is derived from what has actually been seeded into
-- learning_concepts, NOT a hardcoded enum — so when a new curriculum JSON is
-- indexed it appears in the picker automatically with no code change.
create or replace view public.available_syllabi as
select
  syllabus,
  count(*) filter (where depth = 2)              as concept_count,
  count(distinct subject)                        as subject_count,
  array_agg(distinct subject order by subject)   as subjects
from public.learning_concepts
group by syllabus
having count(*) filter (where depth = 2) > 0
order by syllabus;

comment on view public.available_syllabi is
  'Syllabi with at least one seeded concept — the source of truth for the learner-facing syllabus picker.';

grant select on public.available_syllabi to authenticated;

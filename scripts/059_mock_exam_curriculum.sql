-- Mock exam attempts: record what curriculum the paper was generated from.
--
-- Mock exams can now be generated from the learner's syllabus and subject
-- rather than only from an uploaded document. Without these columns a saved
-- paper has nothing to label it by — "Mock MCQ Exam" and a date is not enough
-- to tell two papers apart when reviewing them later.
--
-- Note: this table pre-dates the scripts/ folder (schema-inventory reports
-- has_migration: false), so this migration only ADDS columns and makes no
-- assumption about how the rest of the table was created.

alter table public.mock_exam_attempts
  add column if not exists subject text,
  add column if not exists syllabus text;

comment on column public.mock_exam_attempts.subject is
  'Subject the paper was generated for, when generated from the learner''s syllabus.';
comment on column public.mock_exam_attempts.syllabus is
  'Syllabus the paper follows (e.g. WAEC). Null for document-generated papers.';

-- Saved papers are listed newest-first per learner.
create index if not exists mock_exam_attempts_user_created_idx
  on public.mock_exam_attempts (user_id, created_at desc);

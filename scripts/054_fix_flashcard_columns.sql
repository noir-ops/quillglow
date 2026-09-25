-- Reported bug: "flashcards are not stored when made — some vanish or auto
-- delete." Root cause found: the flashcard UI and the AI generator both
-- write four columns that were never added to the table in any migration.
--
-- Every insert failed with a Postgres "column does not exist" error. The
-- UI optimistically pushed the new card into local state BEFORE the error
-- came back, so the card appeared on screen and then disappeared on the
-- next refresh — exactly the "vanishing" behaviour described.
--
-- This affected BOTH paths: manually added cards (flashcard-study.tsx) and
-- AI-generated ones (api/ai/generate-flashcards), which is why it looked
-- like flashcards broadly didn't persist.

alter table public.flashcards
  -- Two-way cards: also quiz the student answer-to-question.
  add column if not exists reverse_enabled boolean not null default false,
  -- Fill-in-the-blank card text, e.g. "The capital of {{France}} is {{Paris}}".
  -- Null for ordinary question/answer cards.
  add column if not exists cloze_text text,
  -- Study ordering. Constrained rather than free text since the UI only
  -- ever sets these three values and filters on them directly.
  add column if not exists priority text not null default 'medium'
    check (priority in ('low', 'medium', 'high')),
  -- Optional nudge shown before revealing the answer.
  add column if not exists hint text,
  -- Free-form student annotation on an individual card.
  add column if not exists notes text;

-- The study screen filters and sorts by priority on every session load.
create index if not exists flashcards_deck_priority_idx
  on public.flashcards (deck_id, priority);

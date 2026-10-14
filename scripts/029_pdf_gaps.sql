-- Closes the remaining gaps named in the source proposal PDF. Nothing else.
--
-- Section D  — Learning Graph must track scholarship applications, mentor
--              interactions, purchases and certifications alongside the
--              strengths/weaknesses/exam-history it already covers.
-- Section E  — "If a student improves in physics, the scholarship engine
--              immediately recommends STEM scholarships without duplicate
--              logic." Data is already shared; the *immediately recommends*
--              half needs a trigger.
-- Section C  — Recommendation Engine as a named component.

-- ── Section D: widen the event vocabulary ───────────────────────────────────
-- learning_events.event_type is free text (no CHECK constraint), so no schema
-- change is required to store these — but the comment is the de-facto contract
-- for what belongs here, so it's updated to match the PDF.
comment on column public.learning_events.event_type is
  'quiz_answer | flashcard_review | exam_attempt | essay_submitted | note_created | '
  'tutor_exchange | mind_map_created | revision_note_created | study_session | '
  'audio_overview | quest_completed | scholarship_application | mentor_interaction | '
  'purchase | certification';

-- ── Section E: recommendation surface ───────────────────────────────────────
-- Records what the platform proactively recommended and why, so a
-- recommendation is auditable rather than a black box.
create table if not exists public.recommendations (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null,                    -- opportunity | concept | resource
  target_type text,                      -- opportunity | learning_concept
  target_id text,
  title text not null,
  reason text,                           -- human-readable "why this, why now"
  score numeric(5,2),
  -- Prevents re-recommending the same thing every time the trigger fires.
  dedupe_key text,
  surfaced_at timestamptz,
  dismissed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists recommendations_user_idx
  on public.recommendations (user_id, created_at desc);
create unique index if not exists recommendations_dedupe_idx
  on public.recommendations (user_id, dedupe_key)
  where dedupe_key is not null and dismissed_at is null;

alter table public.recommendations enable row level security;

drop policy if exists "users read own recommendations" on public.recommendations;
create policy "users read own recommendations" on public.recommendations
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "users dismiss own recommendations" on public.recommendations;
create policy "users dismiss own recommendations" on public.recommendations
  for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

/**
 * Section E in one function: when a student's subject mastery improves, surface
 * the opportunities that improvement unlocks — reading the SAME mastery and
 * matching logic the Opportunities page uses, with no duplicated eligibility
 * rules.
 *
 * Returns the number of NEW recommendations created.
 */
create or replace function public.generate_opportunity_recommendations(
  p_user_id uuid,
  p_limit int default 5
)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  m record;
  v_created int := 0;
  v_key text;
begin
  for m in
    select * from public.match_opportunities(p_user_id, p_limit)
    -- Only surface genuinely strong fits. A weak match pushed at a student is
    -- noise, and noise trains them to ignore the feature entirely.
    where match_score >= 50
  loop
    v_key := 'opportunity:' || m.opportunity_id::text;

    insert into public.recommendations
      (user_id, kind, target_type, target_id, title, reason, score, dedupe_key)
    values (
      p_user_id, 'opportunity', 'opportunity', m.opportunity_id::text, m.title,
      case
        when (m.reasons ->> 'strong_concepts')::int > 0
          then 'Matches subjects you have been improving in'
        else 'Matches your profile and exam readiness'
      end,
      m.match_score, v_key
    )
    on conflict do nothing;

    if found then v_created := v_created + 1; end if;
  end loop;

  return v_created;
end;
$$;

grant execute on function public.generate_opportunity_recommendations(uuid, int) to authenticated;

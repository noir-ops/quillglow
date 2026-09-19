-- Phase 1 · Student Learning Graph
--
-- Foundation for adaptive learning, Intelligence Scores, and the Assessor /
-- Curriculum agents.
--
-- Design rule: `learning_events` is APPEND-ONLY and is the single source of
-- truth. `student_concept_mastery` and `intelligence_scores` are DERIVED and
-- can always be rebuilt by replaying events. You will change the mastery
-- algorithm several times; without a replayable log every change silently
-- corrupts historical scores and you can never explain to a parent why a score
-- moved.

-- ── Curriculum structure ────────────────────────────────────────────────────
-- syllabus → subject → topic → concept, as a self-referencing tree.
create table if not exists public.learning_concepts (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid references public.learning_concepts(id) on delete cascade,
  syllabus text not null,                 -- 'WAEC' | 'JAMB' | 'SAT' | 'IGCSE' | 'ACT'
  subject text not null,
  name text not null,
  slug text not null,
  depth int not null default 0,           -- 0=subject 1=topic 2=concept
  prerequisites uuid[] not null default '{}',
  difficulty numeric(3,2) default 0.5,    -- 0..1, recalibrated from attempt data
  estimated_minutes int,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  unique (syllabus, slug)
);

create index if not exists learning_concepts_syllabus_subject_idx
  on public.learning_concepts (syllabus, subject);
create index if not exists learning_concepts_parent_idx
  on public.learning_concepts (parent_id);

alter table public.learning_concepts enable row level security;

-- Curriculum is public reference data.
drop policy if exists "concepts readable by authenticated" on public.learning_concepts;
create policy "concepts readable by authenticated"
  on public.learning_concepts for select to authenticated using (true);

-- ── Append-only evidence log ────────────────────────────────────────────────
create table if not exists public.learning_events (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  concept_id uuid references public.learning_concepts(id) on delete set null,
  -- Free-text topic captured before curriculum mapping exists. Lets you start
  -- collecting evidence immediately and backfill concept_id later.
  raw_topic text,
  subject text,
  event_type text not null,
    -- quiz_answer | flashcard_review | exam_attempt | essay_submitted
    -- note_created | tutor_exchange | mind_map_created | revision_note_created
    -- study_session | audio_overview | quest_completed
  outcome text,                           -- correct | incorrect | partial | skipped | completed
  score numeric(6,2),                     -- normalised 0..100 where meaningful
  max_score numeric(6,2),
  duration_ms int,
  source text not null,                   -- originating route, e.g. 'mock-exam'
  payload jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists learning_events_user_time_idx
  on public.learning_events (user_id, created_at desc);
create index if not exists learning_events_user_concept_idx
  on public.learning_events (user_id, concept_id);
create index if not exists learning_events_user_subject_idx
  on public.learning_events (user_id, subject);
create index if not exists learning_events_type_idx
  on public.learning_events (event_type);

alter table public.learning_events enable row level security;

drop policy if exists "users read own learning events" on public.learning_events;
create policy "users read own learning events"
  on public.learning_events for select to authenticated
  using (auth.uid() = user_id);

-- Writes go through record_learning_event() only (SECURITY DEFINER below),
-- so the log stays append-only and can't be edited by clients.

-- ── Derived mastery ─────────────────────────────────────────────────────────
create table if not exists public.student_concept_mastery (
  user_id uuid not null references auth.users(id) on delete cascade,
  concept_id uuid not null references public.learning_concepts(id) on delete cascade,
  mastery numeric(4,3) not null default 0,      -- 0..1
  confidence numeric(4,3) not null default 0,   -- how much evidence backs it
  state text not null default 'unseen',         -- unseen|learning|weak|review|mastered
  evidence_count int not null default 0,
  correct_count int not null default 0,
  last_seen_at timestamptz,
  next_review_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id, concept_id)
);

create index if not exists mastery_user_state_idx
  on public.student_concept_mastery (user_id, state);
create index if not exists mastery_review_due_idx
  on public.student_concept_mastery (user_id, next_review_at)
  where state in ('weak', 'review');

alter table public.student_concept_mastery enable row level security;

drop policy if exists "users read own mastery" on public.student_concept_mastery;
create policy "users read own mastery"
  on public.student_concept_mastery for select to authenticated
  using (auth.uid() = user_id);

-- ── Intelligence Scores (cached) ────────────────────────────────────────────
create table if not exists public.intelligence_scores (
  user_id uuid not null references auth.users(id) on delete cascade,
  score_type text not null,
    -- exam_readiness | scholarship_readiness | learning_risk
    -- consistency | opportunity | growth
  scope text not null default 'global',   -- 'global' or a syllabus/subject key
  value numeric(5,2) not null,
  breakdown jsonb not null default '{}',  -- component contributions, for explainability
  computed_at timestamptz not null default now(),
  primary key (user_id, score_type, scope)
);

alter table public.intelligence_scores enable row level security;

drop policy if exists "users read own scores" on public.intelligence_scores;
create policy "users read own scores"
  on public.intelligence_scores for select to authenticated
  using (auth.uid() = user_id);

-- ── Mastery application (shared by recorder and rebuilder) ─────────────────
-- Pure derived-state update. Does NOT touch learning_events.
create or replace function public.apply_mastery_from_event(
  p_user_id    uuid,
  p_concept_id uuid,
  p_outcome    text,
  p_score      numeric,
  p_max_score  numeric
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_norm    numeric;
  v_prev    record;
  v_mastery numeric;
  v_conf    numeric;
  v_state   text;
  v_alpha   numeric := 0.3;   -- EWMA weight for new evidence
begin
  if p_concept_id is null then
    return;
  end if;

  -- Normalise this event's performance to 0..1.
  if p_score is not null and p_max_score is not null and p_max_score > 0 then
    v_norm := least(greatest(p_score / p_max_score, 0), 1);
  elsif p_outcome = 'correct' then
    v_norm := 1;
  elsif p_outcome = 'incorrect' then
    v_norm := 0;
  elsif p_outcome = 'partial' then
    v_norm := 0.5;
  else
    -- Exposure without a gradeable outcome: no mastery signal.
    return;
  end if;

  select * into v_prev
  from public.student_concept_mastery
  where user_id = p_user_id and concept_id = p_concept_id;

  if v_prev is null then
    insert into public.student_concept_mastery (
      user_id, concept_id, mastery, confidence, state,
      evidence_count, correct_count, last_seen_at, next_review_at, updated_at
    ) values (
      p_user_id, p_concept_id, v_norm, 0.2, 'learning',
      1, case when v_norm >= 0.7 then 1 else 0 end, now(),
      now() + interval '1 day', now()
    );
  else
    -- Exponentially weighted moving average: recent evidence matters more,
    -- but one bad day doesn't erase established mastery.
    v_mastery := (1 - v_alpha) * v_prev.mastery + v_alpha * v_norm;
    -- Confidence grows with evidence, saturating below 1.
    v_conf    := least(v_prev.confidence + 0.15, 0.95);

    update public.student_concept_mastery
    set mastery        = v_mastery,
        confidence     = v_conf,
        evidence_count = v_prev.evidence_count + 1,
        correct_count  = v_prev.correct_count + case when v_norm >= 0.7 then 1 else 0 end,
        last_seen_at   = now(),
        updated_at     = now()
    where user_id = p_user_id and concept_id = p_concept_id;
  end if;

  -- Classify. Low confidence stays 'learning' regardless of score, so a single
  -- lucky answer never reads as mastery.
  select mastery, confidence into v_mastery, v_conf
  from public.student_concept_mastery
  where user_id = p_user_id and concept_id = p_concept_id;

  if v_conf < 0.4 then
    v_state := 'learning';
  elsif v_mastery >= 0.85 then
    v_state := 'mastered';
  elsif v_mastery >= 0.6 then
    v_state := 'review';
  else
    v_state := 'weak';
  end if;

  update public.student_concept_mastery
  set state = v_state,
      -- Spaced repetition: stronger mastery pushes the next review further out.
      next_review_at = now() + (
        case
          when v_state = 'mastered' then interval '21 days'
          when v_state = 'review'   then interval '7 days'
          when v_state = 'weak'     then interval '2 days'
          else interval '1 day'
        end
      )
  where user_id = p_user_id and concept_id = p_concept_id;
end;
$$;

-- ── Event ingestion ─────────────────────────────────────────────────────────
-- Appends evidence and updates derived mastery in one transaction.
create or replace function public.record_learning_event(
  p_user_id    uuid,
  p_event_type text,
  p_source     text,
  p_concept_id uuid    default null,
  p_raw_topic  text    default null,
  p_subject    text    default null,
  p_outcome    text    default null,
  p_score      numeric default null,
  p_max_score  numeric default null,
  p_duration_ms int    default null,
  p_payload    jsonb   default '{}'::jsonb
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event_id bigint;
begin
  insert into public.learning_events (
    user_id, concept_id, raw_topic, subject, event_type,
    outcome, score, max_score, duration_ms, source, payload
  ) values (
    p_user_id, p_concept_id, p_raw_topic, p_subject, p_event_type,
    p_outcome, p_score, p_max_score, p_duration_ms, p_source, coalesce(p_payload, '{}'::jsonb)
  )
  returning id into v_event_id;

  perform public.apply_mastery_from_event(
    p_user_id, p_concept_id, p_outcome, p_score, p_max_score
  );

  return v_event_id;
end;
$$;

grant execute on function public.record_learning_event(
  uuid, text, text, uuid, text, text, text, numeric, numeric, int, jsonb
) to authenticated;

-- ── Rebuild mastery from the event log ──────────────────────────────────────
-- Run after changing the mastery algorithm. This is the whole reason the event
-- log is append-only: derived state is disposable, evidence is not.
create or replace function public.rebuild_mastery(p_user_id uuid default null)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  e      record;
  v_rows int := 0;
begin
  delete from public.student_concept_mastery
  where p_user_id is null or user_id = p_user_id;

  -- Replay chronologically so the EWMA matches live behaviour exactly.
  for e in
    select user_id, concept_id, outcome, score, max_score
    from public.learning_events
    where (p_user_id is null or user_id = p_user_id)
      and concept_id is not null
    order by created_at, id
  loop
    perform public.apply_mastery_from_event(
      e.user_id, e.concept_id, e.outcome, e.score, e.max_score
    );
    v_rows := v_rows + 1;
  end loop;

  return v_rows;
end;
$$;

-- ── Exam Readiness (first Intelligence Score) ───────────────────────────────
-- Weighted by concept difficulty and confidence, so guessing on easy concepts
-- doesn't inflate the number.
create or replace function public.compute_exam_readiness(
  p_user_id  uuid,
  p_syllabus text default null,
  p_subject  text default null
)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  v_score    numeric;
  v_scope    text;
  v_covered  int;
  v_total    int;
begin
  select
    coalesce(
      sum(m.mastery * m.confidence * (0.5 + c.difficulty))
      / nullif(sum(m.confidence * (0.5 + c.difficulty)), 0),
      0
    ),
    count(*)
  into v_score, v_covered
  from public.student_concept_mastery m
  join public.learning_concepts c on c.id = m.concept_id
  where m.user_id = p_user_id
    and (p_syllabus is null or c.syllabus = p_syllabus)
    and (p_subject  is null or c.subject  = p_subject);

  select count(*) into v_total
  from public.learning_concepts c
  where c.depth = 2
    and (p_syllabus is null or c.syllabus = p_syllabus)
    and (p_subject  is null or c.subject  = p_subject);

  -- Penalise syllabus not yet attempted: mastery of 5 topics out of 200 is not
  -- readiness. Coverage scales the raw mastery score.
  if v_total > 0 then
    v_score := v_score * least(v_covered::numeric / v_total, 1);
  end if;

  v_score := round(least(greatest(v_score * 100, 0), 100), 2);
  v_scope := coalesce(p_subject, p_syllabus, 'global');

  insert into public.intelligence_scores (user_id, score_type, scope, value, breakdown, computed_at)
  values (
    p_user_id, 'exam_readiness', v_scope, v_score,
    jsonb_build_object('concepts_covered', v_covered, 'concepts_total', v_total),
    now()
  )
  on conflict (user_id, score_type, scope) do update
    set value = excluded.value,
        breakdown = excluded.breakdown,
        computed_at = now();

  return v_score;
end;
$$;

-- ── Learning Risk ───────────────────────────────────────────────────────────
-- High = struggling. Combines weak-concept share, recent accuracy and inactivity.
create or replace function public.compute_learning_risk(p_user_id uuid)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  v_weak_ratio    numeric := 0;
  v_recent_acc    numeric := 1;
  v_days_inactive numeric := 0;
  v_risk          numeric;
begin
  select coalesce(
    count(*) filter (where state = 'weak')::numeric / nullif(count(*), 0), 0)
  into v_weak_ratio
  from public.student_concept_mastery
  where user_id = p_user_id;

  select coalesce(avg(case when outcome = 'correct' then 1 when outcome = 'incorrect' then 0 end), 1)
  into v_recent_acc
  from (
    select outcome from public.learning_events
    where user_id = p_user_id and outcome in ('correct', 'incorrect')
    order by created_at desc limit 50
  ) recent;

  select coalesce(extract(epoch from (now() - max(created_at))) / 86400, 30)
  into v_days_inactive
  from public.learning_events where user_id = p_user_id;

  v_risk := round(least(greatest(
      0.45 * v_weak_ratio
    + 0.35 * (1 - v_recent_acc)
    + 0.20 * least(v_days_inactive / 14, 1)
  , 0), 1) * 100, 2);

  insert into public.intelligence_scores (user_id, score_type, scope, value, breakdown, computed_at)
  values (
    p_user_id, 'learning_risk', 'global', v_risk,
    jsonb_build_object(
      'weak_ratio', round(v_weak_ratio, 3),
      'recent_accuracy', round(v_recent_acc, 3),
      'days_inactive', round(v_days_inactive, 1)
    ),
    now()
  )
  on conflict (user_id, score_type, scope) do update
    set value = excluded.value,
        breakdown = excluded.breakdown,
        computed_at = now();

  return v_risk;
end;
$$;

grant execute on function public.compute_exam_readiness(uuid, text, text) to authenticated;
grant execute on function public.compute_learning_risk(uuid) to authenticated;

-- Phase 3 · Opportunities (scholarships, competitions, grants)
--
-- The point of putting this on top of the Learning Graph rather than beside it:
-- a student who improves in Physics should immediately surface STEM scholarships
-- without any duplicate eligibility logic. Matching reads mastery and
-- Intelligence Scores directly.

create table if not exists public.opportunities (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text unique not null,
  provider text,
  opportunity_type text not null default 'scholarship',  -- scholarship|competition|grant|program
  description text,
  url text,

  -- Money
  award_amount numeric(12,2),
  award_currency text default 'USD',
  covers text[],                       -- {tuition,living,books,travel}

  -- Eligibility. NULL means "no constraint" everywhere here.
  countries text[],                    -- ISO codes; null = open to all
  min_age int,
  max_age int,
  syllabi text[],                      -- {WAEC,JAMB,SAT}; null = any
  subjects text[],                     -- required subject strengths
  min_exam_readiness numeric(5,2),     -- gate on Exam Readiness™
  education_level text,                -- secondary|undergraduate|postgraduate
  gender text,                         -- null = any
  requires_essay boolean default false,
  requires_recommendation boolean default false,

  -- Timing
  opens_at date,
  deadline date,
  is_rolling boolean default false,

  status text not null default 'active',   -- active|closed|draft
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists opportunities_status_deadline_idx
  on public.opportunities (status, deadline);
create index if not exists opportunities_type_idx on public.opportunities (opportunity_type);
create index if not exists opportunities_countries_idx on public.opportunities using gin (countries);
create index if not exists opportunities_subjects_idx on public.opportunities using gin (subjects);

alter table public.opportunities enable row level security;

drop policy if exists "active opportunities are public" on public.opportunities;
create policy "active opportunities are public"
  on public.opportunities for select to authenticated
  using (status = 'active');

-- ── Student profile for matching ────────────────────────────────────────────
create table if not exists public.student_opportunity_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  country text,
  date_of_birth date,
  education_level text,
  gender text,
  syllabus text,
  target_subjects text[],
  household_income_band text,
  updated_at timestamptz not null default now()
);

alter table public.student_opportunity_profiles enable row level security;

drop policy if exists "own opportunity profile" on public.student_opportunity_profiles;
create policy "own opportunity profile"
  on public.student_opportunity_profiles for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ── Applications ────────────────────────────────────────────────────────────
create table if not exists public.opportunity_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  opportunity_id uuid not null references public.opportunities(id) on delete cascade,
  status text not null default 'saved',
    -- saved|in_progress|submitted|shortlisted|awarded|rejected|withdrawn
  submitted_at timestamptz,
  notes text,
  documents jsonb not null default '[]',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, opportunity_id)
);

create index if not exists applications_user_status_idx
  on public.opportunity_applications (user_id, status);

alter table public.opportunity_applications enable row level security;

drop policy if exists "own applications" on public.opportunity_applications;
create policy "own applications"
  on public.opportunity_applications for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ── Matching ────────────────────────────────────────────────────────────────
-- Returns opportunities a student is eligible for, scored by fit.
--
-- Hard filters (country, age, deadline) exclude outright — showing a student a
-- scholarship they cannot enter is worse than showing nothing. Soft signals
-- (subject overlap, readiness headroom, award size, urgency) only rank.
create or replace function public.match_opportunities(
  p_user_id uuid,
  p_limit int default 20
)
returns table (
  opportunity_id uuid,
  title text,
  provider text,
  opportunity_type text,
  award_amount numeric,
  deadline date,
  match_score numeric,
  reasons jsonb
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_profile record;
  v_readiness numeric;
  v_age int;
begin
  select * into v_profile
  from public.student_opportunity_profiles where user_id = p_user_id;

  select coalesce(max(value), 0) into v_readiness
  from public.intelligence_scores
  where user_id = p_user_id and score_type = 'exam_readiness';

  v_age := case
    when v_profile.date_of_birth is null then null
    else extract(year from age(v_profile.date_of_birth))::int
  end;

  return query
  with eligible as (
    select o.*,
      -- Subject overlap between the student's strengths and what's required.
      case
        when o.subjects is null then 0
        else (
          select count(*)::numeric
          from public.student_concept_mastery m
          join public.learning_concepts c on c.id = m.concept_id
          where m.user_id = p_user_id
            and m.state in ('review', 'mastered')
            and c.subject = any(o.subjects)
        )
      end as strong_concepts
    from public.opportunities o
    where o.status = 'active'
      -- Hard filters
      and (o.deadline is null or o.deadline >= current_date or o.is_rolling)
      and (o.countries is null or v_profile.country is null or v_profile.country = any(o.countries))
      and (o.min_age is null or v_age is null or v_age >= o.min_age)
      and (o.max_age is null or v_age is null or v_age <= o.max_age)
      and (o.education_level is null or v_profile.education_level is null
           or o.education_level = v_profile.education_level)
      and (o.gender is null or v_profile.gender is null or o.gender = v_profile.gender)
      and (o.syllabi is null or v_profile.syllabus is null or v_profile.syllabus = any(o.syllabi))
      and (o.min_exam_readiness is null or v_readiness >= o.min_exam_readiness)
  )
  select
    e.id,
    e.title,
    e.provider,
    e.opportunity_type,
    e.award_amount,
    e.deadline,
    round(least(
        30 * least(e.strong_concepts / 5.0, 1)                      -- demonstrated subject strength
      + 25 * (v_readiness / 100.0)                                  -- overall readiness
      + 20 * case when e.subjects is null then 0.5 else 1 end       -- specificity of fit
      + 15 * case
               when e.deadline is null then 0.4                     -- rolling: no urgency signal
               when e.deadline - current_date <= 30 then 1.0        -- act now
               when e.deadline - current_date <= 90 then 0.7
               else 0.4
             end
      + 10 * case
               when e.award_amount is null then 0.3
               when e.award_amount >= 10000 then 1.0
               when e.award_amount >= 2000 then 0.7
               else 0.4
             end
    , 100), 2) as match_score,
    jsonb_build_object(
      'strong_concepts', e.strong_concepts,
      'exam_readiness', round(v_readiness, 1),
      'days_left', case when e.deadline is null then null else e.deadline - current_date end,
      'subject_match', e.subjects
    ) as reasons
  from eligible e
  order by match_score desc, e.deadline nulls last
  limit p_limit;
end;
$$;

-- ── Scholarship Readiness™ ──────────────────────────────────────────────────
-- Measures how prepared a student is to WIN funding, not just to apply.
create or replace function public.compute_scholarship_readiness(p_user_id uuid)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_completeness numeric := 0;
  v_academic numeric := 0;
  v_eligible_count int := 0;
  v_application_activity numeric := 0;
  v_score numeric;
  v_p record;
begin
  select * into v_p from public.student_opportunity_profiles where user_id = p_user_id;

  -- A missing profile is the single biggest blocker to matching at all.
  -- NOTE: `v_p IS NOT NULL` would be WRONG here. For a plpgsql record, that
  -- expression is only true when EVERY field is non-null, so a complete profile
  -- with one empty optional column would score zero. Use FOUND instead.
  if FOUND then
    v_profile_completeness := (
        (case when v_p.country is not null then 1 else 0 end)
      + (case when v_p.date_of_birth is not null then 1 else 0 end)
      + (case when v_p.education_level is not null then 1 else 0 end)
      + (case when v_p.syllabus is not null then 1 else 0 end)
      + (case when v_p.target_subjects is not null then 1 else 0 end)
    ) / 5.0;
  end if;

  select coalesce(max(value), 0) / 100.0 into v_academic
  from public.intelligence_scores
  where user_id = p_user_id and score_type = 'exam_readiness';

  select count(*) into v_eligible_count
  from public.match_opportunities(p_user_id, 50);

  select least(count(*) / 5.0, 1) into v_application_activity
  from public.opportunity_applications
  where user_id = p_user_id and status <> 'saved';

  v_score := round(least(greatest(
      35 * v_profile_completeness
    + 35 * v_academic
    + 15 * least(v_eligible_count / 10.0, 1)
    + 15 * v_application_activity
  , 0), 100), 2);

  insert into public.intelligence_scores (user_id, score_type, scope, value, breakdown, computed_at)
  values (p_user_id, 'scholarship_readiness', 'global', v_score,
    jsonb_build_object(
      'profile_completeness', round(v_profile_completeness, 2),
      'academic_readiness', round(v_academic, 2),
      'eligible_opportunities', v_eligible_count,
      'applications_started', round(v_application_activity, 2)
    ), now())
  on conflict (user_id, score_type, scope) do update
    set value = excluded.value, breakdown = excluded.breakdown, computed_at = now();

  return v_score;
end;
$$;

-- ── Opportunity Score™ ──────────────────────────────────────────────────────
-- Quality of the student's current opportunity pipeline.
create or replace function public.compute_opportunity_score(p_user_id uuid)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  v_best numeric := 0;
  v_count int := 0;
  v_urgent int := 0;
  v_score numeric;
begin
  select coalesce(max(match_score), 0), count(*),
         count(*) filter (where deadline is not null and deadline - current_date <= 30)
  into v_best, v_count, v_urgent
  from public.match_opportunities(p_user_id, 50);

  v_score := round(least(greatest(
      50 * (v_best / 100.0)
    + 30 * least(v_count / 10.0, 1)
    + 20 * least(v_urgent / 3.0, 1)
  , 0), 100), 2);

  insert into public.intelligence_scores (user_id, score_type, scope, value, breakdown, computed_at)
  values (p_user_id, 'opportunity', 'global', v_score,
    jsonb_build_object('best_match', v_best, 'eligible_count', v_count, 'closing_soon', v_urgent), now())
  on conflict (user_id, score_type, scope) do update
    set value = excluded.value, breakdown = excluded.breakdown, computed_at = now();

  return v_score;
end;
$$;

grant execute on function public.match_opportunities(uuid, int) to authenticated;
grant execute on function public.compute_scholarship_readiness(uuid) to authenticated;
grant execute on function public.compute_opportunity_score(uuid) to authenticated;

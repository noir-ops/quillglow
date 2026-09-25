-- Exam Readiness was a HARD eligibility gate on opportunities, not just a
-- ranking factor: match_opportunities() (036) excluded any opportunity with
-- min_exam_readiness set if the student's readiness score (v_readiness) fell
-- below it — the opportunity never appeared in results at all, at any rank.
--
-- Per instruction, readiness must not gate access to anything. This removes
-- that WHERE-clause condition. Readiness stays as a SOFT scoring input
-- (25% weight in match_score, unchanged below) — a well-prepared student
-- still ranks higher, but a less-prepared one is never hidden from an
-- opportunity outright.
--
-- Everything else is copied unchanged from 036, including its own fix
-- (checking review_status, not just status) — this migration only removes
-- one line from the eligibility filter.

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
      and o.review_status = 'approved'
      -- Hard filters — genuine eligibility rules (deadline, location, age,
      -- education level, gender, syllabus) stay. Readiness does not: it's a
      -- measure of current preparation, not eligibility, and hiding an
      -- opportunity from a less-prepared student is exactly the kind of
      -- gate that was ruled out.
      and (o.deadline is null or o.deadline >= current_date or o.is_rolling)
      and (o.countries is null or v_profile.country is null or v_profile.country = any(o.countries))
      and (o.min_age is null or v_age is null or v_age >= o.min_age)
      and (o.max_age is null or v_age is null or v_age <= o.max_age)
      and (o.education_level is null or v_profile.education_level is null
           or o.education_level = v_profile.education_level)
      and (o.gender is null or v_profile.gender is null or o.gender = v_profile.gender)
      and (o.syllabi is null or v_profile.syllabus is null or v_profile.syllabus = any(o.syllabi))
      -- REMOVED: and (o.min_exam_readiness is null or v_readiness >= o.min_exam_readiness)
  )
  select
    e.id,
    e.title,
    e.provider,
    e.opportunity_type,
    e.award_amount,
    e.deadline,
    round(least(
        30 * least(e.strong_concepts / 5.0, 1)
      + 25 * (v_readiness / 100.0)
      + 20 * case when e.subjects is null then 0.5 else 1 end
      + 15 * case
               when e.deadline is null then 0.4
               when e.deadline - current_date <= 30 then 1.0
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

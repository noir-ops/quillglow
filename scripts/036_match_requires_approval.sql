-- match_opportunities() checked status='active' but never review_status='approved'.
--
-- In the current flow this never bites in practice — the only code path that
-- sets status='active' (approveOpportunity in the admin panel) sets
-- review_status='approved' at the same instant. But this function is
-- SECURITY DEFINER, meaning it bypasses RLS entirely — the "students only see
-- approved+active" rule (scripts/021_benefactor_accounts.sql) lives in a table
-- SELECT policy this function never touches. If status and review_status ever
-- diverge — an admin reopening a rejected listing, a future bug, a manual DB
-- edit — nothing here would have caught it. The matching engine should be its
-- own source of truth for "is this actually safe to show," not rely on two
-- separate code paths always agreeing.

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
      -- New: the matching engine now enforces approval itself, rather than
      -- assuming it always co-occurs with status='active'.
      and o.review_status = 'approved'
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

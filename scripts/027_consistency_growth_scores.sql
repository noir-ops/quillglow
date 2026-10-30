-- PDF section B · The two remaining Intelligence Scores
--
-- Consistency Score™ — measures study habits
-- Growth Score™      — tracks long-term improvement
--
-- Both are deliberately built on `learning_events`, which is append-only, so
-- they can be recomputed for any historical point rather than only "now".

/**
 * Consistency Score™ — are they showing up regularly?
 *
 * Rewards regular study over cramming: a student who studies 20 minutes on 6
 * days scores higher than one who does 2 hours in a single session, because
 * distributed practice predicts retention far better.
 */
create or replace function public.compute_consistency_score(
  p_user_id uuid,
  p_days int default 28
)
returns numeric
language plpgsql security definer set search_path = public as $$
declare
  v_active_days int;
  v_streak int := 0;
  v_max_streak int := 0;
  v_prev date;
  v_day date;
  v_score numeric;
  v_sessions numeric;
begin
  select count(distinct created_at::date) into v_active_days
  from public.learning_events
  where user_id = p_user_id
    and created_at >= now() - make_interval(days => p_days);

  -- Longest run of consecutive active days in the window.
  for v_day in
    select distinct created_at::date
    from public.learning_events
    where user_id = p_user_id
      and created_at >= now() - make_interval(days => p_days)
    order by 1
  loop
    if v_prev is not null and v_day = v_prev + 1 then
      v_streak := v_streak + 1;
    else
      v_streak := 1;
    end if;
    v_max_streak := greatest(v_max_streak, v_streak);
    v_prev := v_day;
  end loop;

  -- Average events per active day, capped: a huge single session shouldn't
  -- compensate for never showing up.
  select coalesce(count(*)::numeric / nullif(v_active_days, 0), 0) into v_sessions
  from public.learning_events
  where user_id = p_user_id
    and created_at >= now() - make_interval(days => p_days);

  v_score := round(least(greatest(
      55 * least(v_active_days::numeric / (p_days * 0.5), 1)   -- showing up at all
    + 30 * least(v_max_streak::numeric / 7, 1)                 -- sustained habit
    + 15 * least(v_sessions / 5, 1)                            -- depth per session
  , 0), 100), 2);

  insert into public.intelligence_scores (user_id, score_type, scope, value, breakdown, computed_at)
  values (p_user_id, 'consistency', 'global', v_score,
    jsonb_build_object(
      'active_days', v_active_days,
      'window_days', p_days,
      'longest_streak', v_max_streak,
      'avg_events_per_active_day', round(v_sessions, 2)
    ), now())
  on conflict (user_id, score_type, scope) do update
    set value = excluded.value, breakdown = excluded.breakdown, computed_at = now();

  return v_score;
end;
$$;

/**
 * Growth Score™ — are they actually getting better?
 *
 * Compares recent accuracy against an earlier baseline. This is the score that
 * answers the spec's ultimate question — "did the student's educational outcome
 * improve?" — rather than how much AI they consumed.
 *
 * Returns 50 (neutral) when there isn't enough history to judge, so a new
 * student isn't shown a discouraging zero.
 */
create or replace function public.compute_growth_score(
  p_user_id uuid,
  p_window_days int default 60
)
returns numeric
language plpgsql security definer set search_path = public as $$
declare
  v_recent numeric;
  v_baseline numeric;
  v_recent_n int;
  v_baseline_n int;
  v_mastery_gain numeric := 0;
  v_score numeric;
  v_half int := greatest(p_window_days / 2, 1);
begin
  -- Second half of the window.
  select avg(case when outcome = 'correct' then 1 when outcome = 'incorrect' then 0 end),
         count(*)
  into v_recent, v_recent_n
  from public.learning_events
  where user_id = p_user_id
    and outcome in ('correct', 'incorrect')
    and created_at >= now() - make_interval(days => v_half);

  -- First half of the window.
  select avg(case when outcome = 'correct' then 1 when outcome = 'incorrect' then 0 end),
         count(*)
  into v_baseline, v_baseline_n
  from public.learning_events
  where user_id = p_user_id
    and outcome in ('correct', 'incorrect')
    and created_at >= now() - make_interval(days => p_window_days)
    and created_at <  now() - make_interval(days => v_half);

  -- Not enough evidence on either side to make a claim about improvement.
  if v_recent_n < 5 or v_baseline_n < 5 then
    insert into public.intelligence_scores (user_id, score_type, scope, value, breakdown, computed_at)
    values (p_user_id, 'growth', 'global', 50,
      jsonb_build_object(
        'status', 'insufficient_data',
        'recent_attempts', coalesce(v_recent_n, 0),
        'baseline_attempts', coalesce(v_baseline_n, 0),
        'needed_per_period', 5
      ), now())
    on conflict (user_id, score_type, scope) do update
      set value = excluded.value, breakdown = excluded.breakdown, computed_at = now();
    return 50;
  end if;

  -- Share of concepts that have moved into review/mastered.
  select coalesce(
    count(*) filter (where state in ('review', 'mastered'))::numeric / nullif(count(*), 0), 0)
  into v_mastery_gain
  from public.student_concept_mastery
  where user_id = p_user_id;

  -- 50 = flat. Above = improving, below = declining.
  v_score := round(least(greatest(
      50
    + 150 * (coalesce(v_recent, 0) - coalesce(v_baseline, 0))   -- accuracy delta dominates
    + 20 * v_mastery_gain
  , 0), 100), 2);

  insert into public.intelligence_scores (user_id, score_type, scope, value, breakdown, computed_at)
  values (p_user_id, 'growth', 'global', v_score,
    jsonb_build_object(
      'recent_accuracy', round(coalesce(v_recent, 0), 3),
      'baseline_accuracy', round(coalesce(v_baseline, 0), 3),
      'accuracy_delta', round(coalesce(v_recent, 0) - coalesce(v_baseline, 0), 3),
      'concepts_progressing', round(v_mastery_gain, 2)
    ), now())
  on conflict (user_id, score_type, scope) do update
    set value = excluded.value, breakdown = excluded.breakdown, computed_at = now();

  return v_score;
end;
$$;

/** Recompute every Intelligence Score for a student in one call. */
create or replace function public.refresh_all_scores(
  p_user_id uuid,
  p_syllabus text default null,
  p_subject text default null
)
returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  return jsonb_build_object(
    'exam_readiness',        public.compute_exam_readiness(p_user_id, p_syllabus, p_subject),
    'learning_risk',         public.compute_learning_risk(p_user_id),
    'consistency',           public.compute_consistency_score(p_user_id),
    'growth',                public.compute_growth_score(p_user_id),
    'scholarship_readiness', public.compute_scholarship_readiness(p_user_id),
    'opportunity',           public.compute_opportunity_score(p_user_id)
  );
end;
$$;

grant execute on function public.compute_consistency_score(uuid, int) to authenticated;
grant execute on function public.compute_growth_score(uuid, int) to authenticated;
grant execute on function public.refresh_all_scores(uuid, text, text) to authenticated;

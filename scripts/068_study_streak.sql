-- ═══════════════════════════════════════════════════════════════════════════
-- 068 — One real study streak
--
-- There were three streaks and they disagreed:
--   * Home "Day Streak": kept in the BROWSER's local storage and increased
--     just by opening the dashboard — so it counted visits, on one device,
--     and reset on a new phone or browser;
--   * Profile page and leaderboard: profiles.streak_days, set to 0 at signup
--     and never updated — always 0;
--   * consistency score (027): a real streak from learning activity.
--
-- A study day is any day (in the learner's own timezone) with learning
-- activity (learning_events — the same source as 027), a completed task or
-- planner session, or a completed focus (Pomodoro) session.
-- The current streak continues through today until the day is over, so it
-- isn't shown as broken in the morning before the learner has studied.
-- Safe to re-run.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.study_streak(p_user_id uuid, p_tz text default 'UTC')
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_tz    text := case when exists (select 1 from pg_timezone_names where name = p_tz) then p_tz else 'UTC' end;
  v_today date;
  v_day   date;
  v_prev  date;
  v_last  date;
  v_run   int := 0;
  v_long  int := 0;
  v_cur   int := 0;
begin
  if auth.uid() is not null and auth.uid() <> p_user_id then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  v_today := (now() at time zone v_tz)::date;

  for v_day in
    select distinct d from (
      select (created_at at time zone v_tz)::date as d
        from public.learning_events
       where user_id = p_user_id and created_at >= now() - interval '400 days'
      union
      select (completed_at at time zone v_tz)::date
        from public.tasks
       where user_id = p_user_id and completed and completed_at >= now() - interval '400 days'
      union
      select (completed_at at time zone v_tz)::date
        from public.pomodoro_sessions
       where user_id = p_user_id and completed and completed_at >= now() - interval '400 days'
    ) days
    where d is not null and d <= v_today
    order by d
  loop
    if v_prev is not null and v_day = v_prev + 1 then
      v_run := v_run + 1;
    else
      v_run := 1;
    end if;
    v_long := greatest(v_long, v_run);
    v_prev := v_day;
    v_last := v_day;
  end loop;

  -- The run ending today — or yesterday, while today is still in progress.
  if v_last is not null and v_last >= v_today - 1 then
    v_cur := v_run;
  end if;

  return jsonb_build_object(
    'current', v_cur,
    'longest', v_long,
    'studied_today', coalesce(v_last = v_today, false),
    'timezone', v_tz
  );
end;
$$;

-- The signed-in learner's streak. Also stores it on their profile, so the
-- profile page and the leaderboard (which read profiles.streak_days) show the
-- real number instead of 0.
create or replace function public.my_study_streak(p_tz text default 'UTC')
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v jsonb;
begin
  if auth.uid() is null then
    return jsonb_build_object('current', 0, 'longest', 0, 'studied_today', false, 'timezone', 'UTC');
  end if;
  v := public.study_streak(auth.uid(), p_tz);
  update public.profiles
     set streak_days = (v ->> 'current')::int
   where id = auth.uid() and streak_days is distinct from (v ->> 'current')::int;
  return v;
end;
$$;

revoke execute on function public.study_streak(uuid, text) from public, anon, authenticated;
grant  execute on function public.study_streak(uuid, text) to service_role;
revoke execute on function public.my_study_streak(text)    from public, anon;
grant  execute on function public.my_study_streak(text)    to authenticated, service_role;

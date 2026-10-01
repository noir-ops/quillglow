-- exam_questions was never given its own plan_limits row (see 015). It falls
-- back to the plan's umbrella ai_total cap, which is CORRECT for genius
-- (ai_total = -1, unlimited) but means a genius user only sees unlimited
-- exam generation if their subscription is correctly resolved as 'genius'
-- with status = 'active' at the moment of the request — any mismatch there
-- (wrong status string, a stale/duplicate subscription row, etc.) silently
-- demotes them to the scholar fallback, which shares its 100/month cap
-- across every AI feature combined. Giving the feature its own explicit rows
-- removes that indirection for this feature specifically.
insert into public.plan_limits (plan_type, feature, monthly_limit) values
  ('scholar', 'exam_questions', 3),
  ('genius',  'exam_questions', -1)
on conflict (plan_type, feature) do update set monthly_limit = excluded.monthly_limit;

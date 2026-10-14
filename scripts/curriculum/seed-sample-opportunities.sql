-- Sample opportunities so /opportunities has something to match against while
-- an admin management UI doesn't exist yet. Safe to run once; re-running just
-- re-upserts the same rows via slug.
--
-- Replace with real scholarships, or build an admin CRUD page for this table —
-- whichever you'd rather do first.

insert into public.opportunities
  (title, slug, provider, opportunity_type, description, award_amount, award_currency,
   countries, syllabi, education_level, min_exam_readiness, subjects, deadline, status)
values
  ('WAEC STEM Excellence Grant', 'waec-stem-excellence', 'Sample Foundation', 'scholarship',
   'Supports West African students pursuing STEM subjects with strong exam performance.',
   2000, 'USD', array['NG','GH','SL','LR'], array['WAEC'], 'secondary', 60,
   array['Mathematics','Physics','Chemistry'], current_date + interval '90 days', 'active'),

  ('Global Open Merit Award', 'global-open-merit', 'Sample Foundation', 'scholarship',
   'Open to students worldwide, no country restriction. Rolling deadline.',
   1000, 'USD', null, null, null, null, null, null, 'active'),

  ('JAMB Undergraduate Bridge Fund', 'jamb-bridge-fund', 'Sample Foundation', 'grant',
   'Transition support for JAMB students moving to undergraduate study.',
   3500, 'USD', array['NG'], array['JAMB'], 'undergraduate', null, null,
   current_date + interval '45 days', 'active')
on conflict (slug) do update set
  title = excluded.title, description = excluded.description, status = excluded.status;

update public.opportunities set is_rolling = true where slug = 'global-open-merit';

select title, opportunity_type, award_amount, deadline from public.opportunities order by created_at;

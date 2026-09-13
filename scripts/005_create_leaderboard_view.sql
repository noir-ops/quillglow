-- Create a view for leaderboard (top users by XP)
create or replace view public.leaderboard as
select 
  p.id,
  p.display_name,
  p.avatar_url,
  p.xp,
  p.level,
  p.streak_days,
  row_number() over (order by p.xp desc) as rank
from public.profiles p
order by p.xp desc
limit 100;

-- Grant access to authenticated users
grant select on public.leaderboard to authenticated;

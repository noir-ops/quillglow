-- Seed initial achievements
insert into public.achievements (name, description, icon, requirement_type, requirement_value) values
  ('First Steps', 'Complete your first quest', '🎯', 'quests_completed', 1),
  ('Getting Started', 'Earn 100 XP', '⚡', 'xp_earned', 100),
  ('Dedicated Learner', 'Complete 10 quests', '📚', 'quests_completed', 10),
  ('XP Master', 'Earn 500 XP', '💎', 'xp_earned', 500),
  ('Streak Starter', 'Maintain a 3-day streak', '🔥', 'streak_days', 3),
  ('Consistent Scholar', 'Maintain a 7-day streak', '🌟', 'streak_days', 7),
  ('Quest Champion', 'Complete 25 quests', '🏆', 'quests_completed', 25),
  ('XP Legend', 'Earn 1000 XP', '👑', 'xp_earned', 1000),
  ('Unstoppable', 'Maintain a 30-day streak', '💪', 'streak_days', 30)
on conflict do nothing;

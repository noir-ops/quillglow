-- Create achievements table
create table if not exists public.achievements (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null,
  icon text not null,
  requirement_type text not null, -- 'quests_completed', 'xp_earned', 'streak_days', etc.
  requirement_value integer not null,
  created_at timestamp with time zone default now()
);

-- Enable RLS
alter table public.achievements enable row level security;

-- RLS Policies for achievements (read-only for all authenticated users)
create policy "achievements_select_authenticated"
  on public.achievements for select
  using (auth.role() = 'authenticated');

-- Create user_achievements table
create table if not exists public.user_achievements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  achievement_id uuid not null references public.achievements(id) on delete cascade,
  unlocked_at timestamp with time zone default now(),
  unique(user_id, achievement_id)
);

-- Enable RLS
alter table public.user_achievements enable row level security;

-- RLS Policies for user_achievements
create policy "user_achievements_select_own"
  on public.user_achievements for select
  using (auth.uid() = user_id);

create policy "user_achievements_insert_own"
  on public.user_achievements for insert
  with check (auth.uid() = user_id);

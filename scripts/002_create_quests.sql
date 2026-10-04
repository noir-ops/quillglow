-- Create quests table
create table if not exists public.quests (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null,
  subject text not null, -- Math, Science, History, etc.
  difficulty text not null check (difficulty in ('easy', 'medium', 'hard')),
  xp_reward integer not null default 10,
  questions jsonb not null, -- Array of question objects
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Enable RLS
alter table public.quests enable row level security;

-- RLS Policies for quests (read-only for all authenticated users)
create policy "quests_select_authenticated"
  on public.quests for select
  using (auth.role() = 'authenticated');

-- Create user_quests table to track progress
create table if not exists public.user_quests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  quest_id uuid not null references public.quests(id) on delete cascade,
  status text not null default 'in_progress' check (status in ('in_progress', 'completed', 'failed')),
  score integer default 0,
  answers jsonb, -- User's answers
  started_at timestamp with time zone default now(),
  completed_at timestamp with time zone,
  unique(user_id, quest_id)
);

-- Enable RLS
alter table public.user_quests enable row level security;

-- RLS Policies for user_quests
create policy "user_quests_select_own"
  on public.user_quests for select
  using (auth.uid() = user_id);

create policy "user_quests_insert_own"
  on public.user_quests for insert
  with check (auth.uid() = user_id);

create policy "user_quests_update_own"
  on public.user_quests for update
  using (auth.uid() = user_id);

create policy "user_quests_delete_own"
  on public.user_quests for delete
  using (auth.uid() = user_id);

-- Create avatars table
create table if not exists public.avatars (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  image_url text not null,
  unlock_requirement text not null, -- 'default', 'level_5', 'achievement_xyz', etc.
  created_at timestamp with time zone default now()
);

-- Enable RLS
alter table public.avatars enable row level security;

-- RLS Policies for avatars (read-only for all authenticated users)
create policy "avatars_select_authenticated"
  on public.avatars for select
  using (auth.role() = 'authenticated');

-- Insert default avatars
insert into public.avatars (name, image_url, unlock_requirement) values
  ('Starter Scholar', '/avatars/scholar.png', 'default'),
  ('Math Wizard', '/avatars/wizard.png', 'level_5'),
  ('Science Ninja', '/avatars/ninja.png', 'level_10'),
  ('History Hero', '/avatars/hero.png', 'level_15')
on conflict do nothing;

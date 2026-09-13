-- Create profiles table that extends auth.users
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  avatar_url text,
  bio text,
  xp integer default 0,
  level integer default 1,
  streak_days integer default 0,
  last_activity_date date,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Enable RLS
alter table public.profiles enable row level security;

-- RLS Policies for profiles
create policy "profiles_select_all"
  on public.profiles for select
  using (true); -- Allow everyone to view profiles (for leaderboards)

create policy "profiles_insert_own"
  on public.profiles for insert
  with check (auth.uid() = id);

create policy "profiles_update_own"
  on public.profiles for update
  using (auth.uid() = id);

create policy "profiles_delete_own"
  on public.profiles for delete
  using (auth.uid() = id);

-- Create trigger to auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data ->> 'avatar_url', null)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

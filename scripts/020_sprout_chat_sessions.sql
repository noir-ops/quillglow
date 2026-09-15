-- Sprout AI chat session persistence.
--
-- The legacy tutor (`tutor_sessions`) keeps one row per user+subject with a
-- single running message list. Sprout needs multiple named, browsable
-- conversations per user — closer to how ChatGPT-style history works — so it
-- gets its own table rather than overloading tutor_sessions's shape.

create table if not exists public.sprout_chat_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'New chat',
  subject text,
  syllabus text,
  -- [{ role, content, sources, created_at }, ...]
  messages jsonb not null default '[]'::jsonb,
  message_count int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists sprout_chat_sessions_user_updated_idx
  on public.sprout_chat_sessions (user_id, updated_at desc);

alter table public.sprout_chat_sessions enable row level security;

drop policy if exists "own sprout sessions" on public.sprout_chat_sessions;
create policy "own sprout sessions"
  on public.sprout_chat_sessions for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

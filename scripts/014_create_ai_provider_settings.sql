-- AI provider settings (shared between the QuillGlow app and the admin panel)
-- A single row with id = 'global' holds the active provider + chosen models.
-- The admin panel writes it; QuillGlow's API routes read it via the service role.

create table if not exists public.ai_provider_settings (
  id text primary key default 'global',
  active_provider text not null default 'openai'
    check (active_provider in ('openai', 'gemini')),
  openai_model text not null default 'gpt-4.1-mini',
  openai_vision_model text,
  openai_reasoning_effort text default 'low'
    check (openai_reasoning_effort in ('minimal', 'low', 'medium', 'high')),
  gemini_model text not null default 'gemini-2.5-flash',
  gemini_vision_model text,
  updated_at timestamptz not null default now(),
  updated_by uuid
);

-- Seed the single global row.
insert into public.ai_provider_settings (id)
values ('global')
on conflict (id) do nothing;

-- Lock the table down: no anon/authenticated policies are defined, so only the
-- service role (used by the admin panel and QuillGlow's server routes) can
-- read or write it. API keys themselves stay in environment variables.
alter table public.ai_provider_settings enable row level security;

create or replace function public.set_ai_provider_settings_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_ai_provider_settings_updated_at on public.ai_provider_settings;

create trigger trg_ai_provider_settings_updated_at
before update on public.ai_provider_settings
for each row
execute function public.set_ai_provider_settings_updated_at();

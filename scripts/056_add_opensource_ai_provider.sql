-- Add open-source (OpenAI-compatible endpoint) as a third AI provider option.
-- Same table used by both the admin panel and the QuillGlow app — this
-- migration is safe to run more than once.

alter table public.ai_provider_settings
  drop constraint if exists ai_provider_settings_active_provider_check;

alter table public.ai_provider_settings
  add constraint ai_provider_settings_active_provider_check
  check (active_provider in ('openai', 'gemini', 'opensource'));

-- The base URL is not a secret (it's an endpoint, not a credential), so it's
-- fine to store here like the model choices are. The API key for that
-- endpoint (if the server requires one at all — many self-hosted ones don't)
-- stays in OPEN_SOURCE_MODEL_API_KEY, same as OPENAI_API_KEY/GEMINI_API_KEY.
alter table public.ai_provider_settings
  add column if not exists opensource_base_url text,
  add column if not exists opensource_model text;

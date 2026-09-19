# AI Provider Setup (OpenAI ↔ Gemini)

QuillGlow no longer calls Groq. Every AI feature now goes through one shared
layer — `lib/ai/provider.ts` — which calls **either OpenAI or Gemini** depending
on what the admin selected in the admin panel.

## 1. Run the migration

Run `scripts/014_create_ai_provider_settings.sql` against your Supabase project.
It creates the `ai_provider_settings` table with a single `global` row and turns
on RLS with no public policies, so only the service role can read or write it.

## 2. Environment variables

Add these to the **QuillGlow app**:

```bash
OPENAI_API_KEY=sk-...
GEMINI_API_KEY=AIza...

# Optional fallbacks used only if the settings row can't be read
AI_PROVIDER=openai
OPENAI_MODEL=gpt-4.1-mini
GEMINI_MODEL=gemini-2.5-flash

# Optional — for Azure OpenAI or a proxy
# OPENAI_BASE_URL=https://api.openai.com/v1
```

`SUPABASE_SERVICE_ROLE_KEY` must already be set (it is used by
`lib/supabase/admin.ts`), since that's how the app reads the settings row.

Add the same two keys to the **admin panel** so it can list models and run the
"Test connection" button:

```bash
OPENAI_API_KEY=sk-...
GEMINI_API_KEY=AIza...
```

You only strictly need the key for whichever provider is active, but setting both
lets you switch instantly with no redeploy.

## 3. Choose the provider and model

Go to **Admin → APIs**. Pick OpenAI or Gemini with the radio buttons, then choose
a model in each section. Both dropdowns are populated **live** from the provider's
own API, so newly released models show up automatically; each option lists what
the model is good for and its per-1M-token input/output price.

Changes take effect across QuillGlow within 30 seconds (the settings are cached
in memory for that long to avoid a database read on every AI request).

## What each provider section offers

- **Model** — used for all text features.
- **Vision model (optional)** — used only when a request contains images (image
  flashcards, tutor screenshots). Leave unset to use the main model; the current
  default models on both providers are already multimodal.
- **Reasoning effort** (OpenAI only) — applies to `gpt-5.*` and `o*` models.
  Reasoning tokens bill as output tokens, so higher effort costs more. `low` is a
  good balance for study content.

## Features covered

All of these route through the provider layer:

| Feature | Route |
| --- | --- |
| Flashcard generation (text + image) | `app/api/ai/generate-flashcards` |
| Study plan generation | `app/api/ai/generate-study-plan` |
| Syllabus analysis | `app/api/ai/analyze-syllabus` |
| Revision notes | `app/api/revision-notes` |
| Mind maps | `app/api/mind-map` |
| Mock exams | `app/api/mock-exam` |
| Essay questions + grading | `app/api/essay` |
| PDF exam questions | `app/api/pdf/exam-questions` |
| Audio overview scripts | `app/api/audio-overview` |
| EchoMind | `app/api/echomind` |
| Quilly chat | `app/api/quilly/chat` |
| AI tutor | `app/api/tutor/chat` |
| Study agent (multi-step) | `app/api/study-agent` |
| WriteReal detector + humanizer | `app/api/writereal` |
| Search AI summary | `app/api/search/web` |
| Support chatbot | `app/api/chatbot` |
| Stress-relief chat | `app/api/stress-relief-chat` |
| Quest generation | `app/api/quests/generate` |

## Notes on model compatibility

`lib/ai/provider.ts` handles the differences between the two APIs so callers
don't have to:

- **OpenAI reasoning models** (`gpt-5*`, `o1/o3/o4`) use `max_completion_tokens`
  instead of `max_tokens` and reject a custom `temperature`/`top_p`. The layer
  strips those and applies a 2048-token floor, because reasoning tokens count
  against the cap and a small limit can leave no room for visible output.
- **Gemini** gets messages translated into `contents` + `systemInstruction`,
  base64 data URLs into `inlineData`, and JSON mode into
  `responseMimeType: "application/json"`. The reply is mapped back into OpenAI's
  `choices[0].message.content` shape, so every route parses responses the same
  way regardless of provider.

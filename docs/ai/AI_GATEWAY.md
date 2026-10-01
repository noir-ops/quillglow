# AI Gateway — Milestone 3

Single entry point for all AI. Spec §9–§12, §15, §26, §27.

## Usage

```ts
import { aiGateway } from "@/lib/ai/gateway"

const result = await aiGateway.execute({
  task: "essay_review",          // routing is by TASK, never by vendor
  messages: [{ role: "user", content: essay }],
  userId: user.id,
})
```

Existing routes opt in through the familiar wrapper:

```ts
await aiChatCompletion({ messages, max_tokens: 1000 },
                       { task: "essay_review", agent: "study_ai" })
```

This keeps the OpenAI-shaped response contract, so no call site changed shape.

## Routing layers, not vendors

`fast` · `reasoning` · `long_context` · `specialized`

Application code names a **layer**; env decides the vendor:

```bash
FAST_VENDOR=openai          # or groq | gemini
REASONING_VENDOR=openai
LONG_CONTEXT_VENDOR=gemini

FAST_MODEL=gpt-4.1-mini
REASONING_MODEL=gpt-5.4-mini
LONG_CONTEXT_MODEL=gemini-2.5-pro
GROQ_API_KEY=                # set to re-enable the Groq fast layer (spec §8)
```

Swapping a vendor is configuration. No `if (provider === "groq")` exists anywhere.

## Cost control (§26)

Every request logs user, task, agent, provider, model, input/output tokens,
latency, estimated cost, success/failure, cache hit and fallback depth.

Pricing lives in `ai_model_pricing` — a price change is a SQL update, not a deploy.

```
GET /api/admin/ai-cost?days=30   ->  AI Cost / MAU + daily breakdown
```

## Caching (§27)

Only tasks whose output depends solely on the prompt are cached:
`classification`, `intent_detection`, `safety_check`, `summarization`,
`flashcards`, `mind_map`.

**Anything personalised is never cached, even with `cacheable: true`.** A shared
cache on a personalised task would serve one student's response to another. This
is enforced in the gateway, not left to callers.

## Fallback

Routes are tried in priority order. Each failure is logged with its
`fallback_depth`, so a silently-degrading primary provider is visible in the data
rather than invisible.

## Verified

24 assertions: routing per task, classifier, token capture, layer-not-vendor
logging, fallback recovery, cache hits with normalisation, cache refusal on
personalised tasks, vendor indirection, and total-failure error propagation.

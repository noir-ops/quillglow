# Phase 2 · Sprout AI + RAG

**Status:** ✅ Core shipped and tested. Inert until a syllabus is seeded.

---

## 1. The Socratic guarantee is structural, not textual

The proposal asks for a tutor that guides rather than answers. A prompt saying
"please be Socratic" is a suggestion a model can ignore. So enforcement lives in
the schema (`lib/ai/schemas/tutor-turn.ts`):

```ts
nextLeadingQuestion: z.string().min(5)
  .refine(s => s.trim().endsWith("?"))
```

`nextLeadingQuestion` is **required** and **must actually be a question**. A
response that hands over the answer fails validation, and the Interface Agent
retries with corrective feedback (3 attempts), then falls back to a safe generic
nudge rather than shipping an unvalidated answer.

**Verified 7/7**, including the subtle failure mode where a model disguises an
answer as guidance (`"nextLeadingQuestion": "The answer is x = 4."` → rejected).
The parser also tolerates markdown fences and prose preambles, which models emit
constantly.

---

## 2. Only one LLM call blocks the response

```
Student message
      │
 1. Load context (mastery + RAG)     ← DB + one embedding call
 2. Interface Agent                  ← the ONLY blocking LLM call
 3. Emit learning_event
 4. Return to student
      │  (async, after response)
 5. Score refresh / Assessor / Curriculum
```

The proposal describes three agents. Running all three synchronously would cost
three LLM calls per message and feel sluggish. The invisible agents exist to
accumulate judgements over time, not to shape the immediate reply — so they run
after the response is returned.

---

## 3. RAG: the constraint that shaped the schema

**Embedding spaces are not interchangeable.** A vector from OpenAI's
`text-embedding-3-small` cannot be compared with one from `gemini-embedding-001`.

The chat model can be switched freely in the admin panel. The **embedding** model
cannot — switching invalidates the entire corpus. So:

- Embedding config is read from **env, not the database**, so it can't be changed
  with a click that silently corrupts retrieval.
- Every chunk records `embedding_model`; retrieval filters on the active one.
  A mid-flight switch degrades to *no results*, never to garbage matches.
- `knowledge_index_status` shows exactly what needs re-indexing.

Both providers are normalised to **1536 dimensions** — native for OpenAI, and
Gemini via Matryoshka truncation. Google's docs are explicit that truncated
vectors below 3072 are **not** pre-normalised, so `embeddings.ts` L2-normalises
them; skipping that quietly corrupts cosine similarity.

### Hybrid retrieval

Reciprocal Rank Fusion over vector + lexical search. Pure vector misses exact
terms (formula names, statute numbers); pure keyword misses paraphrase. RRF needs
no score normalisation between the two, which makes it robust across corpora.

**Verified:** a chunk with a deliberately distant embedding but an exact keyword
match still surfaces.

### Tenant isolation is enforced in SQL

`search_knowledge` scopes by namespace **and** owner inside the function, not in
application code. **Verified with the hardest case:** user B queries with a vector
*identical* to user A's private note embedding — it would rank #1 on similarity —
and it is still not returned.

Students can only index into their own `user_upload` namespace; the route forces
`ownerId`, so a crafted request can't write into a global syllabus.

---

## 4. Prompt registry

All prompts moved into `lib/ai/prompts/registry.ts`, versioned. Previously 16
routes each carried their own inline prompt — no place to enforce guardrails, no
way to A/B, no rollback without a deploy.

`promptVersion` is recorded on every emitted learning event, so a shift in student
outcomes can be traced to a prompt change rather than guessed at.

---

## Files

| Path | Role |
|---|---|
| `scripts/017_rag_knowledge_base.sql` | pgvector schema, hybrid search, RLS |
| `lib/ai/rag/embeddings.ts` | Dual-provider embeddings, 1536-dim, normalisation |
| `lib/ai/rag/indexer.ts` | Chunk → embed → store, with checksum dedup |
| `lib/ai/rag/retriever.ts` | Hybrid retrieval + context formatting |
| `lib/ai/prompts/registry.ts` | Versioned prompts + guardrails |
| `lib/ai/schemas/tutor-turn.ts` | Socratic enforcement |
| `lib/ai/agents/interface-agent.ts` | Visible agent, validate-and-retry |
| `lib/ai/orchestrator.ts` | Sprout AI entry point |
| `app/api/sprout/chat` | The single assistant endpoint |
| `app/api/knowledge/index` · `/status` | Indexing + index health |

## Env additions

```bash
EMBEDDING_PROVIDER=openai          # openai | gemini — changing this requires re-index
EMBEDDING_MODEL=text-embedding-3-small
```

## Apply

```bash
psql "$STAGING_DB_URL" -f scripts/017_rag_knowledge_base.sql
python3 scripts/schema-tools/test_rag.py    # 12 assertions
```

> Requires the `vector` extension. On Supabase: Database → Extensions → enable `vector`.

---

## Honest limitations

- **Inert without curriculum.** Retrieval returns nothing until syllabus content
  is indexed. Sprout still works — it just isn't grounded.
- **Assessor and Curriculum agents are prompt-defined but not yet wired** to a
  background runner. The orchestrator has the hook; scheduling them needs a job
  queue or cron, which is deliberately deferred rather than half-built.
- **`ivfflat` needs tuning at scale.** `lists = 100` suits ~100k chunks. Rebuild
  the index after bulk-loading a large corpus.
- **No UI.** `/api/sprout/chat` is callable but nothing renders it — Phase 3.

---

# Phase 2 Completion (second pass)

The four items previously listed as outstanding are now closed.

## 5. Event bus — `scripts/018_event_bus.sql`, `lib/events/`

A durable outbox table plus a worker, deliberately **not** a queue service. Same
guarantees — durability, retry with exponential backoff, dead-lettering, replay,
crash recovery — with nothing extra to operate or pay for. The handler interface
is queue-shaped, so swapping in a real queue later doesn't touch handler code.

**Debounce is the important part.** Events carry a `dedupe_key`; repeated
emissions collapse into one pending event and push its run time out. A
20-question exam submission triggers **one** assessment run, not twenty. Without
this, wiring the invisible agents would have multiplied your LLM bill directly by
message volume.

**Verified 16/16** against real Postgres, including:
- 20 emissions → 1 pending event, payload merged
- **6 concurrent workers, 30 events, zero double-claims** (`FOR UPDATE SKIP LOCKED`)
- backoff on failure, dead-letter after 3 attempts with the row retained
- crashed-worker recovery via `requeue_stale_events`

## 6. Assessor + Curriculum agents wired to a runner

- `lib/ai/agents/assessor-agent.ts` — judges mastery, records misconceptions
- `lib/ai/agents/curriculum-agent.ts` — reads the graph, sequences next topic
- `lib/events/handlers/` + `lib/events/worker.ts` — dispatch, retry, reporting
- `POST /api/events/process` — drive from Vercel Cron or any scheduler

The Curriculum Agent reads the Learning Graph and asks the model only to
*sequence* what it's given. Data authoritative, model advisory — that's what
stops it recommending topics that aren't in the syllabus.

**Protected by `CRON_SECRET`.** This endpoint triggers real LLM spend, so it must
never be publicly callable.

## 7. Tutor migrated — without breaking the UI

`/api/tutor/chat` now has an **opt-in** Sprout path (`useSprout: true`, or
`SPROUT_TUTOR=true` globally). It routes through the orchestrator for Socratic
enforcement, RAG grounding and queued agent runs.

**The response shape is byte-identical to the legacy path** — same three keys
(`message`, `sessionId`, `citedSources`), verified programmatically. During
implementation the Sprout branch initially returned `sources` instead of
`citedSources`, which would have silently emptied the source list in the existing
UI. Caught and fixed. Default is off, so nothing changes until you flip it.

### Quilly deliberately NOT migrated

`/api/quilly/chat` is a **community chat buddy** — casual, 2–3 sentences, in a
group channel. Forcing Socratic guardrails on it would make it end every
community message with a leading question. That's a UX regression, not an
upgrade. Socratic structure belongs to the tutor, not to chat.

## 8. Curriculum seeding — `scripts/curriculum/`

- `README.md` — format, seeding, and the SQL to **backfill evidence collected
  before seeding** (map `raw_topic` → `concept_id`, then `rebuild_mastery()`)
- `waec-mathematics.example.json` — worked example, 5 concepts with prerequisites
  and reference content
- `seed.ts` — validates prerequisite slugs **before writing anything** (a typo'd
  slug silently breaks Curriculum Agent sequencing), then writes concepts and
  indexes content into RAG. Idempotent; `--dry-run` supported.

---

## Env additions

```bash
CRON_SECRET=...            # required — protects the event worker
SPROUT_TUTOR=false         # flip to true to route the tutor through Sprout
```

## Migrations, in order

```
baseline → 015_quota → 016_learning_graph → 017_rag → 018_event_bus
```

## Test suites

```bash
python3 scripts/schema-tools/test_quota.py    # 15
python3 scripts/schema-tools/test_graph.py    # 19
python3 scripts/schema-tools/test_rag.py      # 12
python3 scripts/schema-tools/test_events.py   # 16
```

## What genuinely remains

The exit criterion — *one student completes a full adaptive loop with scores that
visibly move* — **cannot be demonstrated from here.** It needs the migrations
applied, a syllabus seeded, and a running instance. Every component is built and
unit-verified; the end-to-end proof is yours to run.

No UI consumes any of this yet. That is Phase 3, and deliberately so.

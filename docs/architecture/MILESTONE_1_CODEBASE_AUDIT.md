# Milestone 1 — Codebase Audit

Required deliverables per the Dev Team Directive. *"No major new development
should begin until this is complete."*

## 1. Repository inventory

| Repository | Purpose | Audience |
|---|---|---|
| `quillglow-main` | Learning Services engine + student UI | Students |
| `quillglow_benefactor-main` | Scholarship submission portal | Benefactors (external) |
| `quillglow_admin-main` | Platform administration + review queue | Internal team |

All three target one Supabase project. There is no service-to-service API —
the database is the integration point.

> **Deviation from spec §20.** The blueprint says roles should be implemented
> "through permissions rather than separate codebases." The benefactor portal is
> a separate deployment. Rationale: benefactors are external, unverified-by-default
> users, and isolating their surface limits blast radius. **This needs a decision
> from the architecture owner** — it is a conscious deviation, not an oversight.

## 2. API inventory

~90 route handlers in `quillglow-main`. AI-bearing routes (18):

| Route | Gateway task | Agent |
|---|---|---|
| `ai/generate-flashcards` | flashcards | study_ai |
| `ai/generate-study-plan` | study_plan | sprout_ai |
| `ai/analyze-syllabus` | summarization | study_ai |
| `revision-notes` | revision_notes | study_ai |
| `mind-map` | mind_map | study_ai |
| `mock-exam` | exam_generation | study_ai |
| `essay` | essay_review | study_ai |
| `pdf/exam-questions` | exam_generation | study_ai |
| `audio-overview` | summarization | study_ai |
| `echomind` | summarization | study_ai |
| `quilly/chat` | tutoring | study_ai |
| `tutor/chat` | tutoring | study_ai |
| `study-agent` | reasoning | study_ai |
| `writereal` | essay_review | study_ai |
| `search/web` | web_research | sprout_ai |
| `chatbot` | classification | unified_core |
| `stress-relief-chat` | tutoring | study_ai |
| `quests/generate` | exam_generation | study_ai |

## 3. Database schema

56 tables in use. Tooling to keep this accurate lives in `scripts/schema-tools/`:

```bash
python3 scripts/schema-tools/extract_schema.py           # infer schema from code
python3 scripts/schema-tools/verify_schema.py dump.sql   # verify a live dump
```

Migrations `014`–`023` add: AI provider settings, atomic quota, learning graph,
RAG, event bus, opportunities, benefactor accounts, AI gateway, RBAC/audit.

## 4. AI integrations

- **Was:** Groq (`llama-3.3-70b-versatile`) hard-coded across 15 call sites.
- **Now:** all AI flows through `lib/ai/gateway` — task-based routing, layer
  abstraction (`fast`/`reasoning`/`long_context`), automatic fallback, caching,
  token/cost logging.

> **Deviation from spec §8.** The routing matrix assumes Groq carries 70–80% of
> workload. Groq was removed from the application at the client's earlier
> request. The `fast` layer currently maps to OpenAI. **Re-enabling Groq is now a
> single env change** (`FAST_VENDOR=groq`) — the adapter exists. Recommended, as
> the spec's cost model depends on it.

## 5. Authentication architecture

Supabase Auth, shared across students and benefactors. Roles in `user_roles`,
permissions in `role_permissions`, resolved server-side by `get_user_access()`.

**Not yet implemented:** MFA for privileged accounts (§22), device/session
management, OAuth.

## 6. Payment architecture

Polar (`lib/polar.ts`). Stripe packages and `lib/stripe.ts` are **dead code** —
zero imports, confirmed by scan. Three `stripe_*` columns remain on
`subscriptions` as historical labels.

## 7. Analytics architecture

- `learning_events` — append-only learning evidence, replayable
- `ai_usage_log` — per-request AI cost/latency/tokens
- `platform_events` — durable event bus with retry and dead-lettering
- `audit_log` — administrative and high-risk actions

**Not yet implemented:** the full §24 business event taxonomy (marketplace and
revenue events in particular).

## 8. Technical debt register

| # | Item | Severity | Notes |
|---|---|---|---|
| 1 | No syllabus seeded | **Critical** | RAG and Learning Graph are inert without it. Not engineering work. |
| 2 | ~~No streaming responses (§25)~~ | **Resolved** | `lib/ai/gateway/streaming.ts` + `/api/sprout/stream` |
| 3 | No MFA on privileged accounts (§22) | High | Admin compromise = full platform compromise. |
| 4 | 3 AI routes unauthenticated | High | `generate-study-plan`, `analyze-syllabus`, `stress-relief-chat` — open cost exposure. |
| 5 | No CI/CD, monitoring, backups (§35–36) | High | Cannot be built from a code repo; needs infra work. |
| 6 | No AI evaluation datasets (§30, §32) | Medium | Groundedness/hallucination unmeasured. |
| 7 | Marketplace not started (M8) | Medium | Entire domain absent. |
| 8 | ~~Wallet + notification services absent (M2)~~ | **Resolved** | `024_wallet_notifications.sql`, ledger-backed |
| 9 | Legacy features still present (§31) | Low | StressRelief, EchoMind, Pomodoro flagged for removal. |
| 10 | Documents not on signed URLs (§23) | Medium | Scholarship docs need the signed-URL pattern. |
| 11 | No load/security/mobile testing (M10) | Medium | |
| 12 | Marketing copy still cites Groq | Low | `how-it-works-section.tsx`, `faq-section.tsx` |

## 9. Verification status

| Suite | Assertions |
|---|---|
| `test_quota.py` | 17 |
| `test_graph.py` | 22 |
| `test_rag.py` | 13 |
| `test_events.py` | 18 |
| `test_opp.py` | 22 |
| `test_benefactor.py` | 14 |
| `test_rbac.py` | 23 |
| AI Gateway (TS) | 24 |
| Streaming (TS) | 12 |
| `test_wallet.py` | 17 |
| **Total** | **182** |

All against real Postgres or mocked provider APIs. **None against a live
deployment with real traffic.**

# Phase 0 · Step 3 — AI Quota Enforcement

**Status:** ✅ Core done. 12 of 17 AI routes gated. 5 need a decision (below).

---

## What was broken

| Problem | Detail |
|---|---|
| **Race condition** | `incrementUsage()` did SELECT-then-UPDATE in JS. Two concurrent requests read the same count and both wrote `count+1` — one request free. Reproduced: **20 parallel requests against a limit of 10 let ~17 through.** |
| **No enforcement** | Usage was *recorded*, never *checked*. Nothing ever returned 429. |
| **Coverage** | 2 of 78 routes tracked anything. |
| **Client-writable counters** | `usage_tracking` had INSERT/UPDATE policies for `authenticated` — a user with the anon key could reset their own usage. |
| **Auth after spend** | `generate-flashcards` authenticated *after* the model call. Unauthenticated requests still cost you money. |

---

## What's in place now

### `scripts/015_atomic_ai_quota.sql`

- `consume_ai_quota(user, feature, amount)` — checks and increments in **one statement** under a row lock. `SECURITY DEFINER`, so it's the only write path.
- `refund_ai_quota(...)` — service-role only. Give back quota when *our* call fails.
- `get_ai_quota_status(user)` — read-only snapshot for dashboards.
- `plan_limits` table — per-plan, per-feature caps. `-1` = unlimited.
- `feature_usage jsonb` on `usage_tracking` — per-feature breakdown, so you can see which feature burns budget. Existing aggregate columns untouched.
- Client INSERT/UPDATE policies dropped; `revoke insert, update, delete ... from authenticated`.

**Verified against real Postgres — 15/15 assertions pass**, including: over-limit denial doesn't increment, refunds restore a usable slot, umbrella `ai_total` accumulates across features, and **20 concurrent requests against a limit of 10 grant exactly 10**.

### `lib/services/quota/index.ts`

- `withQuota(feature, handler)` — full wrapper for **new** routes. Auth + consume + auto-refund on 5xx + `X-Quota-Remaining` headers.
- `enforceQuota(userId, feature)` — inline guard for **existing** routes with multiple HTTP methods. Returns a 429 `Response` or `null`.
- `consumeQuota` / `refundQuota` / `getQuotaStatus`.

Fails **open** on DB error (logged loudly) — a broken quota check shouldn't take the product down.

### `app/api/usage/quota` — current month's usage for the signed-in user.

---

## Routes gated (12)

`revision-notes` · `mind-map` · `mock-exam` · `essay` · `pdf/exam-questions` · `audio-overview` · `quilly/chat` · `tutor/chat` · `search/web` · `quests/generate` · `writereal` · `ai/generate-flashcards`

`generate-flashcards` also had its auth check **moved to the top of the handler** — it previously ran the model first.

---

## The 5 that need your decision

### A. Already have bespoke gating — don't double-gate

**`echomind`** (`FREE_LIMIT = 3` inline) and **`study-agent`** (Genius-only check).

I deliberately did **not** add `enforceQuota` here. Two independent gates means the stricter one wins *and* quota gets consumed even when the legacy check rejects — a real double-count bug.

Migrate deliberately: set the equivalent limits in `plan_limits`, then delete the inline logic and add `enforceQuota`. Do it one at a time and test.

### B. No authentication at all — currently ungated *and* anonymous

**`ai/generate-study-plan`**, **`ai/analyze-syllabus`**, **`stress-relief-chat`**.

These call the model with no `auth.getUser()`. Anyone with the URL can burn your API budget indefinitely. **This is the most expensive hole left.**

Options, cheapest first:
1. Add auth + `enforceQuota` (best, if they're meant to be logged-in features).
2. If `stress-relief-chat` is intentionally public, add IP-based rate limiting instead.
3. Confirm from the frontend whether these are reachable pre-login.

`chatbot` (support bot) is also public — same consideration, but its 500-token cap makes it lower-risk.

---

## Tuning the limits

Defaults in `015_atomic_ai_quota.sql` are placeholders:

| Feature | scholar (free) | genius |
|---|---|---|
| `ai_total` (umbrella) | 100 | unlimited |
| `mock_exam` | 10 | unlimited |
| `essay` | 10 | unlimited |
| `study_agent` | 5 | unlimited |
| `audio_overview` | 3 | unlimited |
| `tutor_chat` | 50 | unlimited |

Change them with plain SQL — no deploy needed:

```sql
update plan_limits set monthly_limit = 25
where plan_type = 'scholar' and feature = 'mock_exam';
```

Add a feature: insert a row for each plan. Unknown features fall back to `ai_total`.

**Set these against real cost before launch.** With GPT-5-class models, 100 free generations/month/user is a meaningful bill at scale.

---

## Apply

```bash
# staging first
psql "$STAGING_DB_URL" -f scripts/015_atomic_ai_quota.sql
```

Then verify: create a free-tier user, call `audio-overview` four times — the 4th must return 429 with `upgradeUrl`.

> **Order matters:** this migration must run *after* the schema baseline (Step 1), since it alters `usage_tracking`.

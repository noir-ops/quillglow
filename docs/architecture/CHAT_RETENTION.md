# Chat History Retention

Closes a gap flagged twice in review: the source architecture document states
*"do not store entire conversations indefinitely, store useful structured
information."* `sprout_chat_sessions` and `tutor_sessions` both violated this —
every raw message kept forever, no expiry.

## What changed

**Write-time cap.** `appendExchange()` now bounds every Sprout session to the
most recent 200 messages as they're appended — cheaper than only relying on a
periodic job to catch bloat after the fact.

**Retention job — `prune_chat_history()`.** Two independent limits, whichever
keeps *more*:
1. messages within the last 90 days
2. the most recent 10 messages, regardless of age

The second is a **floor, not a ceiling**: it guarantees a returning student
never sees zero history even if their only messages are old. A student who
comes back after six months still sees their last few exchanges rather than a
jarring blank slate — the retention window doesn't wipe everything, it wipes
the *middle*.

`tutor_sessions` has no per-message timestamp in its existing shape, so it's
pruned by count only (hard cap of 200).

**Verified: 16/16** against real Postgres, including the case most likely to
be gotten wrong — a session with few recent messages and many old ones, where
the function correctly keeps recent-plus-just-enough-old-ones to satisfy the
floor, in the right chronological order, without emptying a session that never
exceeded the floor to begin with.

## What's intentionally NOT pruned

`learning_events` and `student_concept_mastery` are unaffected — they're
structured, not raw transcript, and being append-only is what makes
`rebuild_mastery()` possible. This migration is specifically about the raw
chat logs sitting *beside* that structured data, not the structured data
itself.

## Apply

```bash
psql "$DB_URL" -f scripts/028_chat_retention.sql
python3 scripts/schema-tools/test_retention.py   # 16 assertions
```

Add `POST /api/admin/prune-chat-history` to the same scheduler already running
`/api/events/process` and `/api/knowledge/process-pending`. Daily is enough —
this doesn't need per-minute granularity.

```bash
CHAT_RETENTION_DAYS=90   # optional, these are the defaults
CHAT_MIN_KEEP=10
CHAT_HARD_CAP=200
```

---

# Application Lifecycle, Student Write Guard, and Notifications

Closes four gaps: no real application step, benefactors seeing bookmarks as
applications, a genuine security hole in student write permissions, and
students never learning they were paid.

## The security fix (found while closing the other gaps)

`opportunity_applications` RLS was `for all ... using (auth.uid() = user_id)`
with **no column restriction**. A student could write `award_amount`,
`payment_status`, or `status = 'awarded'` directly to their own row via any
Supabase client — this was reachable today, not theoretical. Added
`guard_student_application_update()`, mirroring the benefactor-side guard
already in place: a student may edit their own notes/documents and move
between `saved/in_progress/submitted/withdrawn`, but can never touch payment
fields or benefactor-only statuses. **Verified directly** — a test asserts a
student's own attempt to self-award reverts.

## Real application submission

`submit_application()` validates the opportunity's actual requirements
(`requires_essay` → 50+ char essay, `requires_recommendation` → at least one
attached document) before allowing the `saved/in_progress → submitted`
transition. Previously "submit" was just writing a status string with zero
validation.

`components/sprout/apply-dialog.tsx` — essay textarea, document upload
(reusing the existing secure document pipeline), submit button. "Save" is now
explicitly a bookmark; "Apply" is the real thing.

## Benefactors only see real submissions

`benefactor_applications()` now filters `status not in ('saved','in_progress')`.
A bookmark no longer appears in the review queue as if it were an application.

## Notifications

Added to `pay_applicant()` (fires once, after the ledger write succeeds — a
notification failure can never block or roll back a real payment) and to the
benefactor review-status trigger (shortlisted/awarded/rejected). Both use the
existing `send_notification()` — no new infrastructure, it was just never
called from these paths.

## Student wallet page + notification bell

Both `/api/wallet` and `/api/notifications` already existed — genuinely
nothing rendered them. `/wallet` (balance + transaction history) and a bell
in the header (polls every 60s, marks read on open) are the missing UI.

## A build bug found by running the real build, not guessed

`components/ui/popover.tsx` existed but `@radix-ui/react-popover` was never in
`package.json` — the file was scaffolded at some point without its dependency
ever being installed. `esbuild` didn't catch this (same blind spot as the
earlier `Activity` icon miss); only an actual `next build` did. Added the
dependency at the same pinned version as sibling `@radix-ui` packages.

## Verified

**16/16** in `scripts/schema-tools/test_application_lifecycle.py`: the
self-award/self-pay guard, submit validation (blocked without a required
essay, succeeds once met, blocked on re-submit, blocked for another user's
application), benefactor filtering (bookmark invisible, submission visible),
and both notification paths firing with the correct title/body/link.

Full isolated `next build`: clean compile, all new routes (`/wallet`,
`/api/opportunities/applications/[id]/submit`, `/api/opportunities/detail/[id]`)
confirmed present in build output.

---

# Document Fraud Detection (Duplicate/Reused Files)

Closes the last flagged gap. `secure_documents.checksum` existed since the
table was created but nothing ever computed it — no duplicate-document
detection was possible.

## What changed

- `uploadDocument()` now computes a SHA-256 checksum on every upload
  (`lib/services/documents/index.ts`).
- `document_duplicate_count()` — returns how many OTHER documents share this
  file's checksum, counting only different owners. A student re-using their
  own transcript across several of their own applications is normal and is
  explicitly excluded — verified directly (self-reuse shows 0).
- `admin_document_duplicates()` — full investigative detail (which other
  student, which other application), admin-only.

## The privacy boundary this was built around

A benefactor gets a **count only** — never which other student or which other
benefactor's application matched. Exposing that would leak one benefactor's
applicant identity to a completely unrelated benefactor whose applicant
happened to submit the same file. Tested directly: an unrelated benefactor
with no access to the application gets `0`, not the real count.

## UI

The benefactor's document review row now shows an amber warning — *"This
exact file was also submitted by a different applicant elsewhere"* — before
the Verify/Reject buttons, so the fraud signal is visible at the moment the
decision is being made, not buried in a separate report.

## Verified

**8/8** in `scripts/schema-tools/test_document_fraud.py`: self-reuse not
flagged, real cross-student/cross-benefactor duplication correctly flagged on
both sides, a genuinely unique document shows zero, unauthorized access
returns zero rather than leaking the real count, and admin gets full detail
while the benefactor-facing endpoint never does.

Full isolated `next build` on both `quillglow-main` and
`quillglow_benefactor-main`: clean compile, `/api/documents/[id]/duplicates`
confirmed in the benefactor app's build output.

---

# match_opportunities() Now Enforces Review Status Itself

`match_opportunities()` checked `status = 'active'` but never
`review_status = 'approved'`. In the current admin flow this never bit —
`approveOpportunity()` is the only code path that sets `status='active'`, and
it sets `review_status='approved'` in the same write. But the function is
`SECURITY DEFINER`, meaning it bypasses RLS entirely; the "students only see
approved+active" rule lived only in a table SELECT policy this function never
touched. If the two columns ever diverged — an admin reopening a rejected
listing, a manual DB edit — nothing would have caught it.

Added `and o.review_status = 'approved'` directly to the function's hard
filters, so the matching engine is its own source of truth rather than
depending on two separate code paths always agreeing.

**Verified: 7/7**, including the exact scenario that motivated the fix (a
rejected listing manually flipped back to `status='active'` is correctly
excluded) and — separately — proof that the `min_exam_readiness` behavior
reported alongside this was never a bug: the same scholarship appears once a
student's real readiness score meets the stated bar.

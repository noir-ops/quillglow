# Phase 0 — Revenue integrity

This package implements the screenshot's Phase 0. It does **not** introduce
new prices, edit Polar products, or replace the existing plan-limit values.
The scholarship-card, Store-coming-soon, email and navigation updates remain.
The October 17 security permission patches are not reverted or re-applied.

## What is fixed

- AI quotas fail closed: a broken/missing quota RPC returns a retryable 503,
  rather than allowing unmetered model calls. A normal exhausted quota returns
  429; unauthenticated calls return 401 before generation. The four AI routes
  (flashcards, study plan, syllabus analysis, stress-relief) and tracking-based
  task suggestions are covered. Existing monthly limits are preserved.
- Failed generations refund their reserved units, including upstream 429s.
  Wrapper refunds are idempotent within the request. Manual tasks stay free.
- Checkout verification checks account ownership and the explicit Genius
  product allowlist, then reads the actual Polar subscription dates. It never
  invents a 30-day Polar billing period. A shop payment cannot activate Genius.
  Legacy checkouts without any provider-side owner binding require manual
  review; an old local checkout claim or matching email is not sufficient proof.
- Signed webhooks fetch the provider's current state. SQL atomically applies
  the snapshot, rejects older snapshots/older subscriptions, and records the
  delivery. A failed event-log write rolls back the subscription update.
- Reconciliation scans all Polar-linked rows, including previously-downgraded
  Scholar rows, using keyset pagination. It also scans Polar's subscription
  list to recover subscriptions missed entirely by local verification/webhooks.
  Work resumes after the time budget; a job lease prevents overlapping scans.
  Errors and unmatched ownership remain visible, not silent successes.
- `subscription_effective_plan` is the single rule used by `user_plan`,
  `my_plan`, AI quotas, premium entitlements and expiry. A Polar ID cannot
  bypass an expired period. Cancellation retains access until the actual paid
  end; the existing three-day past-due grace is anchored to a real timestamp.
- Direct client writes to subscription/usage/plan-limit tables are revoked,
  including column-level write grants. Server and trusted purchase RPCs work.
- Existing non-Polar one-off and lifetime grants are preserved. Family-wallet
  activation is atomic and idempotent; retrying a receipt does not extend its
  original end or overwrite a Polar binding. Ambassador grants are calculated
  from real email-confirmed referrals by a service-only database function.
  Confirmation-link and OTP callbacks finalize legitimate pending referrals;
  retries cannot extend a previously issued reward.
- Admin cancellation/reactivation updates Polar for Polar-backed subscriptions.
  Subscription server actions require an admin. Both expiry cron endpoints
  reject missing secrets, including `Bearer undefined`, and share one SQL job.

## Deploy in this order

1. Use an isolated staging database first. Run
   `scripts/revenue-preflight-read-only.sql`. All required tables/functions
   must exist; review missing Polar period dates and any custom subscription
   triggers/writers. The patch expects the schema from script 066 to exist.
   **Do not re-run 066 on an existing installation just for this update:** it
   resets plan-limit values. Do not apply the pending Phase 3B wallet-top-up
   patch as part of this rollout; it is a separate change.
2. Apply `supabase/migrations/20261021062757_revenue_integrity.sql` once to
   staging, then deploy both updated ZIPs there. The migration is transactional
   and re-runnable. It changes grants/functions and preserves existing grants;
   it does not rewrite wallet balances or prices.
3. Run `scripts/revenue-verify-read-only.sql` and the staging scenarios below.
   Once they pass, use a short billing deployment window for production:
   apply the migration and immediately deploy both projects. New code requires
   the new RPCs; old subscription writers are blocked after the migration.
   A request during that small transition can need a retry. Polar webhooks
   retry failed deliveries. Don't silently ignore a failed deployment.
4. Run the signed reconciliation dry run, inspect it, then run reconciliation
   and expiry for real. Repeat reconciliation if it returns 202/incomplete.
   Resolve any 503, unmatched owner, or no-subscription result before proceeding.
5. Confirm actual scheduled runs and a successful real **sandbox** Polar
   webhook/payment lifecycle. Only then consider a separate pricing rollout.

Do not roll back just the application to an older release: older code writes
subscriptions through clients that this migration intentionally blocks. Use
the staging backup for rollback rehearsal; prefer a compatible forward fix
for production. Keep a production database backup/recovery plan.

## External configuration

Both projects must use the same intended Supabase project. Retain the existing
Supabase URL, anon/publishable key and server-only service-role key.

Main app:

```text
POLAR_ACCESS_TOKEN=<token with subscriptions:read and checkouts:read>
POLAR_WEBHOOK_SECRET=<exact webhook signing secret from Polar>
POLAR_PRODUCT_ID_GENIUS=<existing monthly Genius product ID>
POLAR_PRODUCT_ID_GENIUS_ANNUAL=<existing annual ID, only if one exists>
POLAR_GENIUS_PRODUCT_IDS=<optional comma-separated legacy Genius IDs>
POLAR_BASE_URL=https://api.polar.sh/v1
CRON_SECRET=<long random secret>
```

Do not put shop products into the Genius allowlist. Do not create/change prices
to fill these variables. Use only the real existing Genius product IDs.
Keep the existing checkout-creation permission on the token as well. The admin
project additionally needs Polar `subscriptions:write` for its cancellation
and reactivation actions, plus its own `CRON_SECRET` and existing admin access
configuration. Secrets remain server-only; never use a NEXT_PUBLIC prefix.

For sandbox testing use sandbox credentials, sandbox product IDs and
`POLAR_BASE_URL=https://sandbox-api.polar.sh/v1` in the isolated staging projects.
Never mix sandbox and production credentials or data.

In Polar, configure a raw webhook endpoint at:

```text
https://YOUR_MAIN_DOMAIN/api/webhooks/polar
```

Subscribe to the subscription lifecycle events, copy its signing secret, and
check that Polar shows successful delivery. Signature verification supports
both legacy Polar HMAC and Standard Webhooks secrets. No extra bearer header
is needed on this endpoint; Polar signs it.

The main `vercel.json` schedules reconciliation at **02:30 UTC daily** and
expiry at **02:45 UTC daily**. The admin's existing expiry schedule stays at
**03:00 UTC daily** and safely uses the same expiry RPC. Existing notification
and history-maintenance schedules remain. If hosted outside Vercel, configure
equivalent HTTP schedules yourself. Vercel supplies `CRON_SECRET` as the bearer
header; an external scheduler must set it explicitly. All billing cron routes
accept GET or POST, except billing-health, which is GET-only.

Examples (substitute your values; don't paste real secrets into a public log):

```bash
curl -H 'Authorization: Bearer YOUR_CRON_SECRET' 'https://YOUR_MAIN_DOMAIN/api/cron/polar-reconcile?dryRun=1'
curl -H 'Authorization: Bearer YOUR_CRON_SECRET' 'https://YOUR_MAIN_DOMAIN/api/cron/polar-reconcile'
curl -H 'Authorization: Bearer YOUR_CRON_SECRET' 'https://YOUR_MAIN_DOMAIN/api/cron/subscription-expiry'
curl -H 'Authorization: Bearer YOUR_CRON_SECRET' 'https://YOUR_MAIN_DOMAIN/api/cron/billing-health'
```

Dry run does not change subscriptions, log deliveries, or advance job cursors.
`billing-health` requires recent completed reconciliation/discovery/expiry runs
with no reported errors. Its readiness flag is operational evidence, **not**
proof that Polar payment or your hosting scheduler has been tested.

## Staging acceptance

- Scholar/new/unconfirmed user: normal login rules work; signed-out AI requests
  do not reach a provider. Quota RPC failure produces 503, not free generation.
- Approved request generates normally. Exhausted quota blocks; concurrent
  requests never exceed the configured allowance. Failed provider requests
  refund once. Flashcards charge actual saved cards.
- Purchase a Genius subscription in Polar sandbox. Verify actual provider
  dates, this user's activation, and matching UI/quota/entitlement state.
- Try another account's checkout and a shop checkout: both must fail.
- Cancel at period end: retain access until that date, then downgrade. Test
  immediate revocation, failed renewal/grace, successful renewal and reactivation.
- Replay a valid delivery: no duplicate change. Deliver an old event after a
  renewal: current provider state wins. Break the DB write: return non-2xx.
- Reconcile more than 200 rows; include a cancelled row, a Scholar row with
  Polar identifiers and a paid subscription missing from local billing rows.
- Repeat a family-wallet purchase: one debit and the same original end date;
  existing Polar linkage and independent lifetime grants remain intact.
- Check ambassador signup/confirmation and a genuine confirmed-referral
  milestone. Anonymous/fake referred-user IDs cannot claim rewards.
- Both cron GET and POST fail without the secret. Non-admin users cannot call
  subscription admin actions. Check an actual automatic scheduled run.

## Verification performed here

Production builds passed for both applications with build-only placeholder
credentials. The repository still has unrelated pre-existing TypeScript errors
and its existing builds skip full type validation; no diagnostics appeared in
the changed billing files during targeted type checks.

`node scripts/test-revenue-routes.cjs` tests actual route handlers against
simulated provider/auth boundaries. `scripts/test-revenue-integrity.cjs` uses
real PostgreSQL through PGlite to exercise the migration twice, privilege and
quota checks, paid-period boundaries, atomic events, job resumption, and
idempotent fulfillment. It also connects the actual signed-webhook handler to
the real SQL sync and quota/expiry handlers. Existing scholarship, Store,
AI-provider, auth/email and admin API regression scripts passed.

For the SQL test install `@electric-sql/pglite` in a temporary directory and
set `PGLITE_MODULE` to its absolute module path. No dependency changes are
required in either production application.

No production database, live Polar payment, external scheduler or deployed
website was changed. The connected account did not expose the buyer's
QuillGlow project. Production rollout and actual sandbox delivery therefore
remain external acceptance steps; they cannot be claimed as already verified.

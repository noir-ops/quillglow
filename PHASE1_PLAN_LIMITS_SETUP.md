# Phase 1 — one source of truth for plan allowances

Prices and existing configured allowances are unchanged. This package builds on
Phase 0 revenue integrity. It does not apply security Phase 3B.

## Included

- `plan_limits` supplies numeric allowances for enforcement, WriteReal, EchoMind,
  StudyPilot, Settings, upgrade prompts and public pricing. The unused
  `SCHOLAR_LIMITS` duplicate is removed; no `PLAN_LIMITS` declaration remains.
- All four WriteReal modes have independent counters and refresh their meters.
  Late responses cannot show another mode's allowance.
- EchoMind charges a session start. Follow-ups use a server-signed token bound to
  the learner, topic and mode through the current UTC month. Fabricated history
  cannot bypass charging. Existing history remains readable; its next message
  starts a metered session if no valid token exists.
- StudyPilot uses one run per complete study system, keeps its existing output
  depth by plan, and refunds failed generations.
- Usage failures return 503 and retry guidance instead of fabricated zero limits.
  Zero and unlimited display correctly for both plans.
- The optional combined `ai_total` allowance is visible in Admin and Settings.
  A refusal names the actual exhausted pool.
- Admin edits check the role inside the API, reject invalid integers and stale
  edits, and commit the change and audit entry together.
- Practice exams use canonical quota counters; legacy duplicate counter writes
  are removed.

## Deploy in order

1. Back up the database and test in staging with both apps using the same staging
   Supabase project.
2. Ensure `20261021062757_revenue_integrity.sql` from Phase 0 is already applied.
   If necessary, follow `PHASE0_REVENUE_SETUP.md` first.
3. Run `supabase/migrations/20261022044132_plan_limits_source_of_truth.sql` in the
   project's SQL editor or normal migration process. It is transactional and safe
   to rerun. It adds only missing allowances, preserving all existing values,
   usage, subscriptions and billing periods. It also creates audit storage if absent.
4. Deploy the updated admin and main app. Apply SQL first: new code calls
   `consume_ai_quota_v2`; the legacy RPC remains compatible during rollout.
5. Keep both hosting projects on the same Supabase URL and anon key with the
   existing server-only `SUPABASE_SERVICE_ROLE_KEY`. Keep AI/Polar credentials.
   No new API key, provider account, product, price or scheduler is required.
6. Retain Polar's URL `https://www.quillglow.com/api/webhooks/polar`, Raw,
   API version 2026-10, subscription events. The non-www domain redirects.
   This package does not reconfigure a live endpoint or its signing secret.

Do not rerun old `015` or `066` bootstrap SQL after Phase 0/1. `066` overwrites
configured limits and restores older entitlement functions. Existing installations
need only the new Phase 1 migration.

## Verify after deployment

- Admin → Plan Limits: change a test allowance, confirm the audit record, and
  verify a stale second tab receives a conflict. Restore the recorded value.
- Settings and the matching tool must show the same value; returning focus to
  an open tab refreshes its meter. Public pricing must match as well.
- Test all WriteReal modes, EchoMind start/follow-ups, and a StudyPilot run.
- In staging, test a small finite cap, `0` (not included), `-1` (unlimited), and
  both Scholar and Genius. Failed model requests must restore the allowance.
- Check existing checkout, family-wallet, webhook, Store and scholarship flows.

## Local checks

From the main app, run `node scripts/test-plan-limits.cjs` and
`node scripts/test-revenue-routes.cjs`. Keep the admin source in its sibling folder.
For SQL integration, install `@electric-sql/pglite` outside the app and set
`PGLITE_MODULE` to its absolute module directory before running
`node scripts/test-revenue-integrity.cjs`. Production dependencies are unchanged.
SQL tests cover both phases, reruns, actual RPCs, audit rollback, concurrency,
access controls, subscription entitlements and quota accounting.

Both apps retain pre-existing repository-wide TypeScript errors and the existing
build option that skips those errors. Changed files are checked for new diagnostics;
a successful production build is not a claim of a clean repository typecheck.

To roll application code back, restore the previous ZIPs. The old consume RPC
remains compatible. Do not erase usage or reinstall old bootstrap SQL.

These are locally validated source and migration files. Applying SQL to the
buyer's project, deploying hosting and testing real Polar deliveries require
that project's access; they have not been performed here.

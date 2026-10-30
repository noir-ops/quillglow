# QuillGlow ambassador access fix

This package targets the three ambassador tables and the server paths that use them. It does not complete the wider public-schema audit or change disk capacity, grants on other tables, cron schedules, pricing or plan limits.

## Deploy in this order

1. Keep the current production SQL protection (the three Service policies restricted to service_role and client TRUNCATE revoked).
2. Deploy the updated main ZIP to the existing main hosting project and the updated admin ZIP to the existing admin hosting project. Use the complete ZIP contents, including previous changes. No new scheduled job is needed.
3. Both projects need the existing NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY and server-only SUPABASE_SERVICE_ROLE_KEY for the same production project. Never prefix the service key with NEXT_PUBLIC_. Keep existing admin authorization (trusted admin role or ADMIN_EMAILS) configured.
4. In Supabase SQL Editor, run scripts/ambassador_access_hardening.sql in full. The identical script is in both ZIPs; run it once. It changes only grants and RLS configuration for ambassadors, ambassador_rewards and ambassador_certificates. It removes direct client access, including separately granted column privileges, and explicitly grants server CRUD access. No existing rows are rewritten/deleted. A lock timeout aborts the transaction; if any error occurs, use ROLLBACK before retrying in a new query.
5. Run scripts/verify_ambassador_access.sql. Expect six rows: rls_enabled=true, any_table_access=false, any_column_access=false, service_access=true. Send the result back for review. These are effective role checks, including inherited access.
6. Run the smoke checks below. Configuration tests do not substitute for live signed-in tests.

Deploy code BEFORE applying the final SQL. Old main routes use client grants for registration, stats and certificates; deploying the updated routes first avoids cutting off those flows. If the main deploy succeeds but admin fails, finish/retry the admin deployment before applying SQL. Once SQL is applied, do not roll the main app back to the old routes without a compatible fix. Do not restore broad public policies as a workaround.

## Expected behavior

- Ambassador registration remains automatically approved, as the uploaded code intentionally implements. Only the authenticated user's account is used. Status and initial counters are chosen on the server; request-supplied counts/reward levels are ignored.
- Ambassador own-profile, stats, rewards and certificate reads use the signed-in user's ID on the server.
- Leaderboard retains its public API and response fields. Direct table requests cannot expose private email/message columns.
- Certificate generation requires the signed-in owner's approved ambassador record and the existing milestone eligibility check. Certificate verification looks up only the requested unique ID server-side and returns its existing public fields.
- Referral POST/PUT preserve the user-ID and confirmation checks before server access; tracking stores the verified session email rather than a submitted email. Full referral counts are read server-side rather than through a referred user's limited RLS visibility.
- OAuth uses the existing confirmed-referral RPC instead of the duplicate legacy client writes. The existing Phase 0 finalize_confirmed_referral and grant_ambassador_genius RPCs must remain installed.
- Every ambassador admin action that accesses service data now checks admin authorization first. Subscription rewards use the existing Phase 0 idempotent grant RPC rather than overwriting paid subscription fields. Two invalid fetchAllRows(...).single() chains were corrected.

## Live smoke checks

- Logged out: open the ambassador leaderboard and verify a known certificate ID.
- Logged out: register/stats/certificate creation must return 401. Referral tracking may retain its existing 202 confirmation-required response.
- Test learner: apply once; verify response and own dashboard. A repeat application should be rejected as before.
- Two different test users: each dashboard must show only its owner's data. Cross-account referral tracking requests must return 403.
- Approved eligible test ambassador: generate/view a certificate. Ineligible users must be rejected. Avoid modifying real counters to manufacture eligibility.
- Admin: list ambassadors, view referrals/rewards/certificates, and update a disposable test record. A non-admin must be redirected/denied.
- Supabase verification SQL: no direct table or column privileges for anon/authenticated on these three tables.

## Limits of this review

Tests use a local Postgres-compatible engine and mocked route dependencies. They prove the tested permission and handler branches, not live production configuration or that past abuse never occurred. Existing records are not automatically marked trustworthy, reset or deleted. Other tables, exposed views and SECURITY DEFINER RPCs need the separate full-schema audit; the prior 100-row exports were incomplete. No S3 or database-size cleanup is included.

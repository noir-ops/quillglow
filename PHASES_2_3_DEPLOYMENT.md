# QuillGlow revenue roadmap — Phases 2 and 3

Prepared 24 October 2026. These ZIPs include the existing Phase 0/1 work and the
new Phase 2/3 implementation. No production database, Polar account, hosting
project or scheduler has been changed from this workspace. Complete the steps
below in order. Saving a draft never changes customer pricing.

## Phase status and stop points

| Phase | Code status | Gate before proceeding |
| --- | --- | --- |
| 0 — stop revenue leaks | Preserved; SQL and route regressions pass locally | Actual signed webhook, payment, expiry and reconciliation in your environment |
| 1 — one source of truth | Preserved; configured limits unchanged | Scholar/Genius pages and quota enforcement agree in staging |
| 2 — new pricing | Implemented; inactive by default | All six environment-specific gates pass; authorize a future UTC launch |
| 3 — convert and tune | Implemented; inactive by default | Launch Phase 2, explicitly enable Phase 3, collect 30 observed usage days before reviewing limits |

The separate Supabase disk/I/O and general public-table-grants investigation is
postponed as requested. This migration grants access only for its own objects.

## 1. Establish the current database state

Back up production and rehearse with an isolated staging Supabase project.
Keep both apps pointed to the same intended project. Keep your existing
Supabase URL, anon/publishable key and server-only service-role key. Never copy
the service-role key into a NEXT_PUBLIC variable.

The new migration requires these earlier migrations, in this order:

1. `supabase/migrations/20261021062757_revenue_integrity.sql`
2. `supabase/migrations/20261022044132_plan_limits_source_of_truth.sql`
3. `supabase/migrations/20261024131956_revenue_pricing_and_growth.sql`

If 1 and 2 are already applied, apply only 3. Use the main project's normal
migration process or SQL editor. Read `PHASE0_REVENUE_SETUP.md` and
`PHASE1_PLAN_LIMITS_SETUP.md` if those phases are not deployed yet. Do not rerun
old bootstrap scripts 015/066: they restore older functions or reset limits.
Do not add the unrelated security Phase 3B migration to this release.

Deploy the updated main and admin code after the new SQL, close together.
The migration leaves the $4.99 monthly offer active, annual sales unavailable,
and Phase 3 disabled. It preserves existing subscriptions, prices, usage,
wallet receipts and plan-limit values. It is transactional and rerunnable.

Run `scripts/pricing-growth-verify-read-only.sql` in the SQL editor afterward.
A fresh install of this migration should show authorized_at=NULL and
phase3_enabled=false. Rerunning it after launch deliberately preserves live state.

## 2. Configure Polar in staging first

Use Polar sandbox with a separate staging database. Sandbox and production
have different product IDs, credentials, webhooks and evidence. Do not point a
sandbox deployment at the production database or share one rollout row between
two different Polar environments.

In each Polar environment:

- Keep the existing Genius $4.99 USD monthly recurring product unchanged.
- Create a separate Genius $5.99 USD recurring monthly product.
- Create a separate Genius $59.99 USD recurring yearly product.
- Each product must have exactly one active fixed USD price, recurring every
  one month or one year respectively. Do not add meter/custom-price components.
- Create a real discount eligible for the new monthly product for the discount
  test. The code accepts eligible discount codes at hosted checkout; it does
  not promise the former 1OFFMONTH promotion or create coupons automatically.
- Copy each product UUID from that product in Polar into Admin → Pricing rollout.
  These are product IDs, not API tokens. Preserve the legacy product so existing
  recurring subscriptions retain their original $4.99 price.

Both hosting projects need server-only POLAR_ACCESS_TOKEN with products:read,
checkouts:read, checkouts:write and subscriptions:read. Keep subscriptions:write
where your admin subscription-management actions require it. Use your existing
organization token if it already has these scopes; otherwise update/create a
properly scoped token in Polar's organization developer settings. Do not place
it in a public environment variable.

Main app:

```text
POLAR_BASE_URL=https://sandbox-api.polar.sh/v1   # staging only
POLAR_ACCESS_TOKEN=<sandbox organization token>
POLAR_WEBHOOK_SECRET=<sandbox endpoint signing secret>
POLAR_PRODUCT_ID_GENIUS=<unchanged legacy monthly product UUID>
NEXT_PUBLIC_SITE_URL=https://YOUR-STAGING-MAIN-DOMAIN
CRON_SECRET=<existing long random server secret>
```

Admin:

```text
POLAR_BASE_URL=https://sandbox-api.polar.sh/v1
POLAR_ACCESS_TOKEN=<token for the same sandbox organization>
NEXT_PUBLIC_MAIN_SITE_URL=https://YOUR-STAGING-MAIN-DOMAIN
```

Production uses `POLAR_BASE_URL=https://api.polar.sh/v1` in both projects,
production credentials and the actual main URL, normally
`https://www.quillglow.com`. The admin verifies signed-out AI protection against
NEXT_PUBLIC_MAIN_SITE_URL. It must reach the same deployed release without a
preview-password/login wall. A redirect, 404 or other status fails verification.

Keep the existing signed webhook at the canonical main domain's
`/api/webhooks/polar`. Retain subscription lifecycle events, including creation,
updates, active/renewed, canceled and revoked events as available in your Polar
configuration. Avoid the non-www URL if it redirects. Inspect a real successful
signed delivery; manually re-enable an endpoint that Polar disabled only after
its failing delivery is corrected. Test checkout verification alone is not a
substitute for a successful webhook.

Keep reconciliation and expiry scheduled from Phase 0. With the matching
Authorization: Bearer CRON_SECRET, execute main-app reconciliation and expiry,
and check `/api/cron/billing-health`. All three job histories (polar-local,
polar-discovery, expiry) must have successful completed runs within 36 hours
and zero errors/unmatched owners. Reconciliation must finish; repeat if it
returns an incomplete/202 result. The new pricing launch is time-based and does
not need an additional cron job. Notification-email scheduling is independent.

## 3. Complete the six Phase 2 gates

Open Admin → Pricing rollout. Save the three product IDs and a future UTC ISO
launch time, for example in the form YYYY-MM-DDTHH:mm:ssZ. Saving validates
Polar products and creates a new configuration revision. It does not authorize
launch or show the last-chance banner.

Use separate verified test learner accounts; do not use a real existing paying
learner to test a new subscription. Admin can create monthly/yearly hosted
checkout links before public launch. Creating a link does not charge anyone;
completing it manually creates a real subscription in the selected environment.
Production test payments can incur actual charges and fees.

Record:

1. A successful new monthly checkout with Genius access and correct provider
   period end synchronized by a signed webhook.
2. A successful new annual checkout with its actual annual period end. AI
   allowances still reset monthly, including annual subscribers.
3. A separate successful monthly checkout with a discount actually applied.
4. Another test subscription canceled and ended, whose user has actually
   returned to Scholar. A cancellation merely scheduled for the future does
   not prove downgrade. Preserve access until the provider's paid end.
5. Recent successful reconciliation, discovery and expiry, plus logged-out
   401 responses from all eight tested AI endpoints.
6. Review Scholar and Genius pages and confirm their displayed allowances
   match enforcement. Check the operator attestation; the verifier also
   compares live quota status with plan_limits for both test plans.

Enter the three checkout IDs and ended cancellation subscription ID, then
select “Verify gates against Polar and Supabase.” All six must pass. Evidence
is revision-specific, environment-specific and expires after seven days.
Changes to the draft require fresh verification.

Select “Recheck and authorize scheduled launch” only when ready. It rechecks
provider/database evidence and requires a future launch within seven days.
Before launch, you can cancel the schedule and resave the draft. No product or
existing subscription is updated by this action.

At launch:

- Public monthly price changes to $5.99; the $59.99 annual option becomes available.
- Pricing, upgrade, marketing copy, structured data and the downloadable pricing
  sheet use the same database configuration. The PDF is generated at
  `/api/billing/pricing.pdf`; it reads current prices and plan limits.
- The dated last-chance banner disappears automatically.
- Existing ongoing $4.99 subscriptions stay on their original product and rate.
  Resubscribing after a subscription ends uses the then-current new-user offer.
- Family balance provides a separately quoted 30-day one-off grant. New purchases
  use the live monthly amount; retrying an existing receipt never debits again
  or changes its original end. Annual Polar billing is not a wallet product.

Repeat this entire lifecycle with production-specific products and evidence
before authorizing production. Sandbox proof cannot authorize production.

## 4. Enable Phase 3 separately

After Phase 2 is live, enable Phase 3 from Pricing rollout. You can pause it
again without changing prices, subscription rights or existing limits.

This enables:

- Scholar's StudyPilot taste, based on the existing allowance; no limits are
  silently raised or reduced.
- A separate weekly-review-test meter, distinct from EchoMind session starts.
- Genius-only saved StudyPilot next steps, protected by server plan/ownership
  checks. Links guide learners into existing tools; those tools retain their
  own quotas. Merely viewing next steps does not call an AI provider.
- Admin → Scholar to Genius: aggregate offer views, upgrade clicks, checkout
  starts, paid activations after Scholar exposure, and feature-level limit hits.

The report collects account IDs and counters in private service-only tables;
it does not collect study content, prompts or chat text. The admin response
contains aggregate counts, not learner IDs. Browser events cannot claim payment
or activation. A paid activation is observed from canonical subscription state.
Existing active subscribers are not counted as new conversions merely because
tracking is enabled. “Units attempted” includes refunded provider failures and
is demand telemetry, not an invoice or provider-cost ledger. Anonymous visitors
are not part of the registered Scholar cohort.

Wait for 30 elapsed days AND 30 distinct days with actual observed AI usage.
The report indicates when that gate is met; it never changes a limit. Then
review conversion, limit-hit concentration and real provider costs together.
Use the existing audited Plan Limits editor for a deliberate adjustment. It
would be misleading to claim the 30-day tuning phase is finished today.

## Validation supplied with this release

- Production builds pass for both apps using build-only placeholder credentials.
- Existing scholarship, Store notification, email queue, setup, plan-limit and
  revenue route regression scripts pass.
- Real PostgreSQL/PGlite tests pass for Phase 0/1 integrity and Phase 2/3 reruns,
  privileges, gate/environment boundaries, exact launch pricing, wallet receipt
  idempotency, quota accounting and analytics failure isolation.
- New real-handler tests cover trusted products/quotes, duplicate purchases,
  authorization, Genius-only ownership checks and forged conversion prevention.
- Chromium tests exercise real components at mobile width: draft/scheduled/live
  prices, automatic banner expiry, annual quote, separate weekly pool, Scholar
  prompts and unavailable-pricing checkout protection. The pricing PDF was
  generated, text-checked and rendered for layout review.
- No production dependency/lockfile or existing build settings were changed.
  Repository-wide TypeScript checks still report 71 main-app and 20 admin
  diagnostics in pre-existing files. No diagnostics occur in this release's
  changed/new TypeScript files; builds retain the repository's existing skip.

Local commands, from main with admin as its sibling:

```text
node scripts/test-revenue-routes.cjs
node scripts/test-plan-limits.cjs
node scripts/test-pricing-growth-routes.cjs
TEST_NODE_MODULES=/ABSOLUTE/TEST-DEPS/node_modules node scripts/test-pricing-growth-browser.cjs
PGLITE_MODULE=/ABSOLUTE/TEST-DEPS/node_modules/@electric-sql/pglite node scripts/test-revenue-integrity.cjs
PGLITE_MODULE=/ABSOLUTE/TEST-DEPS/node_modules/@electric-sql/pglite node scripts/test-pricing-growth-sql.cjs
```

Install PGlite outside production dependencies for these SQL tests. The browser
script additionally uses esbuild, playwright 1.51.1 and @sparticuz/chromium 133
in that external test folder and expects a completed main-app production build. Preserve the
original ZIPs and database backup. Before live launch, cancelling the schedule
returns to the legacy public offer. After launch, use a reviewed compatible
forward fix; do not delete billing configuration, reset subscription dates or
roll back only the client to code that quotes old prices.

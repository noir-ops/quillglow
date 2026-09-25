# Disbursement Rails — Current State (Phase 1)

Four rails. Rails 1, 2, and 3 each carry more than one registered
provider — only one is ever "active" at a time per rail, switchable from
`/admin/disbursements` with zero deploy.

| Rail | Purpose | Registered providers | Active |
|---|---|---|---|
| 0 | Scholarship ledger (Postgres) | N/A | N/A |
| 1 | Controlled Student Benefits (gift cards) | Tremendous, Runa | Tremendous |
| 2 | Institutional Funding | Stripe Connect, Trolley, Airwallex | Stripe Connect |
| 3 | Recipient/Guardian Payout | Stripe Connect, Trolley, Airwallex | Stripe Connect |
| 4 | Blockchain/Stablecoin Payout (future use) | Circle | Circle |

Real choice between providers on Rails 2/3 — negotiating leverage,
geographic coverage, a fallback if one provider has an outage — is the
point of this architecture. Stripe Connect being active today doesn't
mean the Trolley or Airwallex adapters go away; they're registered and
ready, just not the default.

## What changed this round

**Trolley and Airwallex restored** on Rails 2/3 as registered, inactive
options (migration 043). Trolley's client (`lib/trolley/index.ts`) is the
fully working, previously-verified version — same HMAC signing, same
recipient/payment/onboarding-link functions as before. Airwallex remains
a structural stub (was never built out, per the earlier "Stripe moves the
money" launch decision) — registered so switching to it later, or
comparing it against the active provider, doesn't require new
architecture.

**`disbursement_providers` gained a real uniqueness constraint** on
`(rail, provider_key)`. Earlier seed migrations relied on bare
`ON CONFLICT DO NOTHING` with no matching constraint to actually catch a
re-run — migration 043 adds the constraint (cleaning up any pre-existing
duplicates first) so every future seed insert is genuinely idempotent,
not just written to look that way.

**The `PayoutProvider` interface gained `getOnboardingUrl?()`.** With two
onboarding-requiring providers now live on the same rail (Stripe Connect,
Trolley), the internal cross-app onboarding-link endpoint
(`/api/internal/payout-onboarding-link`) could no longer hardcode "call
Stripe's client" — it now resolves via `getActiveProvider(rail)` and
calls whichever provider is active. This also let the pre-flight
readiness check inside each adapter's own `createPayout()` stop
duplicating onboarding-link logic — both Stripe's and Trolley's adapters
now call their own `getOnboardingUrl()` instead of inlining it twice.

**The redeem dialog's onboarding-link detection** (`extractOnboardingUrl`
in `components/wallet/redeem-dialog.tsx`) now matches either
`connect.stripe.com` or `widget.trolley.com` — previously it only matched
Stripe's domain, which would have silently shown a raw error dump instead
of a "Complete payout setup" button the moment Trolley became active.

## Env vars

```bash
# Rail 1
TREMENDOUS_API_KEY=...
TREMENDOUS_FUNDING_SOURCE_ID=...
RUNA_API_KEY=...              # optional — Tremendous stays active until switched

# Rails 2/3 — Stripe Connect (active)
STRIPE_SECRET_KEY=sk_...

# Rails 2/3 — Trolley (registered, inactive)
TROLLEY_API_KEY=...
TROLLEY_API_SECRET=...

# Rails 2/3 — Airwallex (registered, inactive, stub only)
AIRWALLEX_API_KEY=...
AIRWALLEX_CLIENT_ID=...

# Rail 4 — Circle (future use, no live caller)
CIRCLE_API_KEY=...
CIRCLE_SOURCE_WALLET_ID=...

# Cross-app onboarding-link calls (admin → quillglow-main)
INTERNAL_API_SECRET=<same value in both apps>
QUILLGLOW_APP_URL=https://<quillglow-main deployment URL>   # admin app only
```

## What did NOT change

- The registry/adapter/execute pattern itself.
- The ledger.
- Rail 4's future-use status — Circle scaffolding, no live caller, unchanged from last round.

## Still open (needs its own scope)

**Mentor/Parent account setup** — unchanged from last round: needs which
app(s) it lives in, permissions, and how the student relationship is
established before it can be built.

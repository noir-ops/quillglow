# Family Wallet — Guardian-Funded Student Purchases

A second, distinct wallet from the scholarship one. A **family**-linked
parent/guardian (never a mentor) can fund a purchase balance for their
own child's spending on QuillGlow — the Genius plan, shop items. Nothing
here touches scholarship money, and nothing here changes the existing
"mentors don't control funds" or "guardians only view disbursement
status" boundaries — this is a different pot of money for a different
purpose, funded by the adult themselves.

## The flow

1. Guardian portal, `/wallet` → Family Wallet section → **Add funds** →
   redirected to a plain Stripe Checkout Session (not Connect — this
   money stays on the platform's own Stripe balance)
2. On return, `/api/family-wallet/confirm` verifies the session actually
   paid, then calls `topup_family_wallet()` (050), keyed by the Stripe
   session id so a page refresh can never double-credit
3. Student side, quillglow-main's `/upgrade` or `/shop` → sees a "pay with
   family balance" option if they have a family wallet with a positive
   balance → charges via `charge_family_wallet()`, at a price the
   **server** determines (`$4.99` Genius, `$0.99` Study Tracker — never
   read from the client), never the amount the client happens to send
4. On successful charge, the exact same fulfillment the Polar flow uses
   runs (same `subscriptions` upsert shape, same `study_tracker_orders`
   insert shape) — only the payment rail differs

## Why only family links

Same reasoning already established elsewhere in this platform: a mentor
relationship is about active review and guidance, not money. That
boundary is enforced in `topup_family_wallet()` itself (raises an
exception if the link isn't `family` type), not just left to the UI to
prevent.

## Schema

`scripts/050_family_wallet.sql` — `family_wallets`, `family_wallet_transactions`,
`family_wallet_checkouts`, plus `topup_family_wallet()` and
`charge_family_wallet()`. Both functions re-validate who's allowed to do
what (the linked adult for top-ups, the linked student for charges)
server-side, rather than relying on RLS alone for a money-moving
operation.

## Env vars

```bash
# quillglow_guardian-main — new, this app's first payment integration
STRIPE_SECRET_KEY=sk_...

# quillglow-main — none needed; charge_family_wallet is called via the
# authenticated student's own Supabase session (supabase.rpc), not a
# service-role call, so no new credentials are required here
```

## What this does NOT do

- Does not touch `wallets` / `wallet_transactions` (scholarship money) in any way
- Does not give mentors any financial capability
- Does not let a client supply the charge amount — every purchase route
  reads its price from a fixed constant or the `PRODUCTS` catalog, never
  the request body
- Does not pool multiple family wallets — a student with two linked
  parents has two separate balances, spent from independently, so it's
  always traceable whose money paid for what

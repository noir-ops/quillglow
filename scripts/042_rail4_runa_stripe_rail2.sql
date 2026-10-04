-- Phase 1 rail expansion:
--   Rail 1 — register Runa as a second gift-card provider (Tremendous stays active)
--   Rail 2 — confirm Stripe Connect is present and active, matching Rail 3's setup exactly
--   Rail 4 — new rail: Blockchain/Stablecoin Payout, provider Circle (future use —
--            not exposed in any student/admin flow yet; integration scaffolding only)
--
-- Nothing here touches the ledger, execute.ts, or any existing rail's
-- runtime behavior — additive only, same principle the last several
-- migrations in this sequence have followed.

insert into public.disbursement_rails (rail, name, purpose) values
  (4, 'Blockchain/Stablecoin Payout', 'USDC/stablecoin payout directly to a recipient-controlled wallet address. Future capability — not yet exposed in any student, benefactor, or admin-facing flow; integration surface only.')
on conflict (rail) do update set name = excluded.name, purpose = excluded.purpose;

-- Rail 1: Runa registered but inactive — Tremendous keeps serving live
-- traffic until this is deliberately switched on in /admin/disbursements.
insert into public.disbursement_providers (rail, provider_key, display_name, is_active) values
  (1, 'runa', 'Runa', false)
on conflict do nothing;

-- Rail 2: ensure Stripe Connect is present and active — matching Rail 3's
-- current setup exactly (both rails run on the same provider, same as
-- they have since 040). This is idempotent: if it's already there and
-- active, this changes nothing.
insert into public.disbursement_providers (rail, provider_key, display_name, is_active) values
  (2, 'stripe_connect', 'Stripe Connect', true)
on conflict do nothing;

update public.disbursement_providers set is_active = true
where rail = 2 and provider_key = 'stripe_connect';

-- Rail 4: Circle registered as the sole option. Marked active for
-- visual/structural consistency with how every other rail's sole current
-- option is displayed in the admin panel (a single "Active" badge, no
-- decision to make yet) — this has no functional effect today, since no
-- route calls getActiveProvider(4). The adapter itself (lib/payouts/
-- providers/circle.ts) still requires CIRCLE_API_KEY and
-- CIRCLE_SOURCE_WALLET_ID to do anything, and its transfer function is a
-- deliberate placeholder pending entity-secret ciphertext support — see
-- that file for what's actually missing.
insert into public.disbursement_providers (rail, provider_key, display_name, is_active) values
  (4, 'circle', 'Circle', true)
on conflict do nothing;

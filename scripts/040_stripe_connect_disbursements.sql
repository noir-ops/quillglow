-- Strategic decision: "Stripe moves the money." Trolley is removed (pricing
-- principles); Airwallex is deliberately not added at launch. Rails 2
-- (institutional funding) and 3 (recipient/guardian payout) both run on
-- Stripe Connect now — one external financial infrastructure provider,
-- one integration to maintain, one vendor relationship to negotiate.
--
-- This is a DATA change, not an architecture change — that's the entire
-- point of the rail/provider split from 038. Nothing in the wallet route,
-- the ledger functions, or the redeem UI needed to change for this swap;
-- only which row is_active in disbursement_providers, and which adapter
-- the registry resolves it to.

delete from public.disbursement_providers where provider_key in ('trolley', 'airwallex');

insert into public.disbursement_providers (rail, provider_key, display_name, is_active) values
  (2, 'stripe_connect', 'Stripe Connect', true),
  (3, 'stripe_connect', 'Stripe Connect', true)
on conflict do nothing;

-- Belt-and-suspenders: make sure exactly one active provider per rail 2/3
-- survives the swap above (in case this migration runs against a database
-- where a manual edit already changed something).
update public.disbursement_providers set is_active = false
where rail in (2, 3) and provider_key <> 'stripe_connect';
update public.disbursement_providers set is_active = true
where rail in (2, 3) and provider_key = 'stripe_connect';

-- Stripe Connect account cache, shared by rail 2 (institutions — "company"
-- business_type) and rail 3 (students/guardians — "individual"). Keyed by
-- email, same reasoning as the old Trolley referenceId lookup: a repeat
-- redemption or institutional payment always resolves to the same
-- connected account instead of creating a duplicate on every request.
create table if not exists public.stripe_connected_accounts (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  name text,
  rail smallint not null references public.disbursement_rails(rail),
  stripe_account_id text not null unique,
  payouts_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.stripe_connected_accounts enable row level security;
-- Service-role only, no client policies — mirrors disbursement_providers (038).

create index if not exists stripe_connected_accounts_rail_idx on public.stripe_connected_accounts (rail);

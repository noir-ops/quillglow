-- Platform fees on scholarship funding: a technology fee and a processing
-- fee, added on top of the scholarship amount a benefactor intends to fund,
-- plus a disclosure of the payment provider's own fee (Polar) so benefactors
-- understand the full cost stack before paying.
--
-- Example: benefactor wants to fund a $500 scholarship.
--   Scholarship            $500.00
--   Technology fee (1.5%)    $7.50
--   Processing fee (1.0%)    $5.00
--   Total before provider fees   $512.50
--   (+ Polar's own processing fee, charged on the $512.50, disclosed but not
--     collected by this platform — see provider_fee_pct_estimate below)
--
-- Rates are admin-configurable, not hardcoded, for the same reason every
-- other rate in this system is: they change (Polar's own rates changed
-- twice in 2026), and a rate change should never require a deploy.

create table if not exists public.platform_fee_settings (
  id text primary key default 'global',
  tech_fee_pct numeric(6,4) not null default 1.50,        -- percent, e.g. 1.50 = 1.5%
  processing_fee_pct numeric(6,4) not null default 1.00,
  -- The payment provider's own fee is NOT collected by QuillGlow and isn't
  -- added to the charged total — it's disclosed only, since Polar deducts
  -- it from the payout to QuillGlow, not from what the benefactor pays.
  -- Kept here (not hardcoded in the UI) so it can be corrected the moment
  -- Polar's published rate changes, without a code deploy.
  provider_name text not null default 'Polar',
  provider_fee_pct_estimate numeric(6,4) not null default 4.00,
  provider_fee_fixed_estimate numeric(8,2) not null default 0.40,
  disclosure_note text not null default
    'Polar, our payment processor, deducts its own processing fee from this transaction. The estimate above is approximate and may vary by card type, currency, and region — see polar.sh/resources/pricing for current rates.',
  updated_at timestamptz not null default now(),
  updated_by uuid
);

insert into public.platform_fee_settings (id) values ('global') on conflict (id) do nothing;

-- Locked down like ai_provider_settings (014): no anon/authenticated
-- policies at all, so only the service role (admin panel writes, benefactor
-- app's server-side fee-settings route reads) can touch this table.
alter table public.platform_fee_settings enable row level security;

create or replace function public.set_platform_fee_settings_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_platform_fee_settings_updated_at on public.platform_fee_settings;
create trigger trg_platform_fee_settings_updated_at
  before update on public.platform_fee_settings
  for each row execute function public.set_platform_fee_settings_updated_at();

-- Record the fee breakdown on each deposit for accounting/reconciliation.
-- `amount` (the existing column, from 032) stays exactly what it always
-- was — the scholarship principal, and the only thing confirm_fund_deposit
-- credits to the wallet. These new columns are additive: they record what
-- was actually charged via Polar, without changing what gets credited.
alter table public.fund_deposit_checkouts
  add column if not exists tech_fee numeric(12,2) not null default 0,
  add column if not exists processing_fee numeric(12,2) not null default 0,
  add column if not exists total_charged numeric(12,2);

-- Backfill total_charged for any pre-existing rows (fee-less era) so it's
-- never null going forward.
update public.fund_deposit_checkouts
set total_charged = amount
where total_charged is null;

alter table public.fund_deposit_checkouts alter column total_charged set not null;

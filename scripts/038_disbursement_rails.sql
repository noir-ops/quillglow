-- Provider independence for disbursement. Before this migration, "how a
-- student gets paid" and "Tremendous" were the same thing — the wallet
-- route imported lib/tremendous directly and payout_orders had columns
-- named tremendous_order_id. This migration makes the provider a runtime
-- lookup instead of a compile-time import, across three rails:
--   Rail 1 — Controlled Student Benefits (gift cards, prepaid cards)
--   Rail 2 — Institutional Funding (tuition paid direct to a school)
--   Rail 3 — Recipient/Guardian Payout (real cash — bank/PayPal)
-- Rail 0 (the scholarship ledger itself) is Postgres — wallets/
-- wallet_transactions, already built — not a provider at all.

create table if not exists public.disbursement_rails (
  rail smallint primary key,
  name text not null,
  purpose text not null
);

insert into public.disbursement_rails (rail, name, purpose) values
  (0, 'Scholarship Ledger', 'Internal source of truth — balances, allocations, restrictions, releases, reconciliation. Not a payment provider.'),
  (1, 'Controlled Student Benefits', 'Wallet, marketplace credit, vouchers, e-gift cards — student redeems directly.'),
  (2, 'Institutional Funding', 'Tuition, fees, books, approved institutional expenses — paid straight to the school, never touches the student.'),
  (3, 'Recipient/Guardian Payout', 'Stipends, living expenses, approved personal support — real cash to a verified recipient or guardian.')
on conflict (rail) do update set name = excluded.name, purpose = excluded.purpose;

-- The actual switch. Changing which provider handles a rail is a row
-- update here, not a deploy — that's the whole point of this migration.
-- Only one provider may be active per rail at a time; others are kept as
-- rows so a rollback is also just a row update.
create table if not exists public.disbursement_providers (
  id uuid primary key default gen_random_uuid(),
  rail smallint not null references public.disbursement_rails(rail),
  provider_key text not null,          -- 'tremendous', 'trolley', 'airwallex', 'stripe_connect' — matches lib/payouts/registry.ts ADAPTERS keys
  display_name text not null,
  is_active boolean not null default false,
  config jsonb not null default '{}',  -- provider-specific non-secret config (secrets stay in env vars)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Only one active provider per rail.
create unique index if not exists disbursement_providers_one_active_per_rail
  on public.disbursement_providers (rail) where is_active;

alter table public.disbursement_providers enable row level security;
-- No client policies at all — this is platform configuration, service-role only.

insert into public.disbursement_providers (rail, provider_key, display_name, is_active) values
  (1, 'tremendous', 'Tremendous', true),
  (2, 'trolley', 'Trolley', false),
  (2, 'airwallex', 'Airwallex', false),
  (3, 'trolley', 'Trolley', true),
  (3, 'airwallex', 'Airwallex', false),
  (3, 'stripe_connect', 'Stripe Connect', false)
on conflict do nothing;

-- Generic columns replace the Tremendous-named ones. The old
-- tremendous_order_id / tremendous_reward_id columns are left in place
-- (deprecated, unused going forward) rather than dropped, since dropping
-- columns on a table that may already have rows is a needless risk for
-- zero benefit at this stage.
alter table public.payout_orders
  add column if not exists rail smallint not null default 1 references public.disbursement_rails(rail),
  add column if not exists provider_key text,
  add column if not exists provider_payout_id text,
  add column if not exists provider_secondary_id text;

comment on column public.payout_orders.tremendous_order_id is 'Deprecated — use provider_payout_id. Kept only for rows written before 038.';
comment on column public.payout_orders.tremendous_reward_id is 'Deprecated — use provider_secondary_id. Kept only for rows written before 038.';

create index if not exists payout_orders_rail_idx on public.payout_orders (rail);

-- request_payout() gains a rail parameter but its actual job is unchanged:
-- debit the ledger and reserve a pending order row atomically. It still
-- knows NOTHING about which provider will fulfill the order — that's
-- decided at call time by lib/payouts/registry.ts, after this function
-- returns.
create or replace function public.request_payout(
  p_user_id uuid,
  p_amount numeric,
  p_currency text,
  p_delivery_method text,
  p_product_id text,
  p_recipient_email text,
  p_recipient_name text,
  p_idempotency_key text,
  p_rail smallint default 1
)
returns table (payout_order_id uuid, balance numeric, duplicate boolean)
language plpgsql security definer set search_path = public as $$
declare
  v_existing uuid;
  v_tx record;
  v_new_id uuid;
begin
  if p_idempotency_key is not null then
    select id into v_existing from public.payout_orders where idempotency_key = p_idempotency_key;
    if v_existing is not null then
      return query
      select po.id, w.balance_cached, true
      from public.payout_orders po
      join public.wallets w on w.user_id = po.user_id
      where po.id = v_existing;
      return;
    end if;
  end if;

  select * into v_tx from public.post_wallet_transaction(
    p_user_id, -p_amount, 'reward', 'Payout: ' || p_delivery_method,
    'payout_order', null, p_idempotency_key
  );

  insert into public.payout_orders (
    user_id, wallet_transaction_id, amount, currency, delivery_method,
    product_id, recipient_email, recipient_name, idempotency_key, rail
  ) values (
    p_user_id, v_tx.transaction_id, p_amount, p_currency, p_delivery_method,
    p_product_id, p_recipient_email, p_recipient_name, p_idempotency_key, p_rail
  )
  returning id into v_new_id;

  update public.wallet_transactions set reference_id = v_new_id::text
  where id = v_tx.transaction_id;

  return query select v_new_id, v_tx.balance, false;
end;
$$;

grant execute on function public.request_payout(uuid, numeric, text, text, text, text, text, text, smallint) to authenticated;

-- Generic replacement for mark_payout_order_created — stores provider_key
-- + provider_payout_id instead of assuming Tremendous.
create or replace function public.mark_payout_order_fulfilled(
  p_payout_order_id uuid,
  p_provider_key text,
  p_provider_payout_id text,
  p_provider_secondary_id text,
  p_redemption_url text
)
returns void
language sql security definer set search_path = public as $$
  update public.payout_orders
  set status = 'created',
      provider_key = p_provider_key,
      provider_payout_id = p_provider_payout_id,
      provider_secondary_id = p_provider_secondary_id,
      redemption_url = p_redemption_url,
      updated_at = now()
  where id = p_payout_order_id;
$$;

grant execute on function public.mark_payout_order_fulfilled(uuid, text, text, text, text) to authenticated;

-- fail_payout_order(...) from 037 is unchanged — refund logic never
-- touched providers to begin with.

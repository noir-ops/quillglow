-- Milestone: turning wallet balance into something a student can actually
-- spend. Polar only handles money coming IN from benefactors; it has no
-- payout/rewards rail. This closes the other half via Tremendous — prepaid
-- Visa/Mastercard virtual cards and Apple/Google Play gift cards, delivered
-- by email, no recipient KYC required (only the platform does KYB once,
-- outside this codebase, in the Tremendous dashboard).

create table if not exists public.payout_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  -- The debit that funded this payout. One-to-one: a payout_orders row only
  -- ever exists because a wallet_transactions debit already happened.
  wallet_transaction_id bigint references public.wallet_transactions(id),
  amount numeric(12,2) not null check (amount > 0),
  currency text not null default 'USD',
  -- 'reward' = prepaid Visa/Mastercard, 'gift_card' = Apple/Google Play etc.
  delivery_method text not null check (delivery_method in ('reward', 'gift_card')),
  product_id text,                 -- Tremendous products.id chosen, if a specific card
  recipient_email text not null,
  recipient_name text,
  status text not null default 'pending'
    check (status in ('pending', 'created', 'delivered', 'failed', 'cancelled')),
  tremendous_order_id text,
  tremendous_reward_id text,
  redemption_url text,             -- where the student claims the card
  failure_reason text,
  idempotency_key text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists payout_orders_user_idx on public.payout_orders (user_id, created_at desc);
create index if not exists payout_orders_status_idx on public.payout_orders (status) where status in ('pending', 'created');

alter table public.payout_orders enable row level security;

drop policy if exists "users read own payout orders" on public.payout_orders;
create policy "users read own payout orders" on public.payout_orders
  for select to authenticated using (auth.uid() = user_id);
-- No client write policies — rows are created and updated server-side only,
-- via the service role, mirroring fund_deposit_checkouts (032).

/**
 * Step 1 of 2 for a payout: atomically debit the wallet and reserve a
 * 'pending' payout_orders row in the SAME transaction, so a debit can never
 * exist without a corresponding order record (and vice versa).
 *
 * This does NOT talk to Tremendous — that happens server-side afterward.
 * If the Tremendous API call then fails, the caller must call
 * fail_payout_order() below, which refunds the debit and marks the row
 * 'failed'. If it succeeds, the caller calls mark_payout_order_created().
 */
create or replace function public.request_payout(
  p_user_id uuid,
  p_amount numeric,
  p_currency text,
  p_delivery_method text,
  p_product_id text,
  p_recipient_email text,
  p_recipient_name text,
  p_idempotency_key text
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

  -- Reuses the same ledger primitive as every other debit (033, 030) —
  -- insufficient-funds and wallet-status checks live in exactly one place.
  select * into v_tx from public.post_wallet_transaction(
    p_user_id, -p_amount, 'reward', 'Payout: ' || p_delivery_method,
    'payout_order', null, p_idempotency_key
  );

  insert into public.payout_orders (
    user_id, wallet_transaction_id, amount, currency, delivery_method,
    product_id, recipient_email, recipient_name, idempotency_key
  ) values (
    p_user_id, v_tx.transaction_id, p_amount, p_currency, p_delivery_method,
    p_product_id, p_recipient_email, p_recipient_name, p_idempotency_key
  )
  returning id into v_new_id;

  -- Back-fill reference_id now that the order row exists (chicken/egg: the
  -- debit needs to happen first to get transaction_id for wallet_transaction_id above).
  update public.wallet_transactions set reference_id = v_new_id::text
  where id = v_tx.transaction_id;

  return query select v_new_id, v_tx.balance, false;
end;
$$;

grant execute on function public.request_payout(uuid, numeric, text, text, text, text, text, text) to authenticated;

/** Step 2a: Tremendous order succeeded — attach its ids and mark delivered. */
create or replace function public.mark_payout_order_created(
  p_payout_order_id uuid,
  p_tremendous_order_id text,
  p_tremendous_reward_id text,
  p_redemption_url text
)
returns void
language sql security definer set search_path = public as $$
  update public.payout_orders
  set status = 'created',
      tremendous_order_id = p_tremendous_order_id,
      tremendous_reward_id = p_tremendous_reward_id,
      redemption_url = p_redemption_url,
      updated_at = now()
  where id = p_payout_order_id;
$$;

/**
 * Step 2b: Tremendous order failed — refund the debit (a real credit, not a
 * delete, so the ledger stays a true append-only history of what happened)
 * and mark the order failed.
 */
create or replace function public.fail_payout_order(
  p_payout_order_id uuid,
  p_reason text
)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_order record;
begin
  select * into v_order from public.payout_orders where id = p_payout_order_id for update;
  -- NOT FOUND rather than `v_order is null` — a record variable after a
  -- zero-row SELECT INTO isn't NULL as a whole, so the original check
  -- never caught a missing row and the status comparison below would have
  -- failed on a NULL field access instead of returning cleanly. This is
  -- the refund path, so a confusing failure here means a stranded wallet
  -- debit — worth getting exactly right.
  if not found or v_order.status <> 'pending' then
    return; -- already resolved or not found — safe no-op, mirrors idempotent design elsewhere
  end if;

  perform public.post_wallet_transaction(
    v_order.user_id, v_order.amount, 'refund', 'Payout failed: ' || coalesce(p_reason, 'unknown'),
    'payout_order', p_payout_order_id::text,
    'payout_refund:' || p_payout_order_id::text
  );

  update public.payout_orders
  set status = 'failed', failure_reason = p_reason, updated_at = now()
  where id = p_payout_order_id;
end;
$$;

grant execute on function public.mark_payout_order_created(uuid, text, text, text) to authenticated;
grant execute on function public.fail_payout_order(uuid, text) to authenticated;

-- Polar-backed fund deposits, without a webhook.
--
-- Flow: create a Polar checkout for a specific amount, record it as pending
-- HERE (server-side, before the customer ever sees a payment page), redirect
-- to Polar, and when the customer lands back on our success URL, verify the
-- checkout server-side against Polar's own API before crediting anything.
--
-- The amount credited always comes from THIS table — the row we wrote at
-- checkout-creation time — never from a query parameter or anything the
-- client could have modified on the way back from Polar. A tampered
-- ?amount=999999 in the URL has nothing to attach to.

create table if not exists public.fund_deposit_checkouts (
  checkout_id text primary key,          -- Polar's checkout id
  user_id uuid not null references auth.users(id) on delete cascade,
  amount numeric(12,2) not null check (amount > 0),
  currency text not null default 'usd',
  status text not null default 'pending'
    check (status in ('pending', 'confirmed', 'expired', 'failed')),
  created_at timestamptz not null default now(),
  confirmed_at timestamptz
);

create index if not exists fund_deposit_checkouts_user_idx
  on public.fund_deposit_checkouts (user_id, created_at desc);

alter table public.fund_deposit_checkouts enable row level security;

drop policy if exists "users read own deposit checkouts" on public.fund_deposit_checkouts;
create policy "users read own deposit checkouts" on public.fund_deposit_checkouts
  for select to authenticated using (auth.uid() = user_id);
-- No client write policies — rows are created and confirmed server-side only,
-- using the service role, so a client can never insert a fake "confirmed" row.

/**
 * Confirm a Polar checkout and credit the wallet — the ONLY place that turns
 * a Polar payment into wallet balance.
 *
 * Security properties, each backed by a test:
 *   1. The checkout must belong to the calling user (p_user_id must match the
 *      row created at checkout time) — prevents crediting account A's wallet
 *      by replaying account B's checkout id.
 *   2. The amount credited is read from THIS table, set at checkout creation,
 *      never passed in by the caller here — there is no amount parameter.
 *   3. Idempotent via the checkout_id itself as the wallet idempotency key —
 *      confirming the same checkout twice (e.g. a page refresh after
 *      returning from Polar) cannot double-credit.
 *   4. Only moves from 'pending' to 'confirmed' once — a second call against
 *      an already-confirmed row is a safe no-op, not a re-credit.
 *
 * The caller (application code) is responsible for verifying checkout.status
 * with Polar's API BEFORE calling this — this function trusts that the
 * caller already confirmed payment; it does not talk to Polar itself.
 */
create or replace function public.confirm_fund_deposit(
  p_checkout_id text,
  p_user_id uuid
)
returns table (balance numeric, amount_credited numeric, duplicate boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row record;
  v_deposit record;
begin
  select * into v_row
  from public.fund_deposit_checkouts
  where checkout_id = p_checkout_id
  for update;

  if v_row is null then
    raise exception 'Unknown checkout';
  end if;

  if v_row.user_id <> p_user_id then
    raise exception 'This checkout does not belong to the current user';
  end if;

  if v_row.status = 'confirmed' then
    -- Already processed — return the existing wallet balance rather than
    -- re-crediting. Safe to call this repeatedly (e.g. the success page
    -- re-running its confirm call on a refresh).
    return query
    select w.balance_cached, v_row.amount, true
    from public.wallets w where w.user_id = p_user_id;
    return;
  end if;

  select * into v_deposit from public.benefactor_deposit_funds(
    p_user_id, v_row.amount, 'Polar deposit', 'polar_checkout:' || p_checkout_id
  );

  update public.fund_deposit_checkouts
  set status = 'confirmed', confirmed_at = now()
  where checkout_id = p_checkout_id;

  return query select v_deposit.balance, v_row.amount, v_deposit.duplicate;
end;
$$;

grant execute on function public.confirm_fund_deposit(text, uuid) to authenticated;

-- A second, distinct wallet: a guardian-funded balance a linked FAMILY
-- student can spend on their own purchases (Genius plan, shop items).
-- This is NOT the scholarship wallet (031/032/037) and does not touch it
-- — different money, different purpose, different table entirely. It's
-- also deliberately family-only: mentor-type links get no wallet, same
-- boundary already enforced elsewhere ("mentor should not control
-- funds") — here extended to "does not fund purchases" for the same
-- reason, even though this isn't scholarship money.
--
-- Funded via Stripe (plain Checkout Session, not Connect — this money
-- stays with the platform's own balance, then is credited internally to
-- the family wallet ledger; nothing is transferred out anywhere).

create table if not exists public.family_wallets (
  id uuid primary key default gen_random_uuid(),
  guardian_link_id uuid not null unique references public.guardian_links(id) on delete cascade,
  -- Denormalized (not just derivable via guardian_link_id) for the same
  -- reason guardian_links.student_user_id points at profiles directly:
  -- PostgREST needs a direct FK to embed `trusted_adults:adult_user_id(...)`
  -- and `profiles:student_user_id(...)` without a second round trip.
  adult_user_id uuid not null references public.trusted_adults(user_id) on delete cascade,
  student_user_id uuid not null references public.profiles(id) on delete cascade,
  balance_cached numeric(12,2) not null default 0,
  currency text not null default 'usd',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists family_wallets_adult_idx on public.family_wallets (adult_user_id);
create index if not exists family_wallets_student_idx on public.family_wallets (student_user_id);

alter table public.family_wallets enable row level security;

drop policy if exists "adult reads own family wallet" on public.family_wallets;
create policy "adult reads own family wallet" on public.family_wallets
  for select to authenticated using (auth.uid() = adult_user_id);

drop policy if exists "student reads own family wallet" on public.family_wallets;
create policy "student reads own family wallet" on public.family_wallets
  for select to authenticated using (auth.uid() = student_user_id);
-- No client write policies at all — balance changes only happen through
-- topup_family_wallet / charge_family_wallet below, both SECURITY DEFINER,
-- both re-validating who's allowed to do what rather than trusting RLS
-- alone for a money-moving operation.

create table if not exists public.family_wallet_transactions (
  id bigserial primary key,
  family_wallet_id uuid not null references public.family_wallets(id) on delete cascade,
  amount numeric(12,2) not null, -- positive = credit (topup/refund), negative = debit (purchase)
  balance_after numeric(12,2) not null,
  type text not null check (type in ('topup', 'purchase', 'refund')),
  description text,
  reference_type text, -- 'subscription' | 'shop_order' | ...
  reference_id text,
  created_by_user_id uuid references auth.users(id),
  idempotency_key text unique,
  created_at timestamptz not null default now()
);

create index if not exists family_wallet_transactions_wallet_idx on public.family_wallet_transactions (family_wallet_id, created_at desc);

alter table public.family_wallet_transactions enable row level security;

drop policy if exists "wallet participants read transactions" on public.family_wallet_transactions;
create policy "wallet participants read transactions" on public.family_wallet_transactions
  for select to authenticated using (
    exists (
      select 1 from public.family_wallets fw
      where fw.id = family_wallet_id
        and (fw.adult_user_id = auth.uid() or fw.student_user_id = auth.uid())
    )
  );

-- Pending Stripe Checkout Sessions for top-ups — mirrors the
-- fund_deposit_checkouts pattern (032): written server-side before the
-- adult ever reaches Stripe's page, so by the time they're redirected the
-- amount that will be credited is already fixed in the database, tied to
-- their user id. Nothing coming back through the browser can change it.
create table if not exists public.family_wallet_checkouts (
  id uuid primary key default gen_random_uuid(),
  stripe_session_id text not null unique,
  guardian_link_id uuid not null references public.guardian_links(id) on delete cascade,
  adult_user_id uuid not null references auth.users(id) on delete cascade,
  amount numeric(12,2) not null,
  currency text not null default 'usd',
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'failed')),
  created_at timestamptz not null default now(),
  confirmed_at timestamptz
);

alter table public.family_wallet_checkouts enable row level security;

drop policy if exists "adult reads own family wallet checkouts" on public.family_wallet_checkouts;
create policy "adult reads own family wallet checkouts" on public.family_wallet_checkouts
  for select to authenticated using (auth.uid() = adult_user_id);
-- No client write policies — written by the checkout route with the
-- admin client, same reasoning as fund_deposit_checkouts.

/**
 * The core ledger primitive both topup and charge go through — one place
 * that updates balance_cached and records the transaction, so the two
 * numbers can never drift apart. NOT exposed to clients directly.
 */
create or replace function public.post_family_wallet_transaction(
  p_family_wallet_id uuid,
  p_amount numeric,
  p_type text,
  p_description text,
  p_reference_type text,
  p_reference_id text,
  p_created_by_user_id uuid,
  p_idempotency_key text
)
returns table (out_transaction_id bigint, out_balance numeric, out_duplicate boolean)
language plpgsql security definer set search_path = public as $$
declare
  v_wallet record;
  v_new_balance numeric;
  v_existing_id bigint;
  v_tx_id bigint;
begin
  if p_idempotency_key is not null then
    select id into v_existing_id from public.family_wallet_transactions ft where ft.idempotency_key = p_idempotency_key;
    if v_existing_id is not null then
      select ft.balance_after into v_new_balance from public.family_wallet_transactions ft where ft.id = v_existing_id;
      return query select v_existing_id, v_new_balance, true;
      return;
    end if;
  end if;

  select * into v_wallet from public.family_wallets fw where fw.id = p_family_wallet_id for update;
  if not found then
    raise exception 'Family wallet not found';
  end if;

  v_new_balance := v_wallet.balance_cached + p_amount;
  if v_new_balance < 0 then
    raise exception 'Insufficient family wallet balance';
  end if;

  insert into public.family_wallet_transactions (
    family_wallet_id, amount, balance_after, type, description,
    reference_type, reference_id, created_by_user_id, idempotency_key
  ) values (
    p_family_wallet_id, p_amount, v_new_balance, p_type, p_description,
    p_reference_type, p_reference_id, p_created_by_user_id, p_idempotency_key
  )
  returning id into v_tx_id;

  update public.family_wallets set balance_cached = v_new_balance, updated_at = now() where id = p_family_wallet_id;

  return query select v_tx_id, v_new_balance, false;
end;
$$;

/**
 * Called by the guardian portal after a Stripe Checkout Session confirms
 * payment. Only the linked adult can top up their own family link — and
 * only a 'family' link; a 'mentor' link has no wallet at all, enforced
 * here rather than only in the UI that would normally prevent it.
 * Creates the family_wallets row on first use.
 */
create or replace function public.topup_family_wallet(
  p_guardian_link_id uuid,
  p_amount numeric,
  p_idempotency_key text
)
returns table (out_wallet_id uuid, out_balance numeric, out_duplicate boolean)
language plpgsql security definer set search_path = public as $$
declare
  v_link record;
  v_wallet_id uuid;
  v_tx record;
begin
  if p_amount <= 0 then
    raise exception 'Top-up amount must be positive';
  end if;

  select * into v_link from public.guardian_links gl where gl.id = p_guardian_link_id and gl.status = 'active';
  if not found then
    raise exception 'Link not found or not active';
  end if;
  if v_link.link_type <> 'family' then
    raise exception 'Only family links can hold a purchase wallet';
  end if;
  if auth.uid() <> v_link.adult_user_id then
    raise exception 'Not authorized to fund this link';
  end if;

  insert into public.family_wallets (guardian_link_id, adult_user_id, student_user_id)
  values (p_guardian_link_id, v_link.adult_user_id, v_link.student_user_id)
  on conflict (guardian_link_id) do nothing;

  select id into v_wallet_id from public.family_wallets fw where fw.guardian_link_id = p_guardian_link_id;

  select * into v_tx from public.post_family_wallet_transaction(
    v_wallet_id, p_amount, 'topup', 'Family wallet top-up',
    'stripe_checkout', p_idempotency_key, auth.uid(), p_idempotency_key
  );

  return query select v_wallet_id, v_tx.out_balance, v_tx.out_duplicate;
end;
$$;

grant execute on function public.topup_family_wallet(uuid, numeric, text) to authenticated;

/**
 * Called by quillglow-main when a student pays for something with their
 * family balance. Only the linked STUDENT can spend it — an adult cannot
 * charge a wallet on the student's behalf, deliberately: this is the
 * student choosing to spend money that's been made available to them,
 * not the adult purchasing something and pushing it onto the student.
 */
create or replace function public.charge_family_wallet(
  p_family_wallet_id uuid,
  p_amount numeric,
  p_description text,
  p_reference_type text,
  p_reference_id text,
  p_idempotency_key text
)
returns table (out_balance numeric, out_duplicate boolean)
language plpgsql security definer set search_path = public as $$
declare
  v_wallet record;
  v_tx record;
begin
  if p_amount <= 0 then
    raise exception 'Charge amount must be positive';
  end if;

  select * into v_wallet from public.family_wallets fw where fw.id = p_family_wallet_id;
  if not found then
    raise exception 'Family wallet not found';
  end if;
  if auth.uid() <> v_wallet.student_user_id then
    raise exception 'Not authorized to spend from this wallet';
  end if;

  select * into v_tx from public.post_family_wallet_transaction(
    p_family_wallet_id, -p_amount, 'purchase', p_description,
    p_reference_type, p_reference_id, auth.uid(), p_idempotency_key
  );

  return query select v_tx.out_balance, v_tx.out_duplicate;
end;
$$;

grant execute on function public.charge_family_wallet(uuid, numeric, text, text, text, text) to authenticated;

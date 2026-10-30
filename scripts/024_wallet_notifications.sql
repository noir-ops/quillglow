-- Milestone 2 · Wallet + Notifications
--
-- Both are Platform Core services (shared by Learning, Scholarships and
-- Marketplace), not features of any one domain.

-- ── Wallet ──────────────────────────────────────────────────────────────────
-- Double-entry-ish: the balance is DERIVED from an append-only ledger, never
-- edited directly. A balance you can UPDATE is a balance you can corrupt, and
-- money bugs are unrecoverable without a transaction history.

create table if not exists public.wallets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  currency text not null default 'USD',
  -- Cached for fast reads; authoritative value is sum(wallet_transactions).
  balance_cached numeric(14,2) not null default 0,
  status text not null default 'active',  -- active | frozen | closed
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.wallets enable row level security;

drop policy if exists "users read own wallet" on public.wallets;
create policy "users read own wallet" on public.wallets
  for select to authenticated using (auth.uid() = user_id);

create table if not exists public.wallet_transactions (
  id bigserial primary key,
  wallet_id uuid not null references public.wallets(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  amount numeric(14,2) not null,          -- positive = credit, negative = debit
  balance_after numeric(14,2) not null,
  type text not null,
    -- scholarship_award | scholarship_disbursement | marketplace_purchase
    -- refund | reward | adjustment | topup
  reference_type text,                    -- opportunity | order | quest
  reference_id text,
  description text,
  -- Prevents double-crediting when a webhook or retry fires twice.
  idempotency_key text unique,
  created_at timestamptz not null default now()
);

create index if not exists wallet_tx_user_idx on public.wallet_transactions (user_id, created_at desc);
create index if not exists wallet_tx_wallet_idx on public.wallet_transactions (wallet_id, created_at desc);

alter table public.wallet_transactions enable row level security;

drop policy if exists "users read own transactions" on public.wallet_transactions;
create policy "users read own transactions" on public.wallet_transactions
  for select to authenticated using (auth.uid() = user_id);
-- No client write policies: money moves only through post_wallet_transaction().

create or replace function public.ensure_wallet(p_user_id uuid)
returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  insert into public.wallets (user_id) values (p_user_id)
  on conflict (user_id) do nothing;
  select id into v_id from public.wallets where user_id = p_user_id;
  return v_id;
end;
$$;

create or replace function public.post_wallet_transaction(
  p_user_id uuid,
  p_amount numeric,
  p_type text,
  p_description text default null,
  p_reference_type text default null,
  p_reference_id text default null,
  p_idempotency_key text default null
)
returns table (transaction_id bigint, balance numeric, duplicate boolean)
language plpgsql security definer set search_path = public as $$
declare
  v_wallet uuid;
  v_balance numeric;
  v_existing bigint;
  v_status text;
begin
  -- Replays return the original result instead of moving money twice.
  if p_idempotency_key is not null then
    select id into v_existing from public.wallet_transactions
    where idempotency_key = p_idempotency_key;
    if v_existing is not null then
      return query
      select t.id, t.balance_after, true
      from public.wallet_transactions t where t.id = v_existing;
      return;
    end if;
  end if;

  v_wallet := public.ensure_wallet(p_user_id);

  -- Lock the wallet so concurrent debits can't both pass the balance check.
  select balance_cached, status into v_balance, v_status
  from public.wallets where id = v_wallet for update;

  if v_status <> 'active' then
    raise exception 'Wallet is % and cannot transact', v_status;
  end if;

  if v_balance + p_amount < 0 then
    raise exception 'Insufficient funds: balance %, requested %', v_balance, p_amount;
  end if;

  v_balance := v_balance + p_amount;

  insert into public.wallet_transactions (
    wallet_id, user_id, amount, balance_after, type,
    reference_type, reference_id, description, idempotency_key
  ) values (
    v_wallet, p_user_id, p_amount, v_balance, p_type,
    p_reference_type, p_reference_id, p_description, p_idempotency_key
  )
  returning id into v_existing;

  update public.wallets
  set balance_cached = v_balance, updated_at = now()
  where id = v_wallet;

  return query select v_existing, v_balance, false;
end;
$$;

/** Rebuild the cached balance from the ledger. The ledger always wins. */
create or replace function public.reconcile_wallet(p_user_id uuid)
returns numeric
language plpgsql security definer set search_path = public as $$
declare v_sum numeric;
begin
  select coalesce(sum(amount), 0) into v_sum
  from public.wallet_transactions where user_id = p_user_id;

  update public.wallets set balance_cached = v_sum, updated_at = now()
  where user_id = p_user_id;

  return v_sum;
end;
$$;

grant execute on function public.ensure_wallet(uuid) to authenticated;

-- ── Notifications ───────────────────────────────────────────────────────────
create table if not exists public.notifications (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  channel text not null default 'in_app',   -- in_app | email | push
  category text not null,
    -- scholarship | learning | marketplace | account | system
  title text not null,
  body text,
  action_url text,
  read_at timestamptz,
  sent_at timestamptz,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_idx
  on public.notifications (user_id, created_at desc);
create index if not exists notifications_unread_idx
  on public.notifications (user_id) where read_at is null;

alter table public.notifications enable row level security;

drop policy if exists "users read own notifications" on public.notifications;
create policy "users read own notifications" on public.notifications
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "users mark own notifications read" on public.notifications;
create policy "users mark own notifications read" on public.notifications
  for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists public.notification_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email_scholarship boolean not null default true,
  email_learning boolean not null default true,
  email_marketplace boolean not null default false,
  push_enabled boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table public.notification_preferences enable row level security;

drop policy if exists "own notification preferences" on public.notification_preferences;
create policy "own notification preferences" on public.notification_preferences
  for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create or replace function public.send_notification(
  p_user_id uuid,
  p_category text,
  p_title text,
  p_body text default null,
  p_action_url text default null,
  p_channel text default 'in_app',
  p_metadata jsonb default '{}'::jsonb
)
returns bigint
language plpgsql security definer set search_path = public as $$
declare
  v_id bigint;
  v_allowed boolean := true;
begin
  -- Respect opt-outs for email; in-app is always delivered so a student never
  -- misses an award or deadline notice.
  if p_channel = 'email' then
    select case p_category
             when 'scholarship'  then coalesce(np.email_scholarship, true)
             when 'learning'     then coalesce(np.email_learning, true)
             when 'marketplace'  then coalesce(np.email_marketplace, false)
             else true
           end
    into v_allowed
    from public.notification_preferences np
    where np.user_id = p_user_id;

    v_allowed := coalesce(v_allowed, true);
    if not v_allowed then return null; end if;
  end if;

  insert into public.notifications (user_id, channel, category, title, body, action_url, metadata)
  values (p_user_id, p_channel, p_category, p_title, p_body, p_action_url, coalesce(p_metadata, '{}'::jsonb))
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.unread_notification_count(p_user_id uuid)
returns int
language sql stable security definer set search_path = public as $$
  select count(*)::int from public.notifications
  where user_id = p_user_id and read_at is null;
$$;

grant execute on function public.unread_notification_count(uuid) to authenticated;

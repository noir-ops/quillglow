-- Benefactor Fund Management
--
-- Per Image 1's spec: a benefactor deposits funds, allocates a portion to a
-- specific scholarship, and disburses money to individual approved
-- applicants. Every step is money movement, so it reuses the SAME
-- wallet ledger (024_wallet_notifications.sql) rather than inventing a
-- second, untested accounting system. A benefactor's wallet balance IS
-- "Total Funds Available."
--
-- What this migration adds on top of the wallet:
--   1. allocated_amount / disbursed_amount on opportunities (per-scholarship)
--   2. award_amount / payment tracking on opportunity_applications (per-applicant)
--   3. Functions that move money through post_wallet_transaction() so the
--      ledger stays the single source of truth for every dollar.

-- ── Per-scholarship allocation tracking ─────────────────────────────────────
alter table public.opportunities
  add column if not exists allocated_amount numeric(12,2) not null default 0,
  add column if not exists disbursed_amount numeric(12,2) not null default 0;

-- ── Per-applicant award + payment tracking ──────────────────────────────────
alter table public.opportunity_applications
  add column if not exists award_amount numeric(12,2),
  add column if not exists paid_amount numeric(12,2) not null default 0,
  add column if not exists paid_at timestamptz,
  add column if not exists payment_status text not null default 'unpaid'
    check (payment_status in ('unpaid', 'paid', 'partial'));

create index if not exists opportunity_applications_payment_idx
  on public.opportunity_applications (opportunity_id, payment_status);

-- ── Deposit funds into a benefactor's wallet ────────────────────────────────
-- Thin wrapper over post_wallet_transaction so the "Add Funds" button has a
-- single, named entry point. Idempotency key should be the payment provider's
-- event id, so a retried webhook can never double-credit.
create or replace function public.benefactor_deposit_funds(
  p_user_id uuid,
  p_amount numeric,
  p_description text default null,
  p_idempotency_key text default null
)
returns table (transaction_id bigint, balance numeric, duplicate boolean)
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_amount <= 0 then
    raise exception 'Deposit amount must be positive';
  end if;

  return query
  select * from public.post_wallet_transaction(
    p_user_id, p_amount, 'topup',
    coalesce(p_description, 'Fund deposit'),
    'benefactor_wallet', null, p_idempotency_key
  );
end;
$$;

-- ── Allocate funds from wallet to a specific scholarship ────────────────────
-- Moves money from "available" to "committed to this scholarship" — it does
-- NOT leave the benefactor's wallet (it's still their money until disbursed
-- to a student), so no wallet_transaction is posted here. Allocation is a
-- reservation, not a payment.
create or replace function public.allocate_scholarship_funds(
  p_benefactor_user_id uuid,
  p_opportunity_id uuid,
  p_amount numeric
)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  v_wallet_balance numeric;
  v_owns boolean;
begin
  select exists (
    select 1 from public.opportunities o
    join public.benefactors b on b.id = o.benefactor_id
    where o.id = p_opportunity_id and b.user_id = p_benefactor_user_id
  ) into v_owns;

  if not v_owns then
    raise exception 'Not authorized to allocate funds to this scholarship';
  end if;

  select balance_cached into v_wallet_balance
  from public.wallets where user_id = p_benefactor_user_id;

  if coalesce(v_wallet_balance, 0) < p_amount then
    raise exception 'Insufficient wallet balance: have %, need %', coalesce(v_wallet_balance,0), p_amount;
  end if;

  update public.opportunities
  set allocated_amount = p_amount, updated_at = now()
  where id = p_opportunity_id;

  return p_amount;
end;
$$;

-- ── Pay a single approved applicant ─────────────────────────────────────────
-- The actual disbursement: debits the benefactor's wallet, credits the
-- student's wallet, and updates both the application row and the parent
-- scholarship's running disbursed_amount — all in one transaction, so a
-- failure partway through cannot leave the books inconsistent.
create or replace function public.pay_applicant(
  p_benefactor_user_id uuid,
  p_application_id uuid,
  p_idempotency_key text default null
)
returns table (
  application_id uuid,
  amount_paid numeric,
  benefactor_balance numeric,
  duplicate boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_app record;
  v_owns boolean;
  v_amount numeric;
  v_debit record;
  v_key text;
begin
  select a.*, o.benefactor_id, o.id as opp_id, o.title as opp_title
  into v_app
  from public.opportunity_applications a
  join public.opportunities o on o.id = a.opportunity_id
  where a.id = p_application_id
  for update;

  if v_app is null then
    raise exception 'Application not found';
  end if;

  select exists (
    select 1 from public.benefactors b
    where b.id = v_app.benefactor_id and b.user_id = p_benefactor_user_id
  ) into v_owns;

  if not v_owns then
    raise exception 'Not authorized to pay this applicant';
  end if;

  if v_app.status not in ('shortlisted', 'awarded') then
    raise exception 'Applicant must be shortlisted or awarded before payment (current status: %)', v_app.status;
  end if;

  if v_app.payment_status = 'paid' then
    -- Already paid — return the existing state rather than erroring, so a
    -- double-click on "Pay" is harmless.
    return query select v_app.id, v_app.paid_amount, 0::numeric, true;
    return;
  end if;

  v_amount := coalesce(v_app.award_amount, 0);
  if v_amount <= 0 then
    raise exception 'No award amount set for this applicant';
  end if;

  v_key := coalesce(p_idempotency_key, 'pay_applicant:' || p_application_id::text);

  -- Debit the benefactor. post_wallet_transaction enforces the balance check
  -- and idempotency — if this key was already used, it returns the prior
  -- result instead of debiting twice.
  select * into v_debit from public.post_wallet_transaction(
    p_benefactor_user_id, -v_amount, 'scholarship_disbursement',
    'Payment: ' || v_app.opp_title,
    'opportunity_application', p_application_id::text, v_key
  );

  if v_debit.duplicate then
    return query select v_app.id, v_app.paid_amount, v_debit.balance, true;
    return;
  end if;

  -- Credit the student, best-effort. A missing student wallet must not undo
  -- the benefactor's debit — ensure_wallet() creates one on demand.
  perform public.ensure_wallet(v_app.user_id);
  perform public.post_wallet_transaction(
    v_app.user_id, v_amount, 'scholarship_award',
    'Award: ' || v_app.opp_title,
    'opportunity_application', p_application_id::text, v_key || ':credit'
  );

  update public.opportunity_applications
  set payment_status = 'paid', paid_amount = v_amount, paid_at = now(),
      status = 'awarded', updated_at = now()
  where id = p_application_id;

  update public.opportunities
  set disbursed_amount = disbursed_amount + v_amount, updated_at = now()
  where id = v_app.opp_id;

  return query select v_app.id, v_amount, v_debit.balance, false;
end;
$$;

-- ── Pay every unpaid, awarded/shortlisted applicant on a scholarship ────────
create or replace function public.pay_all_applicants(
  p_benefactor_user_id uuid,
  p_opportunity_id uuid
)
returns table (application_id uuid, amount_paid numeric, success boolean, error text)
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  v_result record;
begin
  for r in
    select id from public.opportunity_applications
    where opportunity_id = p_opportunity_id
      and payment_status <> 'paid'
      and status in ('shortlisted', 'awarded')
  loop
    begin
      select * into v_result from public.pay_applicant(p_benefactor_user_id, r.id);
      application_id := v_result.application_id;
      amount_paid := v_result.amount_paid;
      success := true;
      error := null;
      return next;
    exception when others then
      application_id := r.id;
      amount_paid := 0;
      success := false;
      error := SQLERRM;
      return next;
    end;
  end loop;
end;
$$;

-- ── Read: fund management summary for a benefactor ──────────────────────────
create or replace function public.benefactor_fund_summary(p_user_id uuid)
returns table (
  total_funds_available numeric,
  total_allocated numeric,
  total_disbursed numeric
)
language sql
stable
security definer
set search_path = public
as $$
  select
    coalesce((select balance_cached from public.wallets where user_id = p_user_id), 0),
    coalesce((
      select sum(o.allocated_amount) from public.opportunities o
      join public.benefactors b on b.id = o.benefactor_id
      where b.user_id = p_user_id
    ), 0),
    coalesce((
      select sum(o.disbursed_amount) from public.opportunities o
      join public.benefactors b on b.id = o.benefactor_id
      where b.user_id = p_user_id
    ), 0);
$$;

grant execute on function public.benefactor_deposit_funds(uuid, numeric, text, text) to authenticated;
grant execute on function public.allocate_scholarship_funds(uuid, uuid, numeric) to authenticated;
grant execute on function public.pay_applicant(uuid, uuid, text) to authenticated;
grant execute on function public.pay_all_applicants(uuid, uuid) to authenticated;
grant execute on function public.benefactor_fund_summary(uuid) to authenticated;

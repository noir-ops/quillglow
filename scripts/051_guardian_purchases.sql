-- Two gaps this closes:
--
-- 1. A guardian with a family link had NO way to see their student's
--    Genius plan status — subscriptions (011) is RLS-locked to the
--    student alone. Extended to family-linked adults, read-only.
--
-- 2. charge_family_wallet (050) only let the STUDENT spend their own
--    balance — a deliberate choice at the time ("the student choosing to
--    spend, not the adult pushing a purchase onto them"). Explicit
--    instruction now: a guardian should be able to directly fund/renew
--    the Genius plan and buy shop items FOR their linked student, not
--    just top up a balance and wait. Relaxed to allow either party,
--    still fully denied to anyone else — a wallet still only spends on
--    the ONE student it's linked to, from funds the ONE linked adult put
--    there.
--
-- Fulfillment (activating the plan, creating the order) now lives in SQL,
-- not duplicated across quillglow-main's and the guardian portal's
-- separate Next.js codebases — both call the same function, so there is
-- exactly one implementation of "what happens after a successful charge,"
-- not two that could drift apart.

-- ── 1. Guardian can view (never edit) a linked family student's plan ────
drop policy if exists "family guardian reads linked subscription" on public.subscriptions;
create policy "family guardian reads linked subscription" on public.subscriptions
  for select to authenticated using (
    exists (
      select 1 from public.guardian_links gl
      where gl.student_user_id = subscriptions.user_id
        and gl.adult_user_id = auth.uid()
        and gl.link_type = 'family'
        and gl.status = 'active'
    )
  );

-- ── 2. Relax charge_family_wallet: either the student or the linked adult ──
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

  -- Was: only the student. Now: the student OR the one adult who funds
  -- this specific wallet — nobody else, and never a different wallet's
  -- adult or a mentor (mentor links have no family_wallets row at all).
  if auth.uid() not in (v_wallet.student_user_id, v_wallet.adult_user_id) then
    raise exception 'Not authorized to spend from this wallet';
  end if;

  select * into v_tx from public.post_family_wallet_transaction(
    p_family_wallet_id, -p_amount, 'purchase', p_description,
    p_reference_type, p_reference_id, auth.uid(), p_idempotency_key
  );

  return query select v_tx.out_balance, v_tx.out_duplicate;
end;
$$;

/**
 * Genius plan purchase/renewal — the single implementation both
 * quillglow-main and the guardian portal call. $4.99/mo, matching
 * PLAN_DETAILS.genius.price in quillglow-main/lib/types/subscription.ts;
 * keep that constant in sync with this one if the price ever changes.
 * One charge per student per calendar month — same idempotency key
 * regardless of which side (student or guardian) initiates, so the two
 * can never double-charge the same month between them.
 */
create or replace function public.purchase_genius_plan_with_family_wallet(
  p_family_wallet_id uuid
)
returns table (out_balance numeric, out_period_end timestamptz)
language plpgsql security definer set search_path = public as $$
declare
  v_wallet record;
  v_charge record;
  v_period_end timestamptz;
begin
  select * into v_wallet from public.family_wallets fw where fw.id = p_family_wallet_id;
  if not found then
    raise exception 'Family wallet not found';
  end if;

  select * into v_charge from public.charge_family_wallet(
    p_family_wallet_id, 4.99, 'QuillGlow Genius plan', 'subscription',
    v_wallet.student_user_id::text,
    'genius:' || v_wallet.student_user_id::text || ':' || to_char(now(), 'YYYY-MM')
  );

  v_period_end := now() + interval '30 days';

  insert into public.subscriptions (user_id, plan_type, status, current_period_start, current_period_end, updated_at)
  values (v_wallet.student_user_id, 'genius', 'active', now(), v_period_end, now())
  on conflict (user_id) do update set
    plan_type = 'genius',
    status = 'active',
    current_period_start = now(),
    current_period_end = v_period_end,
    updated_at = now();

  return query select v_charge.out_balance, v_period_end;
end;
$$;

grant execute on function public.purchase_genius_plan_with_family_wallet(uuid) to authenticated;

/**
 * Study Tracker purchase — same reasoning as the Genius function above.
 * $0.99, matching PRODUCTS[0] in quillglow-main/lib/products.ts; keep in
 * sync if that catalog ever changes. Repeat purchases are allowed (no
 * monthly idempotency window) since buying the same one-time item twice
 * is a legitimate thing to do, unlike a subscription renewal.
 */
create or replace function public.purchase_study_tracker_with_family_wallet(
  p_family_wallet_id uuid
)
returns table (out_balance numeric, out_order_id uuid)
language plpgsql security definer set search_path = public as $$
declare
  v_wallet record;
  v_charge record;
  v_student_email text;
  v_order_id uuid;
begin
  select * into v_wallet from public.family_wallets fw where fw.id = p_family_wallet_id;
  if not found then
    raise exception 'Family wallet not found';
  end if;

  select email into v_student_email from auth.users where id = v_wallet.student_user_id;

  select * into v_charge from public.charge_family_wallet(
    p_family_wallet_id, 0.99, 'Digital Study Tracker & Analytics', 'shop_order',
    'digital-study-tracker',
    'shop:digital-study-tracker:' || v_wallet.id::text || ':' || extract(epoch from clock_timestamp())::text
  );

  insert into public.study_tracker_orders (user_id, email, product_name, price, payment_provider, payment_status, currency)
  values (v_wallet.student_user_id, v_student_email, 'Digital Study Tracker & Analytics', 0.99, 'family_wallet', 'completed', 'usd')
  returning id into v_order_id;

  return query select v_charge.out_balance, v_order_id;
end;
$$;

grant execute on function public.purchase_study_tracker_with_family_wallet(uuid) to authenticated;

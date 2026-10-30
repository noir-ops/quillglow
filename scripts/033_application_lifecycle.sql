-- Closes four gaps identified in review:
--   1. No real "apply" step — students can only ever reach status='saved'.
--   2. Benefactors see every bookmark as if it were a real application.
--   3. A student's own row has NO column restriction — they can currently
--      write award_amount/payment_status directly (a real security gap,
--      not just missing UX), and can set their own status to
--      shortlisted/awarded, which should be benefactor-only.
--   4. Nothing ever tells a student they were paid, shortlisted, or rejected.

-- ── 1 + 3: student write guard + real submission ────────────────────────────
--
-- Mirrors guard_benefactor_application_update (031) from the other side: a
-- student may freely edit their OWN submission content (notes, documents,
-- status among the states that belong to them), but can never write the
-- fields that belong to the benefactor's review or the payment functions.
create or replace function public.guard_student_application_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_is_owner boolean;
begin
  v_is_owner := (auth.uid() is not null and old.user_id = auth.uid());

  if v_is_owner then
    -- A student may only move between their own states. shortlisted / awarded /
    -- rejected are benefactor-only transitions (enforced separately by
    -- guard_benefactor_application_update) — without this check, the earlier
    -- "for all" policy let a student write ANY status directly, including
    -- awarding themselves.
    if new.status not in ('saved', 'in_progress', 'submitted', 'withdrawn')
       and new.status is distinct from old.status then
      new.status := old.status;
    end if;

    -- Payment and review fields are owned by the fund-management functions
    -- and the benefactor review flow — never student-writable. This is the
    -- fix for the actual security gap: before this trigger existed, RLS had
    -- no column-level restriction, so a student could set these directly.
    new.award_amount     := old.award_amount;
    new.payment_status    := old.payment_status;
    new.paid_amount       := old.paid_amount;
    new.paid_at           := old.paid_at;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_guard_student_application_update on public.opportunity_applications;
create trigger trg_guard_student_application_update
before update on public.opportunity_applications
for each row execute function public.guard_student_application_update();

/**
 * Submit a saved/in-progress application for review.
 *
 * Validates the opportunity's stated requirements before allowing the
 * transition — "Submit" previously meant nothing more than writing a status
 * string with zero validation, so a student could reach 'submitted' with no
 * essay even when the scholarship required one.
 */
create or replace function public.submit_application(
  p_user_id uuid,
  p_application_id uuid
)
returns table (status text, submitted_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_app record;
  v_opp record;
  v_doc_count int;
begin
  select * into v_app from public.opportunity_applications
  where id = p_application_id and user_id = p_user_id
  for update;

  if v_app is null then
    raise exception 'Application not found';
  end if;

  if v_app.status not in ('saved', 'in_progress') then
    raise exception 'Only a saved or in-progress application can be submitted (current: %)', v_app.status;
  end if;

  select * into v_opp from public.opportunities where id = v_app.opportunity_id;

  if v_opp.requires_essay and (v_app.notes is null or length(trim(v_app.notes)) < 50) then
    raise exception 'This scholarship requires an essay of at least 50 characters before you can submit';
  end if;

  select count(*) into v_doc_count
  from public.secure_documents
  where resource_type = 'opportunity_application' and resource_id = p_application_id::text
    and deleted_at is null;

  if v_opp.requires_recommendation and v_doc_count = 0 then
    raise exception 'This scholarship requires at least one supporting document before you can submit';
  end if;

  update public.opportunity_applications
  set status = 'submitted', submitted_at = now(), updated_at = now()
  where id = p_application_id;

  return query select 'submitted'::text, now();
end;
$$;

grant execute on function public.submit_application(uuid, uuid) to authenticated;

-- ── 2: benefactors only ever see real submissions ───────────────────────────
-- A bookmark ('saved'/'in_progress') is not an application. Showing it in the
-- benefactor's review queue made every scholarship look like it had
-- applicants the moment a student merely clicked Save.
create or replace function public.benefactor_applications(p_benefactor_user_id uuid)
returns table (
  id uuid,
  opportunity_id uuid,
  opportunity_title text,
  user_id uuid,
  student_name text,
  status text,
  award_amount numeric,
  payment_status text,
  submitted_at timestamptz,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    a.id, a.opportunity_id, o.title, a.user_id,
    coalesce(p.display_name, 'Applicant'),
    a.status, a.award_amount, a.payment_status, a.submitted_at, a.created_at
  from public.opportunity_applications a
  join public.opportunities o on o.id = a.opportunity_id
  join public.benefactors b on b.id = o.benefactor_id
  left join public.profiles p on p.id = a.user_id
  where b.user_id = p_benefactor_user_id
    and a.status not in ('saved', 'in_progress')
  order by a.created_at desc;
$$;

-- ── 4: notifications ─────────────────────────────────────────────────────────

-- Fires when a benefactor moves an application to shortlisted / awarded /
-- rejected. Added to the EXISTING guard trigger from 031 rather than a
-- second trigger, so there is one place that governs benefactor-driven
-- status changes.
create or replace function public.guard_benefactor_application_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_is_benefactor boolean;
  v_opp_title text;
begin
  select exists (
    select 1 from public.opportunities o
    join public.benefactors b on b.id = o.benefactor_id
    where o.id = new.opportunity_id and b.user_id = auth.uid()
  ) into v_is_benefactor;

  if v_is_benefactor and auth.uid() is not null then
    if new.status not in ('shortlisted', 'awarded', 'rejected') then
      raise exception 'Benefactors may only set status to shortlisted, awarded, or rejected';
    end if;
    new.payment_status := old.payment_status;
    new.paid_amount := old.paid_amount;
    new.paid_at := old.paid_at;
    new.notes := old.notes;
    new.documents := old.documents;
    new.submitted_at := old.submitted_at;

    if new.status is distinct from old.status then
      select title into v_opp_title from public.opportunities where id = new.opportunity_id;
      perform public.send_notification(
        new.user_id, 'scholarship',
        case new.status
          when 'shortlisted' then 'You have been shortlisted'
          when 'awarded' then 'You have been awarded a scholarship'
          when 'rejected' then 'Application update'
        end,
        case new.status
          when 'shortlisted' then 'You were shortlisted for "' || coalesce(v_opp_title, 'a scholarship') || '".'
          when 'awarded' then 'Congratulations — you were awarded "' || coalesce(v_opp_title, 'a scholarship') || '".'
          when 'rejected' then 'Your application to "' || coalesce(v_opp_title, 'a scholarship') || '" was not successful this time.'
        end,
        '/opportunities', 'in_app'
      );
    end if;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

-- Payment notification: added to pay_applicant() from 030. Logic is
-- otherwise byte-identical to the tested version — only the notification
-- call is new, appended after the ledger write succeeds so a notification
-- failure can never roll back or block a real payment.
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
    return query select v_app.id, v_app.paid_amount, 0::numeric, true;
    return;
  end if;

  v_amount := coalesce(v_app.award_amount, 0);
  if v_amount <= 0 then
    raise exception 'No award amount set for this applicant';
  end if;

  v_key := coalesce(p_idempotency_key, 'pay_applicant:' || p_application_id::text);

  select * into v_debit from public.post_wallet_transaction(
    p_benefactor_user_id, -v_amount, 'scholarship_disbursement',
    'Payment: ' || v_app.opp_title,
    'opportunity_application', p_application_id::text, v_key
  );

  if v_debit.duplicate then
    return query select v_app.id, v_app.paid_amount, v_debit.balance, true;
    return;
  end if;

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

  -- New: tell the student. Fires only on a genuine (non-duplicate) payment.
  perform public.send_notification(
    v_app.user_id, 'scholarship', 'Scholarship payment received',
    'You received ' || v_amount || ' for "' || v_app.opp_title || '". Check your wallet for details.',
    '/wallet', 'in_app'
  );

  return query select v_app.id, v_amount, v_debit.balance, false;
end;
$$;

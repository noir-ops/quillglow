-- Without this, "View child's applications" and "Disbursement status"
-- (explicitly listed guardian capabilities) are not just unbuilt — they're
-- impossible, because opportunity_applications and wallets are RLS-locked
-- to auth.uid() = user_id, which is the student, never the trusted adult.
-- This grants exactly the reads those two specified capabilities require,
-- gated by an active guardian_links row carrying the matching permission
-- flag — nothing broader.

-- coalesce + explicit 'true' comparison rather than a bare
-- (permissions->>p_permission)::boolean cast: the cast errors outright on
-- a missing or malformed key, and because this function runs INSIDE RLS
-- policies, an error here doesn't just return false — it aborts the whole
-- query the policy is guarding. A missing permission key must read as
-- "no", never as an exception.
create or replace function public.has_guardian_permission(p_student_user_id uuid, p_permission text)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.guardian_links gl
    where gl.student_user_id = p_student_user_id
      and gl.adult_user_id = auth.uid()
      and gl.status = 'active'
      and coalesce(gl.permissions->>p_permission, 'false') = 'true'
  );
$$;

grant execute on function public.has_guardian_permission(uuid, text) to authenticated;

-- Applications: guardian (view_applications) and mentor (review_applications
-- or track_assigned_applications) can read a linked student's rows.
drop policy if exists "guardian reads linked applications" on public.opportunity_applications;
create policy "guardian reads linked applications" on public.opportunity_applications
  for select to authenticated using (
    public.has_guardian_permission(user_id, 'view_applications')
    or public.has_guardian_permission(user_id, 'review_applications')
    or public.has_guardian_permission(user_id, 'track_assigned_applications')
  );

-- Wallet balance + transactions: guardian only, gated by
-- view_disbursement_status — the one financial view explicitly listed for
-- the family relationship. Mentors have no financial permission by
-- default (044) and none is added here.
drop policy if exists "guardian reads linked wallet" on public.wallets;
create policy "guardian reads linked wallet" on public.wallets
  for select to authenticated using (
    public.has_guardian_permission(user_id, 'view_disbursement_status')
  );

drop policy if exists "guardian reads linked wallet transactions" on public.wallet_transactions;
create policy "guardian reads linked wallet transactions" on public.wallet_transactions
  for select to authenticated using (
    public.has_guardian_permission(user_id, 'view_disbursement_status')
  );

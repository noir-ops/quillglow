-- Benefactor read/review access to applications on their own scholarships.
--
-- opportunity_applications currently has RLS allowing only the applying
-- student to see or touch their own row. Benefactors have no policy at all —
-- so an Applications page has nothing to read or write against. This adds
-- exactly the scoped access a benefactor needs: their own scholarships only.

drop policy if exists "benefactors read applications to own opportunities" on public.opportunity_applications;
create policy "benefactors read applications to own opportunities"
  on public.opportunity_applications for select to authenticated
  using (
    opportunity_id in (
      select o.id from public.opportunities o
      join public.benefactors b on b.id = o.benefactor_id
      where b.user_id = auth.uid()
    )
  );

drop policy if exists "benefactors update applications to own opportunities" on public.opportunity_applications;
create policy "benefactors update applications to own opportunities"
  on public.opportunity_applications for update to authenticated
  using (
    opportunity_id in (
      select o.id from public.opportunities o
      join public.benefactors b on b.id = o.benefactor_id
      where b.user_id = auth.uid()
    )
  )
  with check (
    opportunity_id in (
      select o.id from public.opportunities o
      join public.benefactors b on b.id = o.benefactor_id
      where b.user_id = auth.uid()
    )
  );

-- A benefactor may only move an application into review states — never
-- fabricate that a student submitted something, and never touch payment
-- fields directly (those are owned by pay_applicant()/pay_all_applicants()
-- in 030_benefactor_fund_management.sql, which run with elevated privileges).
create or replace function public.guard_benefactor_application_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_is_benefactor boolean;
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
    -- Payment fields are owned by the fund-management functions, not direct
    -- table writes — revert any attempt to set them here.
    new.payment_status := old.payment_status;
    new.paid_amount := old.paid_amount;
    new.paid_at := old.paid_at;
    -- A benefactor cannot alter what the student actually submitted.
    new.notes := old.notes;
    new.documents := old.documents;
    new.submitted_at := old.submitted_at;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_guard_benefactor_application_update on public.opportunity_applications;
create trigger trg_guard_benefactor_application_update
before update on public.opportunity_applications
for each row execute function public.guard_benefactor_application_update();

-- ── Read: applications to a benefactor's scholarships, with student profile ─
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
  order by a.created_at desc;
$$;

grant execute on function public.benefactor_applications(uuid) to authenticated;

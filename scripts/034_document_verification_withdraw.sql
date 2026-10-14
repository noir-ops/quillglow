-- Closes the remaining gaps: benefactors reviewing applications with zero
-- visibility into what was actually submitted, inflated dashboard stats,
-- no way for a student to withdraw or even see their own application status,
-- and no document verification workflow anywhere.

-- ── 1: benefactor_stats() had the same saved-vs-applied bug as
--       benefactor_applications() (fixed in 033) — total_applications counted
--       every bookmark, not just real submissions.
create or replace function public.benefactor_stats(p_benefactor_id uuid)
returns table (
  total_opportunities int,
  approved int,
  pending int,
  draft int,
  total_applications int,
  total_award_value numeric
)
language sql
stable
security definer
set search_path = public
as $$
  select
    count(*)::int,
    count(*) filter (where o.review_status = 'approved')::int,
    count(*) filter (where o.review_status = 'pending_review')::int,
    count(*) filter (where o.review_status in ('draft', 'changes_requested'))::int,
    coalesce((
      select count(*)::int from public.opportunity_applications a
      where a.opportunity_id in (
        select id from public.opportunities where benefactor_id = p_benefactor_id
      )
      and a.status not in ('saved', 'in_progress')
    ), 0),
    coalesce(sum(o.award_amount), 0)
  from public.opportunities o
  where o.benefactor_id = p_benefactor_id;
$$;

-- ── 2: benefactors could shortlist/award/reject with zero visibility into
--       what a student actually wrote. Adding notes to the existing list
--       function rather than a second N+1 detail call per row.
--
-- Postgres won't let CREATE OR REPLACE change a function's return columns —
-- the old 10-column signature from 031/033 must be dropped explicitly before
-- redefining it with the new `notes` column.
drop function if exists public.benefactor_applications(uuid);

create or replace function public.benefactor_applications(p_benefactor_user_id uuid)
returns table (
  id uuid,
  opportunity_id uuid,
  opportunity_title text,
  user_id uuid,
  student_name text,
  status text,
  notes text,
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
    a.status, a.notes, a.award_amount, a.payment_status, a.submitted_at, a.created_at
  from public.opportunity_applications a
  join public.opportunities o on o.id = a.opportunity_id
  join public.benefactors b on b.id = o.benefactor_id
  left join public.profiles p on p.id = a.user_id
  where b.user_id = p_benefactor_user_id
    and a.status not in ('saved', 'in_progress')
  order by a.created_at desc;
$$;

-- ── 3: documents attached to an application, for anyone already authorized
--       to view that application (owner, admin, mentor, or the benefactor of
--       that specific opportunity) — reuses can_access_document() per row so
--       there is exactly one place that owns this authorization logic.
create or replace function public.application_documents(
  p_application_id uuid,
  p_requester_id uuid
)
returns table (
  id uuid,
  document_type text,
  original_filename text,
  mime_type text,
  size_bytes bigint,
  verification_status text,
  verification_notes text,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_can_view_app boolean;
begin
  -- Same ownership rule as benefactor_applications()/the student's own row —
  -- if the caller cannot see the application itself, they see no documents.
  select exists (
    select 1 from public.opportunity_applications a
    where a.id = p_application_id
      and (
        a.user_id = p_requester_id
        or exists (
          select 1 from public.opportunities o
          join public.benefactors b on b.id = o.benefactor_id
          where o.id = a.opportunity_id and b.user_id = p_requester_id
        )
        or exists (select 1 from public.user_roles where user_id = p_requester_id and role = 'admin')
      )
  ) into v_can_view_app;

  if not v_can_view_app then
    return;
  end if;

  return query
  select d.id, d.document_type, d.original_filename, d.mime_type, d.size_bytes,
         d.verification_status, d.verification_notes, d.created_at
  from public.secure_documents d
  where d.resource_type = 'opportunity_application'
    and d.resource_id = p_application_id::text
    and d.deleted_at is null
  order by d.created_at asc;
end;
$$;

grant execute on function public.application_documents(uuid, uuid) to authenticated;

-- ── 4: document verification. Restricted to admin or the benefactor who
--       owns the opportunity the document is attached to — NOT the student
--       themselves (self-verifying your own supporting document defeats the
--       point), and not a mentor with only review access.
create or replace function public.verify_document(
  p_document_id uuid,
  p_verifier_id uuid,
  p_status text,
  p_notes text default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_doc record;
  v_is_admin boolean;
  v_is_owning_benefactor boolean;
begin
  if p_status not in ('verified', 'rejected') then
    raise exception 'Invalid verification status: %', p_status;
  end if;

  select * into v_doc from public.secure_documents where id = p_document_id and deleted_at is null;
  if v_doc is null then
    raise exception 'Document not found';
  end if;

  select exists (
    select 1 from public.user_roles where user_id = p_verifier_id and role = 'admin'
  ) into v_is_admin;

  select exists (
    select 1 from public.opportunity_applications a
    join public.opportunities o on o.id = a.opportunity_id
    join public.benefactors b on b.id = o.benefactor_id
    where a.id::text = v_doc.resource_id
      and v_doc.resource_type = 'opportunity_application'
      and b.user_id = p_verifier_id
  ) into v_is_owning_benefactor;

  if not (v_is_admin or v_is_owning_benefactor) then
    raise exception 'Not authorized to verify this document';
  end if;

  update public.secure_documents
  set verification_status = p_status, verification_notes = p_notes,
      verified_at = now(), verified_by = p_verifier_id, updated_at = now()
  where id = p_document_id;

  return true;
end;
$$;

grant execute on function public.verify_document(uuid, uuid, text, text) to authenticated;

-- ── 5: withdraw. Student-only; blocked once money has actually moved —
--       withdrawing after being paid doesn't undo a real disbursement, so
--       this must not be presented as a reversible action past that point.
create or replace function public.withdraw_application(
  p_user_id uuid,
  p_application_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_app record;
begin
  select * into v_app from public.opportunity_applications
  where id = p_application_id and user_id = p_user_id
  for update;

  if v_app is null then
    raise exception 'Application not found';
  end if;

  if v_app.payment_status = 'paid' then
    raise exception 'Cannot withdraw an application that has already been paid';
  end if;

  if v_app.status not in ('submitted', 'shortlisted') then
    raise exception 'Only a submitted or shortlisted application can be withdrawn (current: %)', v_app.status;
  end if;

  update public.opportunity_applications
  set status = 'withdrawn', updated_at = now()
  where id = p_application_id;

  return true;
end;
$$;

grant execute on function public.withdraw_application(uuid, uuid) to authenticated;

-- The student write guard (033) restricted status to
-- (saved, in_progress, submitted, withdrawn) already — 'withdrawn' was
-- anticipated then, so no trigger change is needed here. This function is a
-- validated, auditable path to that same allowed transition.

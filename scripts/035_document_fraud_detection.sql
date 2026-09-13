-- Document reuse detection — the fraud-pattern gap flagged after 034.
--
-- The `checksum` column existed since secure_documents was created but
-- nothing ever computed it, so no duplicate-document signal was possible.
-- The real fraud shape this catches: two DIFFERENT students submitting the
-- byte-identical file — a shared or purchased fake recommendation letter,
-- a sibling's transcript reused, etc. The same student re-using their own
-- transcript across several of their own applications is normal and must
-- NOT be flagged — the queries below explicitly exclude same-owner matches.
--
-- Privacy design: a benefactor gets a COUNT ONLY ("this exact file also
-- appears elsewhere, submitted by someone else") — never which other
-- student or which other benefactor's application. Exposing that would leak
-- one benefactor's applicant identity to a completely unrelated benefactor
-- whose applicant happened to submit the same file. Admin, who already has
-- platform-wide oversight, gets the full detail for actual investigation.

/**
 * Count of OTHER documents (different owner) sharing this document's
 * checksum. Restricted to documents attached to a scholarship application —
 * that's the fraud scenario in play, and it keeps unrelated document types
 * from generating noise if this table is ever used for something else.
 *
 * Authorization mirrors application_documents(): the caller must already be
 * able to see this specific document (owner, admin, or the benefactor of
 * the opportunity it's attached to).
 */
create or replace function public.document_duplicate_count(
  p_document_id uuid,
  p_requester_id uuid
)
returns int
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_doc record;
  v_can_view boolean;
  v_count int;
begin
  select * into v_doc from public.secure_documents
  where id = p_document_id and deleted_at is null;
  if v_doc is null then return 0; end if;

  select exists (
    select 1
    from public.opportunity_applications a
    where a.id::text = v_doc.resource_id and v_doc.resource_type = 'opportunity_application'
      and (
        a.user_id = p_requester_id
        or exists (
          select 1 from public.opportunities o
          join public.benefactors b on b.id = o.benefactor_id
          where o.id = a.opportunity_id and b.user_id = p_requester_id
        )
      )
  ) or exists (
    select 1 from public.user_roles where user_id = p_requester_id and role = 'admin'
  ) into v_can_view;

  if not v_can_view or v_doc.checksum is null then
    return 0;
  end if;

  select count(*) into v_count
  from public.secure_documents d
  where d.checksum = v_doc.checksum
    and d.id <> v_doc.id
    and d.owner_id <> v_doc.owner_id
    and d.resource_type = 'opportunity_application'
    and d.deleted_at is null;

  return v_count;
end;
$$;

grant execute on function public.document_duplicate_count(uuid, uuid) to authenticated;

/**
 * Admin-only investigative detail: which specific documents/applications
 * share this checksum. Deliberately not exposed to benefactors — see the
 * privacy note above.
 */
create or replace function public.admin_document_duplicates(p_document_id uuid)
returns table (
  duplicate_document_id uuid,
  owner_id uuid,
  application_id uuid,
  opportunity_title text,
  uploaded_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_doc record;
begin
  select * into v_doc from public.secure_documents where id = p_document_id;
  if v_doc is null or v_doc.checksum is null then return; end if;

  return query
  select d.id, d.owner_id, a.id, o.title, d.created_at
  from public.secure_documents d
  join public.opportunity_applications a on a.id::text = d.resource_id
  join public.opportunities o on o.id = a.opportunity_id
  where d.checksum = v_doc.checksum
    and d.id <> v_doc.id
    and d.owner_id <> v_doc.owner_id
    and d.resource_type = 'opportunity_application'
    and d.deleted_at is null;
end;
$$;

grant execute on function public.admin_document_duplicates(uuid) to authenticated;

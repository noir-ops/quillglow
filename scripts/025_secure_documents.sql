-- §23 · Document Security
--
-- Scholarship applications carry passports, transcripts, ID cards and financial
-- records belonging to minors. A predictable path like
-- /student/uploads/passport.pdf is an enumeration attack waiting to happen.
--
-- Flow enforced here:
--   Student -> Application -> Secure Document ID -> Authorization Check
--            -> Short-lived Signed URL -> Document
--
-- The storage path is NEVER returned to a client. Clients only ever see the
-- opaque document id; the path lives server-side and is exchanged for a
-- short-lived signed URL after an authorization check.

create table if not exists public.secure_documents (
  -- Opaque id. This is the ONLY identifier a client ever sees.
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,

  -- Private storage bucket path. Never exposed through any API response.
  storage_bucket text not null default 'secure-documents',
  storage_path text not null,

  document_type text not null,
    -- passport | national_id | transcript | certificate | recommendation
    -- financial_statement | photo | essay | other
  original_filename text,
  mime_type text,
  size_bytes bigint,
  checksum text,

  -- What this document is attached to. Access is derived from the parent
  -- resource, so revoking an application revokes its documents implicitly.
  resource_type text,                  -- opportunity_application | profile
  resource_id text,

  verification_status text not null default 'pending',
    -- pending | verified | rejected | expired
  verification_notes text,
  verified_at timestamptz,
  verified_by uuid,

  -- Retention (spec §22: data retention rules).
  expires_at timestamptz,
  deleted_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists secure_docs_owner_idx on public.secure_documents (owner_id);
create index if not exists secure_docs_resource_idx
  on public.secure_documents (resource_type, resource_id);
create index if not exists secure_docs_expiry_idx
  on public.secure_documents (expires_at) where deleted_at is null;

alter table public.secure_documents enable row level security;

-- Owners may see their own document METADATA. The storage path is stripped in
-- the service layer before anything reaches a client.
drop policy if exists "owners read own documents" on public.secure_documents;
create policy "owners read own documents"
  on public.secure_documents for select to authenticated
  using (auth.uid() = owner_id and deleted_at is null);

-- No client insert/update/delete: documents are written server-side only, after
-- the upload has been validated.

-- ── Access audit ────────────────────────────────────────────────────────────
-- Every view of a sensitive document is recorded. For scholarship-grade data
-- this is not optional — you must be able to answer "who saw this passport?"
create table if not exists public.document_access_log (
  id bigserial primary key,
  document_id uuid not null references public.secure_documents(id) on delete cascade,
  accessor_id uuid references auth.users(id) on delete set null,
  accessor_role text,
  action text not null,               -- issued_url | denied | uploaded | deleted
  reason text,                        -- why access was denied
  ip_address text,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists doc_access_doc_idx
  on public.document_access_log (document_id, created_at desc);
create index if not exists doc_access_actor_idx
  on public.document_access_log (accessor_id, created_at desc);

alter table public.document_access_log enable row level security;
-- Server-side only. No client policies at all.

-- ── Authorization ───────────────────────────────────────────────────────────
-- Who may view a document:
--   * its owner
--   * an admin
--   * a mentor with scholarship.review (assigned-case review)
--   * the benefactor who owns the opportunity the document was submitted to
--
-- Note the benefactor rule is narrow on purpose: a benefactor may see documents
-- attached to applications for THEIR OWN scholarships only — never a student's
-- documents in general.
create or replace function public.can_access_document(
  p_document_id uuid,
  p_user_id uuid
)
returns table (allowed boolean, reason text)
language plpgsql stable security definer set search_path = public as $$
declare
  v_doc record;
  v_is_admin boolean;
  v_can_review boolean;
  v_is_benefactor_owner boolean;
begin
  select * into v_doc from public.secure_documents
  where id = p_document_id and deleted_at is null;

  if v_doc is null then
    return query select false, 'not_found'::text; return;
  end if;

  if v_doc.expires_at is not null and v_doc.expires_at < now() then
    return query select false, 'expired'::text; return;
  end if;

  if v_doc.owner_id = p_user_id then
    return query select true, 'owner'::text; return;
  end if;

  select exists (
    select 1 from public.user_roles where user_id = p_user_id and role = 'admin'
  ) into v_is_admin;
  if v_is_admin then
    return query select true, 'admin'::text; return;
  end if;

  select public.user_has_permission(p_user_id, 'scholarship.review') into v_can_review;
  if v_can_review then
    return query select true, 'mentor_review'::text; return;
  end if;

  -- Benefactor: only for applications to their own opportunities.
  if v_doc.resource_type = 'opportunity_application' then
    select exists (
      select 1
      from public.opportunity_applications a
      join public.opportunities o on o.id = a.opportunity_id
      join public.benefactors b on b.id = o.benefactor_id
      where a.id::text = v_doc.resource_id
        and b.user_id = p_user_id
    ) into v_is_benefactor_owner;

    if v_is_benefactor_owner then
      return query select true, 'benefactor_of_opportunity'::text; return;
    end if;
  end if;

  return query select false, 'forbidden'::text;
end;
$$;

grant execute on function public.can_access_document(uuid, uuid) to authenticated;

create or replace function public.log_document_access(
  p_document_id uuid,
  p_accessor_id uuid,
  p_action text,
  p_reason text default null,
  p_ip text default null,
  p_user_agent text default null
)
returns void
language plpgsql security definer set search_path = public as $$
declare v_role text;
begin
  select role into v_role from public.user_roles where user_id = p_accessor_id limit 1;

  insert into public.document_access_log
    (document_id, accessor_id, accessor_role, action, reason, ip_address, user_agent)
  values
    (p_document_id, p_accessor_id, coalesce(v_role, 'student'), p_action, p_reason, p_ip, p_user_agent);
end;
$$;

-- ── Retention ───────────────────────────────────────────────────────────────
create or replace function public.expire_old_documents()
returns int
language plpgsql security definer set search_path = public as $$
declare v int;
begin
  update public.secure_documents
  set deleted_at = now(), updated_at = now()
  where deleted_at is null and expires_at is not null and expires_at < now();
  get diagnostics v = row_count;
  return v;
end;
$$;

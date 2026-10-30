-- Trusted Adult accounts: a FOURTH actor type alongside students,
-- benefactors, and admins — sharing the same Supabase auth (same pattern
-- as benefactors, 021). One identity, one wallet, one notification feed,
-- one AI, one set of account settings — NOT two accounts wearing a
-- "Parent Mode" / "Mentor Mode" costume.
--
-- The relationship table (guardian_links) IS the permission model. A
-- single adult can hold a family link to one student and a mentor link to
-- a different student — or even both link types to the same student —
-- and what they can see/do is resolved PER RELATIONSHIP, never by a
-- global "current mode" flag. This is the concrete implementation of
-- "relationship-aware permissions, not mode-switching."

-- ── Trusted adult accounts ──────────────────────────────────────────────
create table if not exists public.trusted_adults (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  full_name text not null,
  contact_email text not null,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.trusted_adults enable row level security;

drop policy if exists "trusted adults manage own row" on public.trusted_adults;
create policy "trusted adults manage own row" on public.trusted_adults
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ── Relationship invites ────────────────────────────────────────────────
-- Either side can initiate (an adult inviting a student, or a student
-- inviting a trusted adult) — accepted by whichever side did NOT
-- initiate, via a shared invite code rather than an email lookup, so this
-- never needs to query auth.users directly from client-facing code.
create table if not exists public.guardian_link_invites (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references auth.users(id) on delete cascade,
  created_by_role text not null check (created_by_role in ('adult', 'student')),
  link_type text not null check (link_type in ('family', 'mentor')),
  invite_code text not null unique,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'revoked', 'expired')),
  expires_at timestamptz not null default (now() + interval '7 days'),
  created_at timestamptz not null default now(),
  accepted_at timestamptz
);

create index if not exists guardian_link_invites_code_idx on public.guardian_link_invites (invite_code) where status = 'pending';

alter table public.guardian_link_invites enable row level security;

drop policy if exists "creator reads own invites" on public.guardian_link_invites;
create policy "creator reads own invites" on public.guardian_link_invites
  for select to authenticated using (auth.uid() = created_by);
-- No direct client insert/update policy — goes through the RPCs below,
-- which validate role/expiry consistently in one place.

-- ── The relationship + permission model ─────────────────────────────────
create table if not exists public.guardian_links (
  id uuid primary key default gen_random_uuid(),
  -- References trusted_adults, NOT auth.users directly — same reasoning
  -- as student_user_id below: only a direct FK lets PostgREST resolve an
  -- embedded `trusted_adults:adult_user_id(full_name)` select (used by
  -- quillglow-main's /api/guardian-links to show the student which adult
  -- a link is with). trusted_adults.user_id is unique, so this is a valid
  -- FK target and enforces the same integrity auth.users(id) would.
  adult_user_id uuid not null references public.trusted_adults(user_id) on delete cascade,
  -- References profiles, NOT auth.users directly. Both would enforce the
  -- same integrity (profiles.id is itself a FK to auth.users), but only a
  -- direct FK lets PostgREST resolve the embedded
  -- `profiles:student_user_id(display_name)` select the portal uses to
  -- show learner names — without it that join silently returns null and
  -- every student renders as "Student".
  student_user_id uuid not null references public.profiles(id) on delete cascade,
  link_type text not null check (link_type in ('family', 'mentor')),
  status text not null default 'active' check (status in ('active', 'revoked')),
  -- Per-relationship permission flags — this is what "relationship-aware"
  -- means concretely. Populated with type-appropriate defaults on
  -- creation (see accept_guardian_link_invite below), editable later by
  -- either party without needing new code for new permission combinations.
  permissions jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  revoked_at timestamptz,
  unique (adult_user_id, student_user_id, link_type)
);

create index if not exists guardian_links_adult_idx on public.guardian_links (adult_user_id) where status = 'active';
create index if not exists guardian_links_student_idx on public.guardian_links (student_user_id) where status = 'active';

alter table public.guardian_links enable row level security;

-- Both sides of a relationship can see it — a student should always be
-- able to see who has a standing link to their account, same as the
-- adult can.
drop policy if exists "adult reads own links" on public.guardian_links;
create policy "adult reads own links" on public.guardian_links
  for select to authenticated using (auth.uid() = adult_user_id);

drop policy if exists "student reads own links" on public.guardian_links;
create policy "student reads own links" on public.guardian_links
  for select to authenticated using (auth.uid() = student_user_id);

-- Either party can revoke a link that involves them — a family/mentor
-- relationship should never be able to trap one side into association
-- neither wants. Only revocation (a narrowed update) is allowed directly;
-- permission edits go through a validating RPC below.
drop policy if exists "either party revokes own link" on public.guardian_links;
create policy "either party revokes own link" on public.guardian_links
  for update to authenticated
  using (auth.uid() = adult_user_id or auth.uid() = student_user_id)
  with check (status = 'revoked');

-- Default permission sets per link type. Guardian (family) defaults are
-- view-only across the scholarship lifecycle. Mentor defaults add active
-- review/verification capabilities but explicitly EXCLUDE fund control —
-- "the mentor should not control scholarship funds" is enforced here as
-- the actual default, not just documented intent.
create or replace function public.default_permissions_for_link_type(p_link_type text)
returns jsonb
language sql immutable
as $$
  select case p_link_type
    when 'family' then jsonb_build_object(
      'view_applications', true,
      'view_application_status', true,
      'view_required_documents', true,
      'view_deadlines', true,
      'view_scholarship_matches', true,
      'view_award_status', true,
      'view_disbursement_status', true,
      'view_learning_progress', true,
      'manage_scholarship_funds', false
    )
    when 'mentor' then jsonb_build_object(
      'review_applications', true,
      'verify_supporting_information', true,
      'provide_recommendations', true,
      'identify_missing_requirements', true,
      'submit_mentor_assessment', true,
      'track_assigned_applications', true,
      'view_learning_progress', true,
      'manage_scholarship_funds', false
    )
    else '{}'::jsonb
  end;
$$;

-- Step 1 of the invite flow: either an adult or a student creates a
-- pending invite carrying a short shareable code.
-- OUT parameters are named with an out_ prefix deliberately. A bare
-- `returns table (invite_code text)` creates a variable named
-- invite_code that collides with the COLUMN of the same name — Postgres
-- then rejects `where invite_code = ...` with "column reference
-- invite_code is ambiguous". Prefixing removes the collision entirely
-- rather than relying on qualification at every single use site.
-- CREATE OR REPLACE cannot change a function's OUT-parameter shape
-- (Postgres error 42P13) — only its body. This function's return columns
-- were renamed (invite_code -> out_invite_code) to fix the ambiguous-
-- column bug below, so the old signature must be dropped explicitly
-- first. Safe to re-run: IF EXISTS makes this a no-op once the new
-- signature is already in place.
drop function if exists public.create_guardian_link_invite(text, text);

create or replace function public.create_guardian_link_invite(
  p_created_by_role text,
  p_link_type text
)
returns table (out_invite_id uuid, out_invite_code text)
language plpgsql security definer set search_path = public as $$
declare
  v_code text;
  v_id uuid;
begin
  if p_created_by_role not in ('adult', 'student') then
    raise exception 'created_by_role must be adult or student';
  end if;
  if p_link_type not in ('family', 'mentor') then
    raise exception 'link_type must be family or mentor';
  end if;

  -- Short, human-shareable code — 8 characters, uppercase alphanumeric,
  -- collision-checked (astronomically unlikely at this length/volume, but
  -- checked rather than assumed).
  loop
    v_code := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8));
    exit when not exists (select 1 from public.guardian_link_invites gli where gli.invite_code = v_code);
  end loop;

  insert into public.guardian_link_invites (created_by, created_by_role, link_type, invite_code)
  values (auth.uid(), p_created_by_role, p_link_type, v_code)
  returning id into v_id;

  return query select v_id, v_code;
end;
$$;

grant execute on function public.create_guardian_link_invite(text, text) to authenticated;

-- Step 2: the OTHER party redeems the code, creating the actual
-- relationship with type-appropriate default permissions.
-- Same out_ prefix reasoning as create_guardian_link_invite above:
-- `link_type` as a bare OUT param collides with the column of the same
-- name in the INSERT, the ON CONFLICT target, and the RETURNING clause.
-- Same reason as create_guardian_link_invite above — link_type ->
-- out_link_type changed the OUT-parameter shape, so the old signature
-- must be dropped before CREATE OR REPLACE can succeed.
drop function if exists public.accept_guardian_link_invite(text);

create or replace function public.accept_guardian_link_invite(p_invite_code text)
returns table (out_link_id uuid, out_link_type text)
language plpgsql security definer set search_path = public as $$
declare
  v_invite record;
  v_adult_id uuid;
  v_student_id uuid;
  v_new_link_id uuid;
begin
  select * into v_invite from public.guardian_link_invites gli
  where gli.invite_code = upper(p_invite_code) and gli.status = 'pending'
  for update;

  if not found then
    raise exception 'Invite code not found or already used';
  end if;
  if v_invite.expires_at < now() then
    update public.guardian_link_invites set status = 'expired' where id = v_invite.id;
    raise exception 'Invite code has expired';
  end if;
  if v_invite.created_by = auth.uid() then
    raise exception 'Cannot accept your own invite';
  end if;

  if v_invite.created_by_role = 'adult' then
    v_adult_id := v_invite.created_by;
    v_student_id := auth.uid();
  else
    v_adult_id := auth.uid();
    v_student_id := v_invite.created_by;
  end if;

  insert into public.guardian_links (adult_user_id, student_user_id, link_type, permissions)
  values (v_adult_id, v_student_id, v_invite.link_type, public.default_permissions_for_link_type(v_invite.link_type))
  on conflict (adult_user_id, student_user_id, link_type)
    do update set status = 'active', revoked_at = null, updated_at = now()
  returning id into v_new_link_id;

  update public.guardian_link_invites set status = 'accepted', accepted_at = now() where id = v_invite.id;

  return query select v_new_link_id, v_invite.link_type;
end;
$$;

grant execute on function public.accept_guardian_link_invite(text) to authenticated;

-- Lets either party adjust permissions on an existing link within reason —
-- a family member might want to grant/withhold a specific view, for
-- example. manage_scholarship_funds is deliberately NOT settable through
-- this function for mentor-type links — that boundary is enforced here,
-- not just by a default that could be edited away client-side.
create or replace function public.update_guardian_link_permissions(
  p_link_id uuid,
  p_permissions jsonb
)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_link record;
  v_safe_permissions jsonb;
begin
  select * into v_link from public.guardian_links gl where gl.id = p_link_id and gl.status = 'active';
  -- IF NOT FOUND, not `if v_link is null` — a record variable after a
  -- zero-row SELECT INTO is not NULL as a whole, so the null check would
  -- silently pass and then fail confusingly on the first field access.
  if not found then
    raise exception 'Link not found or not active';
  end if;
  if auth.uid() not in (v_link.adult_user_id, v_link.student_user_id) then
    raise exception 'Not authorized to modify this link';
  end if;

  v_safe_permissions := p_permissions;
  if v_link.link_type = 'mentor' then
    v_safe_permissions := jsonb_set(v_safe_permissions, '{manage_scholarship_funds}', 'false'::jsonb);
  end if;

  update public.guardian_links
  set permissions = v_safe_permissions, updated_at = now()
  where id = p_link_id;
end;
$$;

grant execute on function public.update_guardian_link_permissions(uuid, jsonb) to authenticated;

-- Benefactor accounts + opportunity submission/review workflow.
--
-- Benefactors are a THIRD actor alongside students and admins:
--   student   -> reads matched opportunities, applies
--   benefactor-> submits scholarships for review, tracks their own
--   admin     -> reviews submissions, publishes directly
--
-- They share Supabase auth with students (same project, same auth.users), and
-- are distinguished by a row in `benefactors`. This avoids a parallel auth
-- system while keeping the two account types cleanly separable.

-- ── Benefactor accounts ─────────────────────────────────────────────────────
create table if not exists public.benefactors (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  organization_name text not null,
  contact_name text not null,
  contact_email text not null,
  phone text,
  website text,
  country text,
  organization_type text default 'foundation',
    -- foundation | company | ngo | government | individual | university
  description text,

  -- Benefactors must be vetted before their scholarships can go live.
  -- An unverified benefactor can still draft, but cannot submit for review.
  verification_status text not null default 'pending',
    -- pending | verified | rejected | suspended
  verification_notes text,
  verified_at timestamptz,
  verified_by uuid,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists benefactors_user_idx on public.benefactors (user_id);
create index if not exists benefactors_status_idx on public.benefactors (verification_status);

alter table public.benefactors enable row level security;

-- A benefactor can read and update their own record, but NOT their own
-- verification_status — that is enforced by the trigger below, since a column
-- level restriction isn't expressible in a simple RLS policy.
drop policy if exists "benefactors read own" on public.benefactors;
create policy "benefactors read own"
  on public.benefactors for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "benefactors insert own" on public.benefactors;
create policy "benefactors insert own"
  on public.benefactors for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "benefactors update own" on public.benefactors;
create policy "benefactors update own"
  on public.benefactors for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Prevent self-verification. Without this, a benefactor could PATCH their own
-- row to verification_status = 'verified' and bypass admin review entirely.
create or replace function public.protect_benefactor_verification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if current_setting('role', true) is distinct from 'service_role'
     and auth.uid() is not null then
    new.verification_status := old.verification_status;
    new.verified_at         := old.verified_at;
    new.verified_by         := old.verified_by;
    new.verification_notes  := old.verification_notes;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_protect_benefactor_verification on public.benefactors;
create trigger trg_protect_benefactor_verification
before update on public.benefactors
for each row execute function public.protect_benefactor_verification();

-- ── Opportunity ownership + review workflow ─────────────────────────────────
alter table public.opportunities
  add column if not exists benefactor_id uuid references public.benefactors(id) on delete set null,
  add column if not exists submitted_by uuid references auth.users(id) on delete set null,
  add column if not exists review_status text not null default 'approved',
    -- draft | pending_review | approved | rejected | changes_requested
  add column if not exists review_notes text,
  add column if not exists reviewed_at timestamptz,
  add column if not exists reviewed_by uuid,
  add column if not exists submitted_at timestamptz;

-- Anything an admin created directly is approved by definition; this backfills
-- existing rows so the new column doesn't hide them from students.
update public.opportunities
set review_status = 'approved'
where review_status is null;

create index if not exists opportunities_review_idx
  on public.opportunities (review_status, submitted_at desc);
create index if not exists opportunities_benefactor_idx
  on public.opportunities (benefactor_id);

-- Students must only ever see approved + active opportunities. Replace the
-- earlier policy, which only checked status.
drop policy if exists "active opportunities are public" on public.opportunities;
create policy "approved active opportunities are public"
  on public.opportunities for select to authenticated
  using (status = 'active' and review_status = 'approved');

-- Benefactors can see and manage their own submissions at any review stage.
drop policy if exists "benefactors read own opportunities" on public.opportunities;
create policy "benefactors read own opportunities"
  on public.opportunities for select to authenticated
  using (
    benefactor_id in (select id from public.benefactors where user_id = auth.uid())
  );

drop policy if exists "benefactors insert own opportunities" on public.opportunities;
create policy "benefactors insert own opportunities"
  on public.opportunities for insert to authenticated
  with check (
    benefactor_id in (select id from public.benefactors where user_id = auth.uid())
  );

drop policy if exists "benefactors update own opportunities" on public.opportunities;
create policy "benefactors update own opportunities"
  on public.opportunities for update to authenticated
  using (
    benefactor_id in (select id from public.benefactors where user_id = auth.uid())
  )
  with check (
    benefactor_id in (select id from public.benefactors where user_id = auth.uid())
  );

-- Mirror of the benefactor-verification guard: a benefactor must not be able to
-- approve their own scholarship by writing review_status directly.
create or replace function public.protect_opportunity_review()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_is_owner boolean;
begin
  select exists (
    select 1 from public.benefactors b
    where b.id = new.benefactor_id and b.user_id = auth.uid()
  ) into v_is_owner;

  -- Only a benefactor editing their own row is restricted. Admin writes come
  -- through the service role, where auth.uid() is null.
  if auth.uid() is not null and v_is_owner then
    -- They may move draft -> pending_review (submit). Nothing else.
    if not (old.review_status in ('draft', 'changes_requested')
            and new.review_status = 'pending_review') then
      new.review_status := old.review_status;
    end if;

    new.reviewed_at  := old.reviewed_at;
    new.reviewed_by  := old.reviewed_by;
    new.review_notes := old.review_notes;

    -- An approved listing must not be silently edited back into circulation
    -- with different terms; edits push it back for re-review.
    if old.review_status = 'approved' then
      new.review_status := 'pending_review';
      new.submitted_at := now();
    end if;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_protect_opportunity_review on public.opportunities;
create trigger trg_protect_opportunity_review
before update on public.opportunities
for each row execute function public.protect_opportunity_review();

-- ── Helper: is the current user a benefactor? ───────────────────────────────
create or replace function public.get_my_benefactor()
returns table (
  id uuid,
  organization_name text,
  contact_name text,
  verification_status text
)
language sql
stable
security definer
set search_path = public
as $$
  select b.id, b.organization_name, b.contact_name, b.verification_status
  from public.benefactors b
  where b.user_id = auth.uid();
$$;

grant execute on function public.get_my_benefactor() to authenticated;

-- ── Benefactor dashboard stats ──────────────────────────────────────────────
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
    ), 0),
    coalesce(sum(o.award_amount), 0)
  from public.opportunities o
  where o.benefactor_id = p_benefactor_id;
$$;

grant execute on function public.benefactor_stats(uuid) to authenticated;

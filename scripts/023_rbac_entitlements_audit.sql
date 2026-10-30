-- Milestone 2 + 9 · RBAC, entitlements, audit logging
--
-- Spec §21: roles and permissions, authorized SERVER-SIDE.
-- Spec §16: feature access flows User -> Subscription -> Entitlements -> Feature,
--           so pricing can change without rebuilding the application.
-- Spec §22: audit logs for administrative and high-risk actions.

-- ── Roles ───────────────────────────────────────────────────────────────────
create table if not exists public.user_roles (
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('student', 'mentor', 'benefactor', 'admin')),
  granted_at timestamptz not null default now(),
  granted_by uuid,
  primary key (user_id, role)
);

create index if not exists user_roles_role_idx on public.user_roles (role);

alter table public.user_roles enable row level security;

drop policy if exists "users read own roles" on public.user_roles;
create policy "users read own roles" on public.user_roles
  for select to authenticated using (auth.uid() = user_id);
-- No client write policies: roles are granted server-side only.

-- ── Role -> permission mapping ──────────────────────────────────────────────
create table if not exists public.role_permissions (
  role text not null,
  permission text not null,
  primary key (role, permission)
);

alter table public.role_permissions enable row level security;

drop policy if exists "permissions readable" on public.role_permissions;
create policy "permissions readable" on public.role_permissions
  for select to authenticated using (true);

insert into public.role_permissions (role, permission) values
  ('student',    'learning.read'),
  ('student',    'learning.create'),
  ('student',    'scholarship.apply'),
  ('student',    'marketplace.purchase'),

  ('mentor',     'learning.read'),
  ('mentor',     'learning.create'),
  ('mentor',     'scholarship.review'),

  ('benefactor', 'scholarship.create'),
  ('benefactor', 'funding.manage'),

  ('admin',      'learning.read'),
  ('admin',      'learning.create'),
  ('admin',      'scholarship.apply'),
  ('admin',      'scholarship.review'),
  ('admin',      'scholarship.create'),
  ('admin',      'funding.manage'),
  ('admin',      'marketplace.purchase'),
  ('admin',      'marketplace.manage'),
  ('admin',      'platform.administer')
on conflict do nothing;

-- ── Entitlements (spec §16) ─────────────────────────────────────────────────
-- Plan -> entitlement, so changing what Premium includes is a SQL update.
create table if not exists public.plan_entitlements (
  plan text not null,                -- free | premium
  entitlement text not null,
  primary key (plan, entitlement)
);

alter table public.plan_entitlements enable row level security;

drop policy if exists "entitlements readable" on public.plan_entitlements;
create policy "entitlements readable" on public.plan_entitlements
  for select to authenticated using (true);

insert into public.plan_entitlements (plan, entitlement) values
  ('free',    'basic_learning'),
  ('free',    'scholarship_discovery'),
  ('free',    'marketplace_access'),
  ('free',    'basic_progress'),

  ('premium', 'basic_learning'),
  ('premium', 'premium_learning'),
  ('premium', 'advanced_ai'),
  ('premium', 'exam_coach'),
  ('premium', 'scholarship_assistance'),
  ('premium', 'scholarship_discovery'),
  ('premium', 'premium_analytics'),
  ('premium', 'marketplace_access'),
  ('premium', 'marketplace_discount'),
  ('premium', 'basic_progress')
on conflict do nothing;

-- ── Resolve a user's permissions + entitlements in one call ─────────────────
create or replace function public.get_user_access(p_user_id uuid)
returns table (
  roles text[],
  permissions text[],
  plan text,
  entitlements text[]
)
language plpgsql stable security definer set search_path = public as $$
declare
  v_roles text[];
  v_plan text;
begin
  select coalesce(array_agg(distinct r.role), array['student']::text[])
  into v_roles
  from public.user_roles r
  where r.user_id = p_user_id;

  -- Everyone is at least a student.
  if v_roles is null or array_length(v_roles, 1) is null then
    v_roles := array['student']::text[];
  end if;

  select case when s.plan_type in ('genius', 'premium') then 'premium' else 'free' end
  into v_plan
  from public.subscriptions s
  where s.user_id = p_user_id and s.status = 'active'
  limit 1;

  v_plan := coalesce(v_plan, 'free');

  return query
  select
    v_roles,
    coalesce((
      select array_agg(distinct rp.permission)
      from public.role_permissions rp
      where rp.role = any(v_roles)
    ), array[]::text[]),
    v_plan,
    coalesce((
      select array_agg(distinct pe.entitlement)
      from public.plan_entitlements pe
      where pe.plan = v_plan
    ), array[]::text[]);
end;
$$;

grant execute on function public.get_user_access(uuid) to authenticated;

create or replace function public.user_has_permission(p_user_id uuid, p_permission text)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.user_roles r
    join public.role_permissions rp on rp.role = r.role
    where r.user_id = p_user_id and rp.permission = p_permission
  )
  or (
    -- Implicit student role for users with no explicit role row.
    not exists (select 1 from public.user_roles where user_id = p_user_id)
    and exists (
      select 1 from public.role_permissions
      where role = 'student' and permission = p_permission
    )
  );
$$;

grant execute on function public.user_has_permission(uuid, text) to authenticated;

-- Backfill existing benefactors.
insert into public.user_roles (user_id, role)
select b.user_id, 'benefactor' from public.benefactors b
on conflict do nothing;

-- Backfill alone is not enough: benefactors registering AFTER this migration
-- would otherwise never receive the role, and would silently lack
-- scholarship.create. Keep the role in sync with the table.
create or replace function public.sync_benefactor_role()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.user_roles (user_id, role)
  values (new.user_id, 'benefactor')
  on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists trg_sync_benefactor_role on public.benefactors;
create trigger trg_sync_benefactor_role
after insert on public.benefactors
for each row execute function public.sync_benefactor_role();

-- Removing a benefactor record removes the role with it.
create or replace function public.revoke_benefactor_role()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  delete from public.user_roles
  where user_id = old.user_id and role = 'benefactor';
  return old;
end;
$$;

drop trigger if exists trg_revoke_benefactor_role on public.benefactors;
create trigger trg_revoke_benefactor_role
after delete on public.benefactors
for each row execute function public.revoke_benefactor_role();

-- ── Audit log (spec §22) ────────────────────────────────────────────────────
create table if not exists public.audit_log (
  id bigserial primary key,
  actor_id uuid references auth.users(id) on delete set null,
  actor_role text,
  action text not null,               -- scholarship.approved | role.granted | ...
  resource_type text,
  resource_id text,
  before_state jsonb,
  after_state jsonb,
  ip_address text,
  user_agent text,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists audit_actor_idx on public.audit_log (actor_id, created_at desc);
create index if not exists audit_action_idx on public.audit_log (action, created_at desc);
create index if not exists audit_resource_idx on public.audit_log (resource_type, resource_id);

alter table public.audit_log enable row level security;
-- Append-only, server-side. No client policies at all: an audit log a user can
-- read or edit is not an audit log.

create or replace function public.write_audit_log(
  p_actor_id uuid,
  p_action text,
  p_resource_type text default null,
  p_resource_id text default null,
  p_before jsonb default null,
  p_after jsonb default null,
  p_metadata jsonb default '{}'::jsonb,
  p_ip text default null,
  p_user_agent text default null
)
returns bigint
language plpgsql security definer set search_path = public as $$
declare
  v_id bigint;
  v_role text;
begin
  select role into v_role from public.user_roles where user_id = p_actor_id limit 1;

  insert into public.audit_log (
    actor_id, actor_role, action, resource_type, resource_id,
    before_state, after_state, metadata, ip_address, user_agent
  ) values (
    p_actor_id, v_role, p_action, p_resource_type, p_resource_id,
    p_before, p_after, coalesce(p_metadata, '{}'::jsonb), p_ip, p_user_agent
  )
  returning id into v_id;

  return v_id;
end;
$$;

-- Rails 2 and 3 stop being architecture-only and get real redemption paths.
-- Both reuse the exact same wallet debit + payout_orders flow as Rail 1 —
-- "redeem your balance" now has three destinations instead of one:
--   Gift card / prepaid card  → Rail 1 (unchanged)
--   Paid to your institution  → Rail 2 (new)
--   Bank transfer / cash      → Rail 3 (new)

alter table public.payout_orders drop constraint if exists payout_orders_delivery_method_check;
alter table public.payout_orders add constraint payout_orders_delivery_method_check
  check (delivery_method in ('reward', 'gift_card', 'institutional_payment', 'bank_transfer'));

-- A directory of institutions students can direct Rail-2 payments to.
-- Kept intentionally simple — name + contact email is enough for a
-- provider (Trolley/Airwallex) to onboard a payee. Admin-managed.
create table if not exists public.institutions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  country text,
  contact_name text,
  contact_email text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.institutions enable row level security;

drop policy if exists "authenticated users read active institutions" on public.institutions;
create policy "authenticated users read active institutions" on public.institutions
  for select to authenticated using (is_active);
-- Writes are service-role only (admin app), same pattern as disbursement_providers.

alter table public.payout_orders
  add column if not exists institution_id uuid references public.institutions(id);

create index if not exists payout_orders_institution_idx on public.payout_orders (institution_id) where institution_id is not null;

-- The actual "switch provider" operation the admin panel calls. Atomic so
-- the partial unique index (one active provider per rail) is never
-- violated mid-update, and so a concurrent payout mid-flight always sees
-- either the old or the new provider, never a rail with zero active rows.
create or replace function public.set_active_disbursement_provider(p_provider_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_rail smallint;
begin
  select rail into v_rail from public.disbursement_providers where id = p_provider_id;
  if v_rail is null then
    raise exception 'No disbursement provider with id %', p_provider_id;
  end if;

  update public.disbursement_providers set is_active = false, updated_at = now() where rail = v_rail;
  update public.disbursement_providers set is_active = true, updated_at = now() where id = p_provider_id;
end;
$$;
-- Service-role only (admin app's createAdminClient) — no grant to authenticated.

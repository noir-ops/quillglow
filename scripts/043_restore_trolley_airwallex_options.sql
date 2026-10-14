-- Trolley and Airwallex return to Rails 2/3 as registered, inactive
-- options alongside Stripe Connect (which stays active on both rails).
-- Real choice between providers — not a Stripe-only architecture — was
-- the original design intent; this restores that roster after a brief
-- period where migration 040 removed Trolley/Airwallex rows entirely
-- rather than just deactivating them.
--
-- Nothing about money movement changes: Stripe Connect remains the one
-- active provider on both rails until someone deliberately flips a
-- different row active in /admin/disbursements.

-- Fixes a latent gap: earlier seed inserts (038/040/042) relied on bare
-- "ON CONFLICT DO NOTHING" with no actual unique constraint on
-- (rail, provider_key) to catch a re-run, meaning a repeated migration
-- could have silently inserted duplicate rows. Clean up any that exist
-- before adding the constraint below, so this migration can't fail on a
-- database where that already happened.
delete from public.disbursement_providers a
using public.disbursement_providers b
where a.id > b.id
  and a.rail = b.rail
  and a.provider_key = b.provider_key;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'disbursement_providers_rail_provider_key_unique'
  ) then
    alter table public.disbursement_providers
      add constraint disbursement_providers_rail_provider_key_unique unique (rail, provider_key);
  end if;
end $$;

insert into public.disbursement_providers (rail, provider_key, display_name, is_active) values
  (2, 'trolley', 'Trolley', false),
  (2, 'airwallex', 'Airwallex', false),
  (3, 'trolley', 'Trolley', false),
  (3, 'airwallex', 'Airwallex', false)
on conflict (rail, provider_key) do nothing;

-- Belt-and-suspenders: confirm Stripe Connect is still the sole active
-- provider on both rails after this insert (it should already be, from
-- 040/042 — this just makes the invariant explicit rather than assumed).
update public.disbursement_providers set is_active = false
where rail in (2, 3) and provider_key in ('trolley', 'airwallex');

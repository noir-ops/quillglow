-- Reported bug: Family Wallet shop purchase — "Payment succeeded but
-- order creation failed." The charge_family_wallet debit correctly
-- succeeded (confirmed from the screenshot — balance was deducted); the
-- failure is entirely in the follow-up study_tracker_orders insert.
--
-- study_tracker_orders was never added through this migration history —
-- it exists in the live database from before these migrations started,
-- so its exact constraints aren't visible in this repo. The only thing
-- meaningfully different between this insert and the long-working Polar
-- version is one new value: payment_provider = 'family_wallet', where
-- only 'polar' has ever been written before. That's the same shape of
-- bug as payout_orders_delivery_method_check (039/053) — a CHECK
-- constraint that was never told about a new valid value.
--
-- Since the constraint's exact name isn't knowable from here, this finds
-- it dynamically (same approach as 047's guardian_links FK fix) rather
-- than guessing a name that might not match.

do $$
declare
  v_constraint record;
begin
  for v_constraint in
    select con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    where rel.relname = 'study_tracker_orders'
      and con.contype = 'c'
      and pg_get_constraintdef(con.oid) ilike '%payment_provider%'
  loop
    execute format('alter table public.study_tracker_orders drop constraint %I', v_constraint.conname);
  end loop;
end $$;

alter table public.study_tracker_orders
  add constraint study_tracker_orders_payment_provider_check
  check (payment_provider in ('polar', 'family_wallet'));

-- Defensive: the known-working insert always supplied polar_session_id;
-- the family-wallet insert never has one, since no Polar checkout
-- happened. If that column is NOT NULL, this was a second silent cause
-- of the same failure. Making it nullable is a no-op if it already was.
alter table public.study_tracker_orders alter column polar_session_id drop not null;

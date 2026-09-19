-- Rail 4 (Blockchain/Stablecoin) was registered as active in
-- disbursement_providers since 042, but nothing in the student wallet
-- could actually reach it: 'stablecoin' was never a valid
-- delivery_method, and payout_orders had nowhere to record a
-- destination wallet address at all. This is why the redeem dialog only
-- ever showed three tabs — the fourth had no path to the database, not
-- just no UI.

alter table public.payout_orders drop constraint if exists payout_orders_delivery_method_check;
alter table public.payout_orders add constraint payout_orders_delivery_method_check
  check (delivery_method in ('reward', 'gift_card', 'institutional_payment', 'bank_transfer', 'stablecoin'));

alter table public.payout_orders
  add column if not exists recipient_wallet_address text,
  add column if not exists recipient_chain text;

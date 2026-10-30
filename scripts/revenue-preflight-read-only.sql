-- READ ONLY: run against staging, then the intended production project.
select name, to_regclass('public.'||name) is not null as exists
from unnest(array['subscriptions','usage_tracking','plan_limits','polar_webhook_events',
  'family_wallets','family_wallet_transactions','ambassadors','referrals','profiles','user_roles','role_permissions','plan_entitlements']) as x(name);
select signature,to_regprocedure(signature) is not null as exists from unnest(array[
  'public.user_plan(uuid)','public.my_plan()','public.consume_ai_quota(uuid,text,integer)',
  'public.refund_ai_quota(uuid,text,integer)','public.get_ai_quota_status(uuid)',
  'public.charge_family_wallet(uuid,numeric,text,text,text,text)']) as x(signature);
-- Review incomplete legacy Polar bindings; the migration does not invent dates.
select status,count(*) as rows,count(*) filter(where current_period_end is null) as missing_period_end
from public.subscriptions
where polar_subscription_id is not null or polar_checkout_id is not null group by status;
select plan_type,feature,monthly_limit from public.plan_limits order by plan_type,feature;
-- Additional subscription writers/triggers must be reviewed before deploying.
select t.tgname,pg_get_triggerdef(t.oid) from pg_trigger t
where t.tgrelid='public.subscriptions'::regclass and not t.tgisinternal;

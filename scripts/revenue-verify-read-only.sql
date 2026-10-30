-- READ ONLY. Expected: no client write privileges, no exposed maintenance RPCs.
select t as table_name,has_table_privilege('authenticated','public.'||t,'INSERT,UPDATE,DELETE') as client_table_write,
 has_any_column_privilege('authenticated','public.'||t,'INSERT,UPDATE') as client_column_write,
 has_table_privilege('service_role','public.'||t,'INSERT,UPDATE,DELETE') as server_write
from unnest(array['subscriptions','usage_tracking','plan_limits']) as x(t);
select p.proname,has_function_privilege('anon',p.oid,'EXECUTE') as anon_execute,
 has_function_privilege('authenticated',p.oid,'EXECUTE') as client_execute,
 has_function_privilege('service_role',p.oid,'EXECUTE') as server_execute,
 p.proconfig as function_settings
from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'
 and p.proname in ('sync_polar_subscription','expire_genius_subscriptions','claim_billing_job','finish_billing_job',
 'grant_ambassador_genius','finalize_confirmed_referral','my_plan','user_plan','consume_ai_quota','refund_ai_quota','get_ai_quota_status');
select status,public.user_plan(user_id) as effective_plan,count(*) from public.subscriptions
group by status,public.user_plan(user_id) order by status,effective_plan;
select job_name,last_started_at,last_completed_at,last_error,last_summary from public.billing_job_state;
select outcome,count(*) from public.polar_webhook_events where received_at>now()-interval '48 hours' group by outcome;

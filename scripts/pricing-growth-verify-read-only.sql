-- Inspect only. Run in the intended project's SQL editor after migration.
begin read only;
select revision,environment,legacy_monthly_cents,monthly_cents,annual_cents,currency,
 launch_at,authorized_at,phase3_enabled,phase3_started_at,
 public.billing_current_monthly_cents() as monthly_cents_effective_now
from public.billing_rollout where id;
select e.revision,e.environment,e.kind,e.verified_at
from public.billing_rollout_evidence e
join public.billing_rollout r on r.revision=e.revision and r.environment=e.environment
order by e.kind;
select tablename,rowsecurity from pg_tables where schemaname='public'
and tablename in ('billing_rollout','billing_rollout_evidence','billing_feature_daily','billing_funnel_events');
select public.billing_growth_report(30) as aggregate_growth_report;
commit;

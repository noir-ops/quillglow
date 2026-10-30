-- Phases 2 and 3. Apply AFTER Phase 1. Both rollout switches start OFF.
-- Existing products, subscription amounts, grants and plan_limits are untouched.
begin;
set local lock_timeout='5s';
do $$ begin
 if to_regprocedure('public.consume_ai_quota_v2(uuid,text,integer)') is null then
  raise exception 'Apply Phase 1 plan_limits_source_of_truth first';
 end if;
end $$;
create table if not exists public.billing_rollout (
 id boolean primary key default true check(id), revision int not null default 1,
 environment text not null default 'production' check(environment in ('sandbox','production')),
 legacy_monthly_cents int not null default 499 check(legacy_monthly_cents=499),
 monthly_cents int not null default 599 check(monthly_cents=599),
 annual_cents int not null default 5999 check(annual_cents=5999),
 currency text not null default 'usd' check(currency='usd'),
 legacy_product_id text, monthly_product_id text, annual_product_id text,
 launch_at timestamptz, authorized_at timestamptz,
 phase3_enabled boolean not null default false, phase3_started_at timestamptz,
 updated_at timestamptz not null default now()
);
insert into public.billing_rollout(id) values(true) on conflict do nothing;
create table if not exists public.billing_rollout_evidence (
 revision int not null, environment text not null check(environment in ('sandbox','production')),
 kind text not null check(kind in ('monthly_buy','annual_buy','discount_buy','cancel','sync_health','phase1_review')),
 verified_at timestamptz not null default now(), actor_id uuid references auth.users(id),
 evidence jsonb not null, primary key(revision,environment,kind)
);
create table if not exists public.billing_feature_daily (
 day date not null,user_id uuid not null references auth.users(id) on delete cascade,
 feature text not null,plan text not null check(plan in ('scholar','genius')),
 requests bigint not null default 0,limit_hits bigint not null default 0,units bigint not null default 0,
 primary key(day,user_id,feature,plan)
);
create table if not exists public.billing_funnel_events (
 event_key text primary key,user_id uuid not null references auth.users(id) on delete cascade,
 kind text not null check(kind in ('offer_view','upgrade_click','checkout_started','genius_activation')),
 feature text not null,plan text not null check(plan in ('scholar','genius')),
 created_at timestamptz not null default now()
);
create index if not exists billing_feature_daily_day_idx on public.billing_feature_daily(day);
create index if not exists billing_funnel_time_idx on public.billing_funnel_events(created_at,user_id);
alter table public.billing_rollout enable row level security;
alter table public.billing_rollout_evidence enable row level security;
alter table public.billing_feature_daily enable row level security;
alter table public.billing_funnel_events enable row level security;
revoke all on public.billing_rollout,public.billing_rollout_evidence,public.billing_feature_daily,public.billing_funnel_events from public,anon,authenticated;
grant select,insert,update,delete on public.billing_rollout,public.billing_rollout_evidence,public.billing_feature_daily,public.billing_funnel_events to service_role;

create or replace function public.billing_current_monthly_cents() returns int
language sql stable security definer set search_path='' as $$
 select case when authorized_at is not null and launch_at<=now() then monthly_cents else legacy_monthly_cents end
 from public.billing_rollout where id
$$;

-- Admin API performs provider verification and role checks before this service-only call.
create or replace function public.configure_billing_rollout(p_actor uuid,p_expected_revision int,p_config jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.billing_rollout%rowtype; next_launch timestamptz;
begin
 select * into r from public.billing_rollout where id for update;
 if r.revision is distinct from p_expected_revision then raise exception 'Configuration changed. Reload before saving.' using errcode='40001'; end if;
 if r.authorized_at is not null then raise exception 'Disable the scheduled rollout before editing its draft.' using errcode='22023'; end if;
 next_launch:=nullif(p_config->>'launch_at','')::timestamptz;
 if next_launch is not null and next_launch<=now() then raise exception 'Choose a future launch time.' using errcode='22023'; end if;
 update public.billing_rollout set
  legacy_product_id=nullif(p_config->>'legacy_product_id',''),monthly_product_id=nullif(p_config->>'monthly_product_id',''),
  annual_product_id=nullif(p_config->>'annual_product_id',''),environment=p_config->>'environment',launch_at=next_launch,authorized_at=null,
  revision=revision+1,updated_at=now() where id returning * into r;
 insert into public.audit_log(actor_id,actor_role,action,resource_type,resource_id,after_state)
 values(p_actor,'admin','billing_rollout.configure','billing_rollout','true',to_jsonb(r));
 return to_jsonb(r);
end $$;

create or replace function public.authorize_billing_rollout(p_actor uuid,p_revision int,p_environment text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.billing_rollout%rowtype; n int;
begin
 select * into r from public.billing_rollout where id for update;
 if r.revision is distinct from p_revision then raise exception 'Configuration changed. Repeat verification.' using errcode='40001'; end if;
 if r.launch_at is null or r.launch_at<=now() or r.legacy_product_id is null or r.monthly_product_id is null or r.annual_product_id is null
 or r.legacy_product_id=r.monthly_product_id or r.legacy_product_id=r.annual_product_id or r.monthly_product_id=r.annual_product_id then
  raise exception 'Set distinct old/monthly/annual product IDs and a future launch time.' using errcode='22023';
 end if;
 select count(*) into n from public.billing_rollout_evidence where revision=r.revision and environment=p_environment
  and verified_at>now()-interval '7 days';
 if n<>6 or r.environment<>p_environment then raise exception 'All six rollout gates need recent evidence for this environment.' using errcode='22023'; end if;
 update public.billing_rollout set authorized_at=now(),updated_at=now() where id returning * into r;
 insert into public.audit_log(actor_id,actor_role,action,resource_type,resource_id,after_state)
 values(p_actor,'admin','billing_rollout.authorize','billing_rollout','true',to_jsonb(r));
 return to_jsonb(r);
end $$;

create or replace function public.set_billing_growth_enabled(p_actor uuid,p_enabled boolean)
returns void language plpgsql security definer set search_path='' as $$
begin
 if p_enabled and not exists(select 1 from public.billing_rollout where id and authorized_at is not null and launch_at<=now()) then
  raise exception 'Launch the verified Phase 2 rollout first.' using errcode='22023';
 end if;
 update public.billing_rollout set phase3_enabled=p_enabled,
  phase3_started_at=case when p_enabled then coalesce(phase3_started_at,now()) else phase3_started_at end,updated_at=now() where id;
 insert into public.audit_log(actor_id,actor_role,action,resource_type,resource_id,after_state)
 values(p_actor,'admin','billing_growth.toggle','billing_rollout','true',jsonb_build_object('enabled',p_enabled));
end $$;

create or replace function public.disable_billing_rollout(p_actor uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
 -- Once live, stopping new sales must not silently revert advertised prices.
 if exists(select 1 from public.billing_rollout where id and authorized_at is not null and launch_at<=now()) then
  raise exception 'This rollout is live. Use a reviewed forward change; existing subscriptions must stay untouched.' using errcode='22023';
 end if;
 update public.billing_rollout set authorized_at=null,phase3_enabled=false,updated_at=now() where id;
 insert into public.audit_log(actor_id,actor_role,action,resource_type,resource_id)
 values(p_actor,'admin','billing_rollout.disable','billing_rollout','true');
end $$;

-- Keep the Phase 1 quota implementation and RPC contract intact. Tracking is
-- dormant until Phase 3 is explicitly enabled; no prompts/content are collected.
do $$ begin
 if to_regprocedure('public.consume_ai_quota_core(uuid,text,integer)') is null then
  alter function public.consume_ai_quota_v2(uuid,text,integer) rename to consume_ai_quota_core;
 end if;
end $$;
create or replace function public.consume_ai_quota_v2(p_user_id uuid,p_feature text,p_amount int default 1)
returns table(allowed boolean,used int,"limit" int,remaining int,plan text,blocked_feature text)
language plpgsql security definer set search_path='' as $$
declare q record;
begin
 select * into q from public.consume_ai_quota_core(p_user_id,p_feature,p_amount);
 if exists(select 1 from public.billing_rollout where id and phase3_enabled) then
  begin
  insert into public.billing_feature_daily(day,user_id,feature,plan,requests,limit_hits,units)
  values((now() at time zone 'UTC')::date,p_user_id,p_feature,q.plan,case when q.allowed then 1 else 0 end,
   case when q.allowed then 0 else 1 end,case when q.allowed then p_amount else 0 end)
  on conflict on constraint billing_feature_daily_pkey do update set requests=public.billing_feature_daily.requests+excluded.requests,
   limit_hits=public.billing_feature_daily.limit_hits+excluded.limit_hits,units=public.billing_feature_daily.units+excluded.units;
  exception when others then raise warning 'Billing usage analytics unavailable: %',sqlstate;
  end;
 end if;
 return query select q.allowed,q.used,q."limit",q.remaining,q.plan,q.blocked_feature;
end $$;
revoke execute on function public.consume_ai_quota_core(uuid,text,int) from public,anon,authenticated;
grant execute on function public.consume_ai_quota_core(uuid,text,int) to service_role;
revoke execute on function public.consume_ai_quota_v2(uuid,text,int) from public,anon;
grant execute on function public.consume_ai_quota_v2(uuid,text,int) to authenticated,service_role;

create or replace function public.record_billing_funnel_event(p_user uuid,p_kind text,p_feature text,p_reference text default null)
returns void language plpgsql security definer set search_path='' as $$
declare k text; p text;
begin
 if not exists(select 1 from public.billing_rollout where id and phase3_enabled) then return; end if;
 if p_user is null or p_kind not in ('offer_view','upgrade_click','checkout_started','genius_activation')
 or p_feature is null or p_feature !~ '^[a-z][a-z0-9_]{0,79}$' then raise exception 'Invalid event' using errcode='22023'; end if;
 p:=public.user_plan(p_user);
 k:=case when p_kind='genius_activation' then 'activation:'||p_user::text
  when p_kind='checkout_started' then 'checkout:'||coalesce(p_reference,'')
  else p_user::text||':'||p_kind||':'||p_feature||':'||to_char(now() at time zone 'UTC','YYYY-MM-DD') end;
 insert into public.billing_funnel_events(event_key,user_id,kind,feature,plan) values(k,p_user,p_kind,p_feature,p) on conflict do nothing;
end $$;
create or replace function public.observe_genius_activation() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if public.subscription_effective_plan(new)='genius' and (
  (new.polar_subscription_id is not null and new.status in ('active','canceling') and new.current_period_end>now())
  or exists(select 1 from public.family_wallet_transactions t join public.family_wallets w on w.id=t.family_wallet_id
   where w.student_user_id=new.user_id and t.idempotency_key='genius:'||new.user_id::text||':'||to_char(now() at time zone 'UTC','YYYY-MM'))
 ) then
  if tg_op='INSERT' then perform public.record_billing_funnel_event(new.user_id,'genius_activation','subscription');
  elsif public.subscription_effective_plan(old)<>'genius' then perform public.record_billing_funnel_event(new.user_id,'genius_activation','subscription'); end if;
 end if;
 return new;
exception when others then
 raise warning 'Billing conversion analytics unavailable: %',sqlstate;
 return new;
end $$;
drop trigger if exists billing_observe_genius on public.subscriptions;
create trigger billing_observe_genius after insert or update on public.subscriptions for each row execute function public.observe_genius_activation();

create or replace function public.billing_growth_report(p_days int default 30) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare start_at timestamptz:=now()-make_interval(days=>greatest(1,least(coalesce(p_days,30),90))); r public.billing_rollout%rowtype;
begin
 select * into r from public.billing_rollout where id;
 return jsonb_build_object('enabled',r.phase3_enabled,'startedAt',r.phase3_started_at,
 'retuneEligible',r.phase3_started_at is not null and now()>=r.phase3_started_at+interval '30 days' and
  (select count(distinct day) from public.billing_feature_daily where day>=(r.phase3_started_at at time zone 'UTC')::date)>=30,
 'observedDays',(select count(distinct day) from public.billing_feature_daily where day>=(r.phase3_started_at at time zone 'UTC')::date),
 'windowDays',greatest(1,least(coalesce(p_days,30),90)),
 'scholarExposures',(select count(distinct user_id) from public.billing_funnel_events where kind='offer_view' and plan='scholar' and created_at>=start_at),
 'upgradeClicks',(select count(distinct user_id) from public.billing_funnel_events where kind='upgrade_click' and plan='scholar' and created_at>=start_at),
 'checkoutStarts',(select count(distinct user_id) from public.billing_funnel_events where kind='checkout_started' and plan='scholar' and created_at>=start_at),
 'conversions',(select count(*) from public.billing_funnel_events a where a.kind='genius_activation' and a.created_at>=start_at and exists(
  select 1 from public.billing_funnel_events v where v.user_id=a.user_id and v.kind='offer_view' and v.plan='scholar' and v.created_at>=start_at and v.created_at<=a.created_at)),
 'features',coalesce((select jsonb_agg(to_jsonb(x)) from (select feature,plan,sum(requests) as requests,sum(limit_hits) as limit_hits,sum(units) as units,count(distinct user_id) as users
  from public.billing_feature_daily where day>=(start_at at time zone 'UTC')::date group by feature,plan order by feature,plan) x),'[]'::jsonb));
end $$;

-- This replacement preserves wallet locking, original receipt dates and the
-- existing 30-day grant. Only a NEW purchase uses the current configured quote.
create or replace function public.purchase_genius_plan_with_family_wallet(p_family_wallet_id uuid)
returns table(out_balance numeric,out_period_end timestamptz)
language plpgsql security definer set search_path='' as $$
declare w public.family_wallets%rowtype; c record; v_key text; v_end timestamptz; v_created timestamptz; cents int;
begin
 if auth.uid() is null then raise exception 'Unauthorized' using errcode='42501'; end if;
 select * into w from public.family_wallets where id=p_family_wallet_id;
 if not found then raise exception 'Family wallet not found'; end if;
 if auth.uid() is distinct from w.student_user_id and auth.uid() is distinct from w.adult_user_id then raise exception 'Not allowed' using errcode='42501'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('billing:'||w.student_user_id::text,0));
 v_key:='genius:'||w.student_user_id::text||':'||to_char(now() at time zone 'UTC','YYYY-MM');
 select t.created_at into v_created from public.family_wallet_transactions t where t.idempotency_key=v_key and t.family_wallet_id=p_family_wallet_id;
 cents:=public.billing_current_monthly_cents();
 if v_created is null and cents<>499 and nullif(current_setting('quillglow.expected_price_cents',true),'')::int is distinct from cents then
  raise exception 'Price changed. Refresh the offer before paying.' using errcode='22023';
 end if;
 if v_created is null then
  select * into c from public.charge_family_wallet(p_family_wallet_id,cents::numeric/100,'QuillGlow Genius plan','subscription',w.student_user_id::text,v_key);
 else
  select w.balance as out_balance into c;
 end if;
 select t.created_at into v_created from public.family_wallet_transactions t where t.idempotency_key=v_key and t.family_wallet_id=p_family_wallet_id;
 if v_created is null then raise exception 'Purchase receipt missing'; end if;
 v_end:=v_created+interval '30 days';
 insert into public.subscriptions(user_id,plan_type,status,current_period_start,current_period_end,genius_grant_until,updated_at)
 values(w.student_user_id,'genius','active',v_created,v_end,v_end,now())
 on conflict(user_id) do update set genius_grant_until=greatest(public.subscriptions.genius_grant_until,v_end),updated_at=now(),
 plan_type=case when public.subscriptions.polar_subscription_id is null then 'genius' else public.subscriptions.plan_type end,
 status=case when public.subscriptions.polar_subscription_id is null then 'active' else public.subscriptions.status end,
 current_period_start=case when public.subscriptions.polar_subscription_id is null then v_created else public.subscriptions.current_period_start end,
 current_period_end=case when public.subscriptions.polar_subscription_id is null then v_end else public.subscriptions.current_period_end end;
 return query select c.out_balance,v_end;
end $$;
create or replace function public.purchase_genius_plan_quoted(p_family_wallet_id uuid,p_expected_cents int)
returns table(out_balance numeric,out_period_end timestamptz)
language plpgsql security invoker set search_path='' as $$
begin
 if p_expected_cents is distinct from public.billing_current_monthly_cents() then
  raise exception 'Price changed. Refresh the offer before paying.' using errcode='22023';
 end if;
 perform set_config('quillglow.expected_price_cents',p_expected_cents::text,true);
 return query select * from public.purchase_genius_plan_with_family_wallet(p_family_wallet_id);
end $$;

revoke execute on function public.billing_current_monthly_cents() from public,anon;
grant execute on function public.billing_current_monthly_cents() to authenticated,service_role;
revoke execute on function public.purchase_genius_plan_quoted(uuid,int) from public,anon;
grant execute on function public.purchase_genius_plan_quoted(uuid,int) to authenticated,service_role;
revoke execute on function public.configure_billing_rollout(uuid,int,jsonb),public.authorize_billing_rollout(uuid,int,text),public.set_billing_growth_enabled(uuid,boolean),public.disable_billing_rollout(uuid),
 public.record_billing_funnel_event(uuid,text,text,text),public.billing_growth_report(int),public.observe_genius_activation() from public,anon,authenticated;
grant execute on function public.configure_billing_rollout(uuid,int,jsonb),public.authorize_billing_rollout(uuid,int,text),public.set_billing_growth_enabled(uuid,boolean),public.disable_billing_rollout(uuid),
 public.record_billing_funnel_event(uuid,text,text,text),public.billing_growth_report(int) to service_role;
notify pgrst,'reload schema';
commit;

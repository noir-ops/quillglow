-- Phase 0 only. Existing prices, limits and product records are untouched.
-- Apply after the repository's scripts/066_billing_entitlements.sql.
begin;
set local lock_timeout = '5s';

alter table public.subscriptions
  add column if not exists polar_created_at timestamptz,
  add column if not exists genius_grant_until timestamptz,
  add column if not exists genius_grant_lifetime boolean not null default false;

-- Preserve existing explicit one-off/lifetime grants. Never invent a Polar
-- lifetime grant just because an old checkout has a missing end date.
update public.subscriptions set
  genius_grant_until = greatest(genius_grant_until, current_period_end),
  genius_grant_lifetime = genius_grant_lifetime or current_period_end is null
where plan_type = 'genius' and status in ('active', 'trialing', 'canceling')
  and polar_subscription_id is null and polar_checkout_id is null;

create table if not exists public.billing_job_state (
  job_name text primary key, cursor_user_id uuid, lease_token uuid, locked_until timestamptz,
  last_started_at timestamptz, last_completed_at timestamptz, last_error text,
  last_summary jsonb not null default '{}'
);
alter table public.billing_job_state enable row level security;
create table if not exists public.billing_grant_receipts (
  source_key text primary key, user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.billing_grant_receipts enable row level security;
revoke all on public.billing_job_state, public.billing_grant_receipts, public.polar_webhook_events from public, anon, authenticated;
grant all on public.billing_job_state, public.billing_grant_receipts, public.polar_webhook_events to service_role;

-- Stop direct browser self-upgrades and rewritten quota counters. Existing
-- trusted SQL purchase functions still write as their definer (postgres).
revoke insert, update, delete on public.subscriptions, public.usage_tracking, public.plan_limits from public, anon, authenticated;
grant select on public.subscriptions, public.usage_tracking, public.plan_limits to authenticated;
-- Table-level REVOKE alone does not remove any older column-level grants.
do $column_grants$
declare t text; cols text;
begin
  foreach t in array array['subscriptions','usage_tracking','plan_limits'] loop
    select string_agg(quote_ident(a.attname),',') into cols from pg_catalog.pg_attribute a
      where a.attrelid=('public.'||t)::regclass and a.attnum>0 and not a.attisdropped;
    execute format('revoke insert (%s), update (%s) on public.%I from public,anon,authenticated',cols,cols,t);
  end loop;
end $column_grants$;
grant all on public.subscriptions, public.usage_tracking, public.plan_limits to service_role;

create or replace function public.subscription_effective_plan(p_subscription public.subscriptions) returns text
language sql stable security invoker set search_path = '' as $$
  select case when
    (p_subscription).genius_grant_lifetime or (p_subscription).genius_grant_until > now()
    or ((p_subscription).plan_type = 'genius' and (
      ((p_subscription).status in ('active','trialing','canceling') and (
        (p_subscription).current_period_end > now()
        or ((p_subscription).current_period_end is null and (p_subscription).polar_subscription_id is null
          and (p_subscription).polar_checkout_id is null and (p_subscription).status in ('active','trialing'))
      ))
      or ((p_subscription).status = 'past_due'
        and coalesce((p_subscription).past_due_at,(p_subscription).current_period_end) > now()-interval '3 days')
    ))
  then 'genius' else 'scholar' end
$$;
create or replace function public.user_plan(p_user_id uuid) returns text
language sql stable security definer set search_path = '' as $$
  select coalesce((select public.subscription_effective_plan(s) from public.subscriptions s where s.user_id=p_user_id),'scholar')
$$;
create or replace function public.my_plan() returns text
language sql stable security definer set search_path = '' as $$ select public.user_plan(auth.uid()) $$;

-- Authorization entitlements use the identical rule as AI quotas and badges.
create or replace function public.get_user_access(p_user_id uuid)
returns table (roles text[], permissions text[], plan text, entitlements text[])
language plpgsql stable security definer set search_path = '' as $$
declare v_roles text[]; v_plan text;
begin
  select coalesce(array_agg(distinct r.role),array['student']::text[]) into v_roles
    from public.user_roles r where r.user_id=p_user_id;
  v_plan := case when public.user_plan(p_user_id)='genius' then 'premium' else 'free' end;
  return query select v_roles,
    coalesce((select array_agg(distinct rp.permission) from public.role_permissions rp where rp.role=any(v_roles)),array[]::text[]),
    v_plan, coalesce((select array_agg(distinct pe.entitlement) from public.plan_entitlements pe where pe.plan=v_plan),array[]::text[]);
end $$;

-- Apply a verified provider snapshot AND its delivery log atomically.
create or replace function public.sync_polar_subscription(
  p_user_id uuid, p_snapshot jsonb, p_dry_run boolean default false,
  p_webhook_id text default null, p_event_type text default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  s public.subscriptions%rowtype; v_id text := p_snapshot->>'id'; v_status text := p_snapshot->>'status';
  v_modified timestamptz := coalesce(nullif(p_snapshot->>'modified_at','')::timestamptz,nullif(p_snapshot->>'created_at','')::timestamptz);
  v_created timestamptz := nullif(p_snapshot->>'created_at','')::timestamptz;
  v_start timestamptz := nullif(p_snapshot->>'current_period_start','')::timestamptz;
  v_end timestamptz := nullif(p_snapshot->>'current_period_end','')::timestamptz;
  v_ended timestamptz := nullif(p_snapshot->>'ended_at','')::timestamptz;
  v_plan text := 'genius'; v_outcome text := 'applied'; v_before jsonb; v_after jsonb;
begin
  if p_user_id is null or v_id is null or v_status is null or v_modified is null then
    raise exception 'Incomplete provider snapshot';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('billing:'||p_user_id::text,0));
  if p_webhook_id is not null and exists(select 1 from public.polar_webhook_events e where e.webhook_id=p_webhook_id) then
    return jsonb_build_object('outcome','duplicate','userId',p_user_id);
  end if;
  select * into s from public.subscriptions where user_id=p_user_id for update;
  v_before := case when s.user_id is null then null else jsonb_build_object('plan_type',s.plan_type,'status',s.status) end;
  if s.polar_subscription_id=v_id and s.polar_modified_at is not null and v_modified < s.polar_modified_at then
    v_outcome := 'stale';
  elsif s.polar_subscription_id is not null and s.polar_subscription_id<>v_id and (
    v_status not in ('active','trialing') or v_created is null
    or v_created <= coalesce(s.polar_created_at,s.current_period_start,s.created_at)
  ) then v_outcome := 'other_subscription';
  end if;
  if nullif(p_snapshot->>'paused_at','') is not null and
    (nullif(p_snapshot->>'resumes_at','') is null or (p_snapshot->>'resumes_at')::timestamptz>now()) then
    v_status := 'paused';
  elsif v_status in ('active','trialing') and coalesce((p_snapshot->>'cancel_at_period_end')::boolean,false) then v_status := 'canceling';
  elsif v_status in ('past_due','unpaid') then v_status := 'past_due';
  elsif v_status='canceled' and (v_ended is null or v_ended>now()) and v_end>now() then v_status := 'canceling';
  elsif v_status not in ('active','trialing','incomplete') then v_plan := 'scholar'; v_status := 'canceled';
  end if;
  v_after := jsonb_build_object('plan_type',v_plan,'status',v_status);
  if p_dry_run then return jsonb_build_object('outcome',case when v_outcome='applied' then 'dry_run' else v_outcome end,'userId',p_user_id,'before',v_before,'after',v_after); end if;
  if v_outcome='applied' then
    -- Repair a legacy checkout claim against another account, but only when
    -- the verified provider snapshot explicitly identifies the real owner.
    if coalesce(p_snapshot#>>'{metadata,user_id}',p_snapshot#>>'{customer,external_id}')=p_user_id::text then
      update public.subscriptions set plan_type='scholar',status='invalid_owner',polar_subscription_id=null,
        polar_checkout_id=null,polar_customer_id=null,polar_product_id=null,updated_at=now()
      where polar_subscription_id=v_id and user_id<>p_user_id;
    end if;
    insert into public.subscriptions (user_id,plan_type,status,polar_subscription_id,polar_customer_id,polar_product_id,
      polar_checkout_id,current_period_start,current_period_end,cancel_at_period_end,past_due_at,ended_at,recurring_interval,polar_modified_at,polar_created_at,updated_at)
    values (p_user_id,v_plan,v_status,v_id,coalesce(p_snapshot->>'customer_id',p_snapshot#>>'{customer,id}'),p_snapshot->>'product_id',
      coalesce(p_snapshot->>'checkout_id',s.polar_checkout_id),v_start,v_end,coalesce((p_snapshot->>'cancel_at_period_end')::boolean,false),
      case when v_status='past_due' then coalesce(nullif(p_snapshot->>'past_due_at','')::timestamptz,s.past_due_at,v_end,v_modified) end,
      v_ended,p_snapshot->>'recurring_interval',v_modified,v_created,now())
    on conflict(user_id) do update set plan_type=excluded.plan_type,status=excluded.status,
      polar_subscription_id=excluded.polar_subscription_id,polar_customer_id=excluded.polar_customer_id,polar_product_id=excluded.polar_product_id,
      polar_checkout_id=excluded.polar_checkout_id,current_period_start=excluded.current_period_start,current_period_end=excluded.current_period_end,
      cancel_at_period_end=excluded.cancel_at_period_end,past_due_at=excluded.past_due_at,ended_at=excluded.ended_at,
      recurring_interval=excluded.recurring_interval,polar_modified_at=excluded.polar_modified_at,polar_created_at=excluded.polar_created_at,updated_at=now();
  end if;
  if p_webhook_id is not null then
    insert into public.polar_webhook_events(webhook_id,event_type,polar_subscription_id,user_id,outcome)
    values(p_webhook_id,coalesce(p_event_type,'subscription.reconciled'),v_id,p_user_id,v_outcome)
    on conflict(webhook_id) do nothing;
  end if;
  return jsonb_build_object('outcome',v_outcome,'userId',p_user_id,'before',v_before,'after',v_after);
end $$;

-- One expiry rule, evaluated while holding each subscription row lock. A
-- concurrently renewed subscription cannot be downgraded from an old ID list.
create or replace function public.expire_genius_subscriptions() returns integer
language plpgsql security definer set search_path = '' as $$
declare r record; v_count integer := 0;
begin
  for r in select s as subscription_row from public.subscriptions s where s.plan_type='genius' order by s.user_id for update skip locked loop
    if public.subscription_effective_plan(r.subscription_row)='scholar' then
      update public.subscriptions set plan_type='scholar',status='expired',updated_at=now() where user_id=(r.subscription_row).user_id;
      v_count := v_count+1;
    end if;
  end loop;
  insert into public.billing_job_state(job_name,last_started_at,last_completed_at,last_summary)
    values('expiry',now(),now(),jsonb_build_object('processed',v_count,'errors',0))
    on conflict(job_name) do update set last_completed_at=now(),last_error=null,last_summary=excluded.last_summary;
  return v_count;
end $$;

create or replace function public.claim_billing_job(p_job text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare r public.billing_job_state%rowtype; v_token uuid := gen_random_uuid();
begin
  insert into public.billing_job_state(job_name) values(p_job) on conflict do nothing;
  select * into r from public.billing_job_state where job_name=p_job for update;
  if r.locked_until>now() then return jsonb_build_object('claimed',false); end if;
  update public.billing_job_state set lease_token=v_token,locked_until=now()+interval '5 minutes',last_started_at=now() where job_name=p_job;
  return jsonb_build_object('claimed',true,'token',v_token,'cursor',r.cursor_user_id,'page',coalesce((r.last_summary->>'nextPage')::integer,1));
end $$;
create or replace function public.finish_billing_job(p_job text,p_token uuid,p_cursor uuid,p_complete boolean,p_summary jsonb) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.billing_job_state set cursor_user_id=p_cursor,locked_until=null,lease_token=null,
    last_completed_at=case when p_complete then now() else last_completed_at end,
    last_summary=p_summary,last_error=p_summary->>'error'
  where job_name=p_job and lease_token=p_token;
  if not found then raise exception 'Billing job lease lost'; end if;
end $$;

-- Family-wallet activation is one transaction. Retrying a paid purchase never
-- extends its original period, charges twice, or erases a Polar subscription.
create or replace function public.purchase_genius_plan_with_family_wallet(p_family_wallet_id uuid)
returns table(out_balance numeric,out_period_end timestamptz)
language plpgsql security definer set search_path = '' as $$
declare w public.family_wallets%rowtype; c record; v_key text; v_end timestamptz; v_created timestamptz;
begin
  if auth.uid() is null then raise exception 'Unauthorized' using errcode='42501'; end if;
  select * into w from public.family_wallets where id=p_family_wallet_id;
  if not found then raise exception 'Family wallet not found'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('billing:'||w.student_user_id::text,0));
  v_key := 'genius:'||w.student_user_id::text||':'||to_char(now() at time zone 'UTC','YYYY-MM');
  select * into c from public.charge_family_wallet(p_family_wallet_id,4.99,'QuillGlow Genius plan','subscription',w.student_user_id::text,v_key);
  select t.created_at into v_created from public.family_wallet_transactions t where t.idempotency_key=v_key and t.family_wallet_id=p_family_wallet_id;
  if v_created is null then raise exception 'Purchase receipt missing'; end if;
  v_end := v_created+interval '30 days';
  insert into public.subscriptions(user_id,plan_type,status,current_period_start,current_period_end,genius_grant_until,updated_at)
    values(w.student_user_id,'genius','active',v_created,v_end,v_end,now())
  on conflict(user_id) do update set genius_grant_until=greatest(public.subscriptions.genius_grant_until,v_end),updated_at=now(),
    plan_type=case when public.subscriptions.polar_subscription_id is null then 'genius' else public.subscriptions.plan_type end,
    status=case when public.subscriptions.polar_subscription_id is null then 'active' else public.subscriptions.status end,
    current_period_start=case when public.subscriptions.polar_subscription_id is null then v_created else public.subscriptions.current_period_start end,
    current_period_end=case when public.subscriptions.polar_subscription_id is null then v_end else public.subscriptions.current_period_end end;
  return query select c.out_balance,v_end;
end $$;

-- Only the verified server referral flow calls this. Count real confirmed
-- users in the DB; a request cannot supply its own reward count/end date.
create or replace function public.grant_ambassador_genius(p_ambassador_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare a record; v_count integer; v_level integer; v_months integer; v_inserted integer;
begin
  select * into a from public.ambassadors where id=p_ambassador_id and status='approved' for update;
  if not found then return; end if;
  select count(distinct r.referred_user_id) into v_count from public.referrals r join auth.users u on u.id=r.referred_user_id
    join public.profiles p on p.id=u.id and p.referred_by=a.referral_code
    where r.ambassador_id=a.id and r.status='verified' and u.email_confirmed_at is not null and u.id<>a.user_id;
  v_level := case when v_count>=500 then 4 when v_count>=100 then 3 when v_count>=50 then 2 when v_count>=15 then 1 else 0 end;
  if v_level=0 then return; end if;
  insert into public.billing_grant_receipts(source_key,user_id) values('ambassador:'||a.id::text||':'||v_level::text,a.user_id) on conflict do nothing;
  get diagnostics v_inserted=row_count;
  if v_inserted=0 then return; end if;
  v_months := case v_level when 1 then 2 when 2 then 3 when 3 then 6 else 0 end;
  insert into public.subscriptions(user_id,plan_type,status,genius_grant_until,genius_grant_lifetime,current_period_end)
  values(a.user_id,'genius','active',case when v_months>0 then now()+make_interval(months=>v_months) end,v_level=4,case when v_months>0 then now()+make_interval(months=>v_months) end)
  on conflict(user_id) do update set genius_grant_until=greatest(public.subscriptions.genius_grant_until,excluded.genius_grant_until),
    genius_grant_lifetime=public.subscriptions.genius_grant_lifetime or excluded.genius_grant_lifetime,updated_at=now();
end $$;

create or replace function public.finalize_confirmed_referral(p_user_id uuid,p_code text default null) returns void
language plpgsql security definer set search_path = '' as $$
declare a record; v_code text;
begin
  if not exists(select 1 from auth.users where id=p_user_id and email_confirmed_at is not null) then return; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('referral:'||p_user_id::text,0));
  select referred_by into v_code from public.profiles where id=p_user_id;
  v_code := coalesce(nullif(v_code,''),nullif(p_code,''));
  if v_code is null then return; end if;
  select id,user_id,referral_code into a from public.ambassadors where referral_code=v_code and status='approved' limit 1;
  if not found or a.user_id=p_user_id then return; end if;
  update public.profiles set referred_by=v_code where id=p_user_id and (referred_by is null or referred_by='');
  if not exists(select 1 from public.referrals where referred_user_id=p_user_id) then
    insert into public.referrals(ambassador_id,referral_code,referred_user_id,status,verification_date)
    values(a.id,v_code,p_user_id,'verified',now());
  else
    update public.referrals set status='verified',verification_date=now()
      where referred_user_id=p_user_id and ambassador_id=a.id and status='pending';
  end if;
  perform public.grant_ambassador_genius(a.id);
end $$;

revoke execute on function public.finalize_confirmed_referral(uuid,text) from public,anon,authenticated;
grant execute on function public.finalize_confirmed_referral(uuid,text) to service_role;
revoke execute on function public.subscription_effective_plan(public.subscriptions),public.user_plan(uuid),public.get_user_access(uuid),public.sync_polar_subscription(uuid,jsonb,boolean,text,text),
  public.expire_genius_subscriptions(),public.claim_billing_job(text),public.finish_billing_job(text,uuid,uuid,boolean,jsonb),public.grant_ambassador_genius(uuid) from public,anon,authenticated;
grant execute on function public.subscription_effective_plan(public.subscriptions),public.user_plan(uuid),public.get_user_access(uuid),public.sync_polar_subscription(uuid,jsonb,boolean,text,text),
  public.expire_genius_subscriptions(),public.claim_billing_job(text),public.finish_billing_job(text,uuid,uuid,boolean,jsonb),public.grant_ambassador_genius(uuid) to service_role;
revoke execute on function public.my_plan(),public.consume_ai_quota(uuid,text,integer),public.get_ai_quota_status(uuid),public.purchase_genius_plan_with_family_wallet(uuid) from public,anon;
grant execute on function public.my_plan(),public.consume_ai_quota(uuid,text,integer),public.get_ai_quota_status(uuid),public.purchase_genius_plan_with_family_wallet(uuid) to authenticated,service_role;
revoke execute on function public.refund_ai_quota(uuid,text,integer) from public,anon,authenticated;
grant execute on function public.refund_ai_quota(uuid,text,integer) to service_role;
commit;

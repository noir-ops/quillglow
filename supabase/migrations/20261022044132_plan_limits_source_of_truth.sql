-- Phase 1: one source of truth. Requires 066 followed by Phase 0 revenue_integrity.
-- Add missing allowances only. NEVER reset an existing admin-configured value.
begin;
do $$ begin
  if to_regprocedure('public.subscription_effective_plan(public.subscriptions)') is null then
    raise exception 'Apply Phase 0 revenue_integrity first';
  end if;
end $$;

-- Match the existing audit schema; installations without it get the same
-- service-only audit storage. Existing records and read policies are retained.
create table if not exists public.audit_log (
 id bigserial primary key,actor_id uuid references auth.users(id) on delete set null,
 actor_role text,action text not null,resource_type text,resource_id text,
 before_state jsonb,after_state jsonb,ip_address text,user_agent text,
 metadata jsonb not null default '{}',created_at timestamptz not null default now()
);
alter table public.audit_log enable row level security;
grant select,insert on public.audit_log to service_role;

insert into public.plan_limits(plan_type,feature,monthly_limit) values
 ('scholar','ai_total',-1),('genius','ai_total',-1),
 ('scholar','_default',5),('genius','_default',300),
 ('scholar','tutor_chat',60),('genius','tutor_chat',2000),
 ('scholar','quilly_chat',60),('genius','quilly_chat',2000),
 ('scholar','revision_notes',5),('genius','revision_notes',300),
 ('scholar','flashcards',100),('genius','flashcards',3000),
 ('scholar','mind_map',5),('genius','mind_map',300),
 ('scholar','audio_overview',5),('genius','audio_overview',200),
 ('scholar','writereal_detect',10),('genius','writereal_detect',500),
 ('scholar','writereal_grammar',3),('genius','writereal_grammar',500),
 ('scholar','writereal_humanize',3),('genius','writereal_humanize',500),
 ('scholar','writereal_paraphrase',3),('genius','writereal_paraphrase',500),
 ('scholar','study_agent',1),('genius','study_agent',100),
 ('scholar','study_plan',3),('genius','study_plan',100),
 ('scholar','task_suggestions',50),('genius','task_suggestions',1000),
 ('scholar','syllabus_analysis',5),('genius','syllabus_analysis',100),
 ('scholar','weekly_review',2),('genius','weekly_review',60),
 ('scholar','exam_questions',3),('genius','exam_questions',300),
 ('scholar','mock_exam',5),('genius','mock_exam',300),
 ('scholar','essay',1),('genius','essay',100),
 ('scholar','echomind',3),('genius','echomind',300),
 ('scholar','stress_relief',100),('genius','stress_relief',300),
 ('scholar','quest_generation',5),('genius','quest_generation',300),
 ('scholar','search_summary',0),('genius','search_summary',0)
on conflict(plan_type,feature) do nothing;

-- Keep the old RPC signature for already-deployed callers; v2 identifies the
-- actual exhausted pool so the prompt cannot confuse it with another feature.
create or replace function public.consume_ai_quota_v2(p_user_id uuid,p_feature text,p_amount int default 1)
returns table(allowed boolean,used int,"limit" int,remaining int,plan text,blocked_feature text)
language plpgsql security definer set search_path='' as $$
declare
 m text := to_char(now() at time zone 'UTC','YYYY-MM');
 p text; cap int; total_cap int; n int; total_n int;
begin
 if p_user_id is null or (auth.uid() is not null and auth.uid()<>p_user_id)
    or (auth.uid() is null and current_setting('role',true) not in ('none','service_role')) then
   raise exception 'not allowed' using errcode='42501';
 end if;
 if p_amount is null or p_amount<1 or p_amount>1000 or p_feature is null
    or length(p_feature)>100 or p_feature !~ '^[a-z][a-z0-9_]*$' or p_feature='ai_total' then
   raise exception 'invalid quota request' using errcode='22023';
 end if;
 p:=public.user_plan(p_user_id);
 select monthly_limit into cap from public.plan_limits where plan_type=p and feature=p_feature;
 if cap is null then select monthly_limit into cap from public.plan_limits where plan_type=p and feature='_default'; end if;
 cap:=coalesce(cap,0);
 select monthly_limit into total_cap from public.plan_limits where plan_type=p and feature='ai_total';
 total_cap:=coalesce(total_cap,-1);
 insert into public.usage_tracking(user_id,month_year) values(p_user_id,m) on conflict(user_id,month_year) do nothing;
 select coalesce((feature_usage->>p_feature)::int,0),coalesce(ai_generations_used,0)
 into n,total_n from public.usage_tracking where user_id=p_user_id and month_year=m for update;
 if cap>=0 and n::bigint+p_amount>cap then
   return query select false,n,cap,greatest(cap-n,0),p,p_feature; return;
 end if;
 if total_cap>=0 and total_n::bigint+p_amount>total_cap then
   return query select false,total_n,total_cap,greatest(total_cap-total_n,0),p,'ai_total'::text; return;
 end if;
 update public.usage_tracking set feature_usage=jsonb_set(coalesce(feature_usage,'{}'),array[p_feature],to_jsonb(n+p_amount),true),
 ai_generations_used=total_n+p_amount,updated_at=now() where user_id=p_user_id and month_year=m;
 return query select true,n+p_amount,cap,case when cap<0 then -1 else greatest(cap-n-p_amount,0) end,p,null::text;
end $$;

create or replace function public.consume_ai_quota(p_user_id uuid,p_feature text,p_amount int default 1)
returns table(allowed boolean,used int,"limit" int,remaining int,plan text)
language sql security invoker set search_path='' as $$
 select q.allowed,q.used,q."limit",q.remaining,q.plan from public.consume_ai_quota_v2(p_user_id,p_feature,p_amount) q
$$;

create or replace function public.get_ai_quota_status(p_user_id uuid)
returns table(feature text,used int,"limit" int,remaining int,plan text)
language plpgsql security definer set search_path='' as $$
declare m text:=to_char(now() at time zone 'UTC','YYYY-MM'); p text;
begin
 if p_user_id is null or (auth.uid() is not null and auth.uid()<>p_user_id)
    or (auth.uid() is null and current_setting('role',true) not in ('none','service_role')) then
   raise exception 'not allowed' using errcode='42501';
 end if;
 p:=public.user_plan(p_user_id);
 return query
 select pl.feature,
   case when pl.feature='ai_total' then coalesce(ut.ai_generations_used,0) else coalesce((ut.feature_usage->>pl.feature)::int,0) end,
   pl.monthly_limit,
   case when pl.monthly_limit<0 then -1 else greatest(pl.monthly_limit-
     case when pl.feature='ai_total' then coalesce(ut.ai_generations_used,0) else coalesce((ut.feature_usage->>pl.feature)::int,0) end,0) end,p
 from public.plan_limits pl left join public.usage_tracking ut on ut.user_id=p_user_id and ut.month_year=m
 where pl.plan_type=p;
end $$;

-- Refund at most what was actually consumed, including in the aggregate.
create or replace function public.refund_ai_quota(p_user_id uuid,p_feature text,p_amount int default 1)
returns void language plpgsql security definer set search_path='' as $$
declare m text:=to_char(now() at time zone 'UTC','YYYY-MM'); n int; credit int;
begin
 if auth.uid() is not null then raise exception 'not allowed' using errcode='42501'; end if;
 if p_amount is null or p_amount<1 or p_feature='ai_total' then return; end if;
 select coalesce((feature_usage->>p_feature)::int,0) into n from public.usage_tracking
 where user_id=p_user_id and month_year=m for update;
 if not found then return; end if;
 credit:=least(n,p_amount);
 update public.usage_tracking set feature_usage=jsonb_set(coalesce(feature_usage,'{}'),array[p_feature],to_jsonb(n-credit),true),
 ai_generations_used=greatest(coalesce(ai_generations_used,0)-credit,0),updated_at=now()
 where user_id=p_user_id and month_year=m;
end $$;

-- Service-only mutation. The admin API verifies the actor before invoking it.
-- Compare-and-set prevents an old browser tab overwriting a newer edit.
-- Updating the limit and recording the audit entry succeed or roll back together.
create or replace function public.update_plan_limit(p_actor_id uuid,p_plan text,p_feature text,p_limit int,p_expected_limit int)
returns jsonb language plpgsql security definer set search_path='' as $$
declare old_limit int;
begin
 if p_actor_id is null or p_plan not in ('scholar','genius') or p_plan is null
    or p_limit is null or p_limit < -1 or p_limit>1000000 or p_expected_limit is null then
   raise exception 'Invalid plan limit' using errcode='22023';
 end if;
 select monthly_limit into old_limit from public.plan_limits where plan_type=p_plan and feature=p_feature for update;
 if not found then raise exception 'Unknown feature for this plan' using errcode='P0002'; end if;
 if old_limit<>p_expected_limit then raise exception 'This limit changed. Reload before saving.' using errcode='40001'; end if;
 if old_limit<>p_limit then
   update public.plan_limits set monthly_limit=p_limit where plan_type=p_plan and feature=p_feature;
   insert into public.audit_log(actor_id,actor_role,action,resource_type,resource_id,before_state,after_state)
   values(p_actor_id,'admin','plan_limit.update','plan_limit',p_plan||':'||p_feature,
     jsonb_build_object('monthly_limit',old_limit),jsonb_build_object('monthly_limit',p_limit));
 end if;
 return jsonb_build_object('ok',true,'plan_type',p_plan,'feature',p_feature,'monthly_limit',p_limit);
end $$;

revoke execute on function public.consume_ai_quota_v2(uuid,text,int),public.consume_ai_quota(uuid,text,int),public.get_ai_quota_status(uuid) from public,anon;
grant execute on function public.consume_ai_quota_v2(uuid,text,int),public.consume_ai_quota(uuid,text,int),public.get_ai_quota_status(uuid) to authenticated,service_role;
revoke execute on function public.refund_ai_quota(uuid,text,int),public.update_plan_limit(uuid,text,text,int,int) from public,anon,authenticated;
grant execute on function public.refund_ai_quota(uuid,text,int),public.update_plan_limit(uuid,text,text,int,int) to service_role;
-- Existing Phase 0 table grants remain intact: learners can read but cannot edit limits/counters.
notify pgrst,'reload schema';
commit;

const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const user='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222';
async function createBillingFixture(PGlite){
 const db=new PGlite();
 await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
 create schema auth; create table auth.users(id uuid primary key,email_confirmed_at timestamptz);
 create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 grant usage on schema public,auth to anon,authenticated,service_role; grant execute on function auth.uid() to public;
 insert into auth.users values('${user}',now()),('${other}',now());`);
 await db.exec(fs.readFileSync(path.join(root,'scripts/011_create_subscriptions.sql'),'utf8'));
 await db.exec(fs.readFileSync(path.join(root,'scripts/015_atomic_ai_quota.sql'),'utf8'));
 await db.exec(fs.readFileSync(path.join(root,'scripts/066_billing_entitlements.sql'),'utf8'));
 await db.exec(`create table public.user_roles(user_id uuid,role text); create table public.role_permissions(role text,permission text);
 create table public.plan_entitlements(plan text,entitlement text); insert into public.plan_entitlements values('premium','advanced_ai'),('free','basic_learning');
 create table public.family_wallets(id uuid primary key,student_user_id uuid,adult_user_id uuid,balance numeric);
 create table public.family_wallet_transactions(idempotency_key text unique,family_wallet_id uuid,created_at timestamptz default now());
 create table public.ambassadors(id uuid primary key,user_id uuid,status text,referral_code text); create table public.referrals(ambassador_id uuid,referred_user_id uuid,status text,referral_code text,verification_date timestamptz);
 create table public.profiles(id uuid primary key,referred_by text);
 create function public.charge_family_wallet(uuid,numeric,text,text,text,text) returns table(out_balance numeric)
 language plpgsql security definer as $$ declare w record; begin
 select * into w from public.family_wallets where id=$1 for update;
 if auth.uid() is null or auth.uid() not in(w.student_user_id,w.adult_user_id) then raise exception 'not allowed'; end if;
 if not exists(select 1 from public.family_wallet_transactions where idempotency_key=$6) then
 if w.balance<$2 then raise exception 'Insufficient'; end if;
 update public.family_wallets set balance=balance-$2 where id=$1;
 insert into public.family_wallet_transactions(idempotency_key,family_wallet_id) values($6,$1); end if;
 return query select balance from public.family_wallets where id=$1; end $$;
 insert into public.subscriptions(user_id,plan_type,status,current_period_end) values('${user}','genius','active',null);`);
 const migration=fs.readFileSync(path.join(root,'supabase/migrations/20261021062757_revenue_integrity.sql'),'utf8');
 await db.exec(migration); await db.exec(migration);
 await db.exec(`create table public.audit_log(id bigserial primary key,actor_id uuid references auth.users(id),actor_role text,action text,resource_type text,resource_id text,before_state jsonb,after_state jsonb);`);
 const phase1=fs.readFileSync(path.join(root,'supabase/migrations/20261022044132_plan_limits_source_of_truth.sql'),'utf8');
 await db.exec(phase1); await db.exec(phase1);
 return {db,migration,phase1,user,other};
}
module.exports={createBillingFixture};

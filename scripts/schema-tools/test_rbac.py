"""Test RBAC, entitlements and audit logging."""
import pathlib, pgserver, psycopg2
base="/home/claude/work/qg/quillglow-main/scripts/"
db=pgserver.get_server("/tmp/pgtest_rbac")
conn=psycopg2.connect(db.get_uri()); conn.autocommit=True; cur=conn.cursor()
cur.execute("""
create schema if not exists auth; create table auth.users(id uuid primary key);
create role authenticated;
create table public._ctx(uid uuid); insert into public._ctx values (null);
create or replace function auth.uid() returns uuid language sql stable as $$ select uid from public._ctx limit 1 $$;
create table public.subscriptions(id uuid primary key default gen_random_uuid(), user_id uuid, plan_type text, status text);
create table public.benefactors(id uuid primary key default gen_random_uuid(), user_id uuid unique);
""")
cur.execute(pathlib.Path(base+"023_rbac_entitlements_audit.sql").read_text())
print("migration applied cleanly\n")
ok=True
def check(l,c,d=""):
    global ok
    print(f"  {'PASS' if c else 'FAIL'}  {l}  {d}")
    if not c: ok=False

S="11111111-1111-1111-1111-111111111111"  # student, free
P="22222222-2222-2222-2222-222222222222"  # student, premium
B="33333333-3333-3333-3333-333333333333"  # benefactor
A="44444444-4444-4444-4444-444444444444"  # admin
M="55555555-5555-5555-5555-555555555555"  # mentor
for u in (S,P,B,A,M): cur.execute("insert into auth.users values (%s)",(u,))
cur.execute("insert into subscriptions (user_id,plan_type,status) values (%s,'genius','active')",(P,))
cur.execute("insert into benefactors (user_id) values (%s)",(B,))
cur.execute("insert into user_roles (user_id,role) values (%s,'admin'),(%s,'mentor')",(A,M))

print("1) implicit student role")
cur.execute("select * from get_user_access(%s)",(S,))
roles,perms,plan,ents = cur.fetchone()
check("no role row -> student", roles==["student"], str(roles))
check("gets student permissions", "scholarship.apply" in perms)
check("free plan", plan=="free")
check("free entitlements only", "advanced_ai" not in ents and "basic_learning" in ents, str(ents))

print("\n2) premium entitlements")
cur.execute("select * from get_user_access(%s)",(P,))
roles,perms,plan,ents = cur.fetchone()
check("genius maps to premium", plan=="premium")
check("premium unlocks advanced_ai", "advanced_ai" in ents)
check("premium unlocks exam_coach", "exam_coach" in ents)

print("\n3) benefactor role auto-granted by trigger")
cur.execute("select * from get_user_access(%s)",(B,))
roles,perms,plan,ents = cur.fetchone()
check("benefactor role auto-granted on insert", "benefactor" in roles, str(roles))
check("can create scholarships", "scholarship.create" in perms)
check("CANNOT review scholarships", "scholarship.review" not in perms)
check("CANNOT administer platform", "platform.administer" not in perms)

cur.execute("delete from benefactors where user_id=%s",(B,))
cur.execute("select roles from get_user_access(%s)",(B,))
check("role revoked when benefactor deleted", "benefactor" not in cur.fetchone()[0])
cur.execute("insert into benefactors (user_id) values (%s)",(B,))

print("\n4) mentor vs admin separation")
cur.execute("select * from get_user_access(%s)",(M,))
_,mperms,_,_ = cur.fetchone()
check("mentor can review", "scholarship.review" in mperms)
check("mentor CANNOT create scholarships", "scholarship.create" not in mperms)
check("mentor CANNOT manage funding", "funding.manage" not in mperms)
cur.execute("select * from get_user_access(%s)",(A,))
_,aperms,_,_ = cur.fetchone()
check("admin has platform.administer", "platform.administer" in aperms)

print("\n5) user_has_permission")
cur.execute("select user_has_permission(%s,'scholarship.create')",(B,))
check("benefactor -> scholarship.create true", cur.fetchone()[0] is True)
cur.execute("select user_has_permission(%s,'scholarship.create')",(S,))
check("student -> scholarship.create false", cur.fetchone()[0] is False)
cur.execute("select user_has_permission(%s,'scholarship.apply')",(S,))
check("implicit student -> apply true", cur.fetchone()[0] is True)

print("\n6) entitlements are data, not code")
cur.execute("insert into plan_entitlements values ('free','advanced_ai')")
cur.execute("select entitlements from get_user_access(%s)",(S,))
check("pricing change needs no deploy", "advanced_ai" in cur.fetchone()[0])
cur.execute("delete from plan_entitlements where plan='free' and entitlement='advanced_ai'")

print("\n7) audit log")
cur.execute("""select write_audit_log(%s,'scholarship.approved','opportunity','opp-1',
 '{"review_status":"pending_review"}'::jsonb,'{"review_status":"approved"}'::jsonb,'{}'::jsonb,'1.2.3.4','curl')""",(A,))
cur.execute("select actor_role,action,resource_id,before_state,after_state,ip_address from audit_log")
r=cur.fetchone()
check("actor role captured", r[0]=="admin", str(r[0]))
check("before/after captured", r[3]["review_status"]=="pending_review" and r[4]["review_status"]=="approved")
check("ip captured", r[5]=="1.2.3.4")
cur.execute("select count(*) from pg_policies where tablename='audit_log'")
check("audit log has NO client policies", cur.fetchone()[0]==0)
cur.execute("select count(*) from pg_policies where tablename='user_roles' and cmd in ('INSERT','UPDATE','DELETE')")
check("roles not client-writable", cur.fetchone()[0]==0)

print("\n"+"="*55); print("RESULT:","ALL PASS" if ok else "FAILURES"); print("="*55)
db.cleanup()

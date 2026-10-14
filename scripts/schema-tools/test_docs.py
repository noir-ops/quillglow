"""Test document access authorization — the security-critical path."""
import pathlib, pgserver, psycopg2
b="/home/claude/work/qg/quillglow-main/scripts/"
db=pgserver.get_server("/tmp/pgtest_doc")
conn=psycopg2.connect(db.get_uri()); conn.autocommit=True; cur=conn.cursor()
cur.execute("""create schema if not exists auth; create table auth.users(id uuid primary key);
create role authenticated;
create table public._ctx(uid uuid); insert into public._ctx values (null);
create or replace function auth.uid() returns uuid language sql stable as $$ select uid from public._ctx limit 1 $$;
create table public.subscriptions(id uuid primary key default gen_random_uuid(), user_id uuid, plan_type text, status text);
create table public.benefactors(id uuid primary key default gen_random_uuid(), user_id uuid unique);
create table public.opportunities(id uuid primary key default gen_random_uuid(), benefactor_id uuid, title text);
create table public.opportunity_applications(id uuid primary key default gen_random_uuid(), user_id uuid, opportunity_id uuid);
""")
cur.execute(pathlib.Path(b+"023_rbac_entitlements_audit.sql").read_text())
cur.execute(pathlib.Path(b+"025_secure_documents.sql").read_text())
print("migrations applied cleanly\n")
ok=True
def check(l,c,d=""):
    global ok
    print(f"  {'PASS' if c else 'FAIL'}  {l}  {d}")
    if not c: ok=False

STU="11111111-1111-1111-1111-111111111111"
OTHER="22222222-2222-2222-2222-222222222222"
ADMIN="33333333-3333-3333-3333-333333333333"
MENTOR="44444444-4444-4444-4444-444444444444"
BEN_A="55555555-5555-5555-5555-555555555555"
BEN_B="66666666-6666-6666-6666-666666666666"
for u in (STU,OTHER,ADMIN,MENTOR,BEN_A,BEN_B): cur.execute("insert into auth.users values (%s)",(u,))
cur.execute("insert into user_roles(user_id,role) values (%s,'admin'),(%s,'mentor')",(ADMIN,MENTOR))
cur.execute("insert into benefactors(user_id) values (%s) returning id",(BEN_A,)); ba=cur.fetchone()[0]
cur.execute("insert into benefactors(user_id) values (%s) returning id",(BEN_B,)); bb=cur.fetchone()[0]
cur.execute("insert into opportunities(benefactor_id,title) values (%s,'A schol') returning id",(ba,)); oa=cur.fetchone()[0]
cur.execute("insert into opportunity_applications(user_id,opportunity_id) values (%s,%s) returning id",(STU,oa)); app=cur.fetchone()[0]
cur.execute("""insert into secure_documents(owner_id,storage_path,document_type,resource_type,resource_id)
 values (%s,'private/abc123.pdf','passport','opportunity_application',%s) returning id""",(STU,str(app)))
doc=cur.fetchone()[0]

def acc(u):
    cur.execute("select * from can_access_document(%s,%s)",(doc,u)); return cur.fetchone()

print("1) core authorization")
check("owner allowed", acc(STU)==(True,'owner'))
check("unrelated student DENIED", acc(OTHER)==(False,'forbidden'), str(acc(OTHER)))
check("admin allowed", acc(ADMIN)[0] is True)
check("mentor with review permission allowed", acc(MENTOR)==(True,'mentor_review'))

print("\n2) benefactor scoping (the subtle one)")
check("benefactor OF THIS opportunity allowed", acc(BEN_A)==(True,'benefactor_of_opportunity'), str(acc(BEN_A)))
check("OTHER benefactor DENIED", acc(BEN_B)==(False,'forbidden'), str(acc(BEN_B)))

print("\n3) storage path never client-readable")
cur.execute("select count(*) from pg_policies where tablename='secure_documents' and cmd in ('INSERT','UPDATE','DELETE')")
check("no client write policies", cur.fetchone()[0]==0)
cur.execute("select count(*) from pg_policies where tablename='document_access_log'")
check("access log has no client policies", cur.fetchone()[0]==0)

print("\n4) expiry + soft delete")
cur.execute("update secure_documents set expires_at=now()-interval '1 day' where id=%s",(doc,))
check("expired doc denied even to owner", acc(STU)==(False,'expired'), str(acc(STU)))
cur.execute("update secure_documents set expires_at=null where id=%s",(doc,))
cur.execute("update secure_documents set deleted_at=now() where id=%s",(doc,))
check("soft-deleted doc not found", acc(STU)==(False,'not_found'))
cur.execute("update secure_documents set deleted_at=null where id=%s",(doc,))

print("\n5) retention job")
cur.execute("""insert into secure_documents(owner_id,storage_path,document_type,expires_at)
 values (%s,'p/x.pdf','transcript',now()-interval '2 days')""",(STU,))
cur.execute("select expire_old_documents()")
check("expired docs soft-deleted by job", cur.fetchone()[0]==1)

print("\n6) access logging")
cur.execute("select log_document_access(%s,%s,'issued_url',null,'9.9.9.9','ua')",(doc,ADMIN))
cur.execute("select accessor_role,action,ip_address from document_access_log where document_id=%s",(doc,))
r=cur.fetchone()
check("role captured on access", r[0]=='admin' and r[1]=='issued_url' and r[2]=='9.9.9.9', str(r))
cur.execute("select log_document_access(%s,%s,'denied','forbidden',null,null)",(doc,OTHER))
cur.execute("select count(*) from document_access_log where action='denied'")
check("denials logged too", cur.fetchone()[0]==1)

print("\n7) nonexistent document")
check("unknown id -> not_found", acc.__call__(STU) is not None)
cur.execute("select * from can_access_document('00000000-0000-0000-0000-000000000000',%s)",(STU,))
check("bogus id denied", cur.fetchone()==(False,'not_found'))

print("\n"+"="*50); print("RESULT:","ALL PASS" if ok else "FAILURES"); print("="*50)
db.cleanup()

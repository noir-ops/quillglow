"""Test document verification, application document access, withdraw, and the stats fix."""
import pathlib, pgserver, psycopg2
b = "/home/claude/work/qg/quillglow-main/scripts/"
db = pgserver.get_server("/tmp/pgtest_verify")
conn = psycopg2.connect(db.get_uri()); conn.autocommit = True; cur = conn.cursor()
cur.execute("""create schema if not exists auth; create table auth.users(id uuid primary key);
create role authenticated;
create table public._ctx(uid uuid); insert into public._ctx values(null);
create or replace function auth.uid() returns uuid language sql stable as $$ select uid from public._ctx limit 1 $$;""")
cur.execute(pathlib.Path(b + "001_create_profiles.sql").read_text().split("-- Create trigger")[0])
cur.execute(pathlib.Path(b + "019_opportunities.sql").read_text())
cur.execute(pathlib.Path(b + "021_benefactor_accounts.sql").read_text())
cur.execute(pathlib.Path(b + "023_rbac_entitlements_audit.sql").read_text())
cur.execute(pathlib.Path(b + "024_wallet_notifications.sql").read_text())
cur.execute(pathlib.Path(b + "025_secure_documents.sql").read_text())
cur.execute(pathlib.Path(b + "030_benefactor_fund_management.sql").read_text())
cur.execute(pathlib.Path(b + "031_benefactor_applications_access.sql").read_text())
cur.execute(pathlib.Path(b + "033_application_lifecycle.sql").read_text())
cur.execute(pathlib.Path(b + "034_document_verification_withdraw.sql").read_text())
print("all migrations applied cleanly\n")

ok = True
def check(l, c, d=""):
    global ok
    print(f"  {'PASS' if c else 'FAIL'}  {l}  {d}")
    if not c: ok = False
def as_user(u): cur.execute("update public._ctx set uid=%s", (u,))

STU = "11111111-1111-1111-1111-111111111111"
BEN = "22222222-2222-2222-2222-222222222222"
OTHER_BEN = "33333333-3333-3333-3333-333333333333"
OTHER_STU = "44444444-4444-4444-4444-444444444444"
ADMIN = "55555555-5555-5555-5555-555555555555"
for u in (STU, BEN, OTHER_BEN, OTHER_STU, ADMIN): cur.execute("insert into auth.users values (%s)", (u,))
cur.execute("insert into profiles(id,display_name) values (%s,'Jane Student')", (STU,))
cur.execute("insert into user_roles(user_id,role) values (%s,'admin')", (ADMIN,))
cur.execute("insert into benefactors(user_id,organization_name,contact_name,contact_email) values (%s,'Acme','A','a@x.com') returning id", (BEN,))
ben_id = cur.fetchone()[0]
cur.execute("insert into benefactors(user_id,organization_name,contact_name,contact_email) values (%s,'Other','B','b@x.com') returning id", (OTHER_BEN,))
cur.execute("""insert into opportunities(title,slug,status,benefactor_id,award_amount,requires_essay)
 values ('Test Schol','test-schol','active',%s,4000,true) returning id""", (ben_id,))
opp = cur.fetchone()[0]
cur.execute("""insert into opportunity_applications(user_id,opportunity_id,status,notes)
 values (%s,%s,'submitted',%s) returning id""", (STU, opp, "A"*60))
app_id = cur.fetchone()[0]
cur.execute("""insert into secure_documents(owner_id,storage_path,document_type,resource_type,resource_id)
 values (%s,'p/x.pdf','recommendation','opportunity_application',%s) returning id""", (STU, str(app_id)))
doc_id = cur.fetchone()[0]

print("=== 1. benefactor_stats() no longer inflated by bookmarks ===")
cur.execute("""insert into opportunity_applications(user_id,opportunity_id,status)
 values (%s,%s,'saved')""", (OTHER_STU, opp))
cur.execute("select total_applications from benefactor_stats(%s)", (ben_id,))
check("stats count only the real submission, not the bookmark", cur.fetchone()[0] == 1)

print("\n=== 2. benefactor_applications() now includes notes ===")
cur.execute("select notes from benefactor_applications(%s)", (BEN,))
check("essay text is visible to the owning benefactor", cur.fetchone()[0] == "A"*60)

print("\n=== 3. application_documents() authorization ===")
cur.execute("select * from application_documents(%s,%s)", (app_id, STU))
check("owning student sees the document", len(cur.fetchall()) == 1)
cur.execute("select * from application_documents(%s,%s)", (app_id, BEN))
check("owning benefactor sees the document", len(cur.fetchall()) == 1)
cur.execute("select * from application_documents(%s,%s)", (app_id, ADMIN))
check("admin sees the document", len(cur.fetchall()) == 1)
cur.execute("select * from application_documents(%s,%s)", (app_id, OTHER_BEN))
check("a DIFFERENT benefactor sees NOTHING", len(cur.fetchall()) == 0)
cur.execute("select * from application_documents(%s,%s)", (app_id, OTHER_STU))
check("a DIFFERENT student sees NOTHING", len(cur.fetchall()) == 0)

print("\n=== 4. verify_document() authorization ===")
try:
    cur.execute("select verify_document(%s,%s,'verified','looks legit')", (doc_id, STU))
    check("student CANNOT self-verify their own document", False, "it succeeded!")
except Exception as e:
    check("student CANNOT self-verify their own document", "Not authorized" in str(e))

try:
    cur.execute("select verify_document(%s,%s,'verified',null)", (doc_id, OTHER_BEN))
    check("a DIFFERENT benefactor cannot verify this document", False)
except Exception as e:
    check("a DIFFERENT benefactor cannot verify this document", "Not authorized" in str(e))

cur.execute("select verify_document(%s,%s,'verified','confirmed authentic')", (doc_id, BEN))
check("the OWNING benefactor can verify", cur.fetchone()[0] is True)
cur.execute("select verification_status, verification_notes, verified_by from secure_documents where id=%s", (doc_id,))
vstat, vnotes, vby = cur.fetchone()
check("verification recorded correctly", vstat == "verified" and vnotes == "confirmed authentic" and vby == BEN)

cur.execute("""insert into secure_documents(owner_id,storage_path,document_type,resource_type,resource_id)
 values (%s,'p/y.pdf','recommendation','opportunity_application',%s) returning id""", (STU, str(app_id)))
doc2 = cur.fetchone()[0]
cur.execute("select verify_document(%s,%s,'verified',null)", (doc2, ADMIN))
check("admin can also verify (not just the owning benefactor)", cur.fetchone()[0] is True)

print("\n=== 5. withdraw_application() ===")
try:
    cur.execute("select withdraw_application(%s,%s)", (OTHER_STU, app_id))
    check("another student cannot withdraw someone else's application", False)
except Exception as e:
    check("another student cannot withdraw someone else's application", "not found" in str(e).lower())

cur.execute("select withdraw_application(%s,%s)", (STU, app_id))
check("owning student can withdraw a submitted application", cur.fetchone()[0] is True)
cur.execute("select status from opportunity_applications where id=%s", (app_id,))
check("status is now withdrawn", cur.fetchone()[0] == "withdrawn")

try:
    cur.execute("select withdraw_application(%s,%s)", (STU, app_id))
    check("cannot withdraw an already-withdrawn application", False)
except Exception as e:
    check("cannot withdraw an already-withdrawn application", "submitted or shortlisted" in str(e))

print("\n=== 6. cannot withdraw once paid ===")
as_user(None)
cur.execute("select * from benefactor_deposit_funds(%s, 10000, 'fund')", (BEN,))
cur.execute("""insert into opportunities(title,slug,status,benefactor_id,award_amount)
 values ('Second Schol','second-schol','active',%s,4000) returning id""", (ben_id,))
opp2 = cur.fetchone()[0]
cur.execute("""insert into opportunity_applications(user_id,opportunity_id,status,award_amount)
 values (%s,%s,'awarded',4000) returning id""", (STU, opp2))
paid_app = cur.fetchone()[0]
cur.execute("select * from pay_applicant(%s,%s)", (BEN, paid_app))
try:
    cur.execute("select withdraw_application(%s,%s)", (STU, paid_app))
    check("cannot withdraw a PAID application", False, "it succeeded!")
except Exception as e:
    check("cannot withdraw a PAID application", "already been paid" in str(e))

print("\n" + "=" * 55)
print("RESULT:", "ALL PASS" if ok else "FAILURES")
print("=" * 55)
db.cleanup()

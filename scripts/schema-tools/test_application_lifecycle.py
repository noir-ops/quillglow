"""Test the student write guard, submit_application, benefactor filtering, and notifications."""
import pathlib, pgserver, psycopg2
b = "/home/claude/work/qg/quillglow-main/scripts/"
db = pgserver.get_server("/tmp/pgtest_lifecycle")
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
print("all migrations applied cleanly\n")

ok = True
def check(l, c, d=""):
    global ok
    print(f"  {'PASS' if c else 'FAIL'}  {l}  {d}")
    if not c: ok = False
def as_user(u): cur.execute("update public._ctx set uid=%s", (u,))

STU = "11111111-1111-1111-1111-111111111111"
BEN = "22222222-2222-2222-2222-222222222222"
OTHER_STU = "33333333-3333-3333-3333-333333333333"
for u in (STU, BEN, OTHER_STU): cur.execute("insert into auth.users values (%s)", (u,))
cur.execute("insert into profiles(id,display_name) values (%s,'Jane Student')", (STU,))
cur.execute("insert into benefactors(user_id,organization_name,contact_name,contact_email) values (%s,'Acme','A','a@x.com') returning id", (BEN,))
ben_id = cur.fetchone()[0]

cur.execute("""insert into opportunities(title,slug,status,benefactor_id,award_amount,requires_essay)
 values ('Essay Scholarship','essay-schol','active',%s,4000,true) returning id""", (ben_id,))
opp = cur.fetchone()[0]
cur.execute("""insert into opportunities(title,slug,status,benefactor_id,award_amount,requires_essay)
 values ('No-Essay Scholarship','no-essay-schol','active',%s,2000,false) returning id""", (ben_id,))
opp_noessay = cur.fetchone()[0]

print("=== 1. STUDENT WRITE GUARD (the security fix) ===")
as_user(STU)
cur.execute("""insert into opportunity_applications(user_id,opportunity_id,status) values (%s,%s,'saved') returning id""", (STU, opp))
app_id = cur.fetchone()[0]

cur.execute("update opportunity_applications set award_amount=999999 where id=%s", (app_id,))
cur.execute("select award_amount from opportunity_applications where id=%s", (app_id,))
check("student CANNOT set their own award_amount", cur.fetchone()[0] is None)

cur.execute("update opportunity_applications set payment_status='paid', paid_amount=999999 where id=%s", (app_id,))
cur.execute("select payment_status, paid_amount from opportunity_applications where id=%s", (app_id,))
pstat, pamt = cur.fetchone()
check("student CANNOT mark themselves paid", pstat == "unpaid" and float(pamt) == 0, f"{pstat} {pamt}")

cur.execute("update opportunity_applications set status='awarded' where id=%s", (app_id,))
cur.execute("select status from opportunity_applications where id=%s", (app_id,))
check("student CANNOT self-award (status reverted)", cur.fetchone()[0] == "saved")

cur.execute("update opportunity_applications set status='in_progress', notes='draft essay' where id=%s", (app_id,))
cur.execute("select status, notes from opportunity_applications where id=%s", (app_id,))
check("student CAN move between their own states + edit notes", cur.fetchone() == ("in_progress", "draft essay"))

print("\n=== 2. SUBMIT VALIDATION ===")
try:
    cur.execute("select * from submit_application(%s,%s)", (STU, app_id))
    check("submit blocked without a real essay (< 50 chars)", False, "it succeeded!")
except Exception as e:
    check("submit blocked without a real essay (< 50 chars)", "essay" in str(e).lower())

cur.execute("update opportunity_applications set notes=%s where id=%s",
            ("A" * 60, app_id))
cur.execute("select * from submit_application(%s,%s)", (STU, app_id))
status, submitted_at = cur.fetchone()
check("submit succeeds once essay requirement is met", status == "submitted" and submitted_at is not None)

try:
    cur.execute("select * from submit_application(%s,%s)", (STU, app_id))
    check("cannot re-submit an already-submitted application", False)
except Exception as e:
    check("cannot re-submit an already-submitted application", "saved or in-progress" in str(e))

cur.execute("""insert into opportunity_applications(user_id,opportunity_id,status)
 values (%s,%s,'saved') returning id""", (STU, opp_noessay))
app2 = cur.fetchone()[0]
cur.execute("select * from submit_application(%s,%s)", (STU, app2))
check("submit succeeds with no essay when the scholarship doesn't require one", cur.fetchone()[0] == "submitted")

print("\n=== 3. CROSS-USER PROTECTION ===")
try:
    cur.execute("select * from submit_application(%s,%s)", (OTHER_STU, app_id))
    check("another student cannot submit someone else's application", False)
except Exception as e:
    check("another student cannot submit someone else's application", "not found" in str(e).lower())

print("\n=== 4. BENEFACTOR SEES ONLY REAL SUBMISSIONS ===")
cur.execute("""insert into opportunity_applications(user_id,opportunity_id,status)
 values (%s,%s,'saved') returning id""", (OTHER_STU, opp))
bookmark_only = cur.fetchone()[0]
cur.execute("select id, status from benefactor_applications(%s)", (BEN,))
rows = cur.fetchall()
ids = [r[0] for r in rows]
check("submitted application IS visible to benefactor", app_id in ids)
check("mere bookmark ('saved') is NOT visible to benefactor", bookmark_only not in ids, str(rows))

print("\n=== 5. NOTIFICATIONS FIRE ===")
as_user(None)
cur.execute("select * from benefactor_deposit_funds(%s, 10000, 'test funding')", (BEN,))
as_user(BEN)
cur.execute("update opportunity_applications set status='shortlisted' where id=%s", (app_id,))
cur.execute("select title, body from notifications where user_id=%s order by created_at desc limit 1", (STU,))
title, body = cur.fetchone()
check("shortlisting fires a notification", "shortlisted" in title.lower(), title)

cur.execute("update opportunity_applications set status='awarded', award_amount=4000 where id=%s", (app_id,))
cur.execute("select * from pay_applicant(%s,%s)", (BEN, app_id))
cur.execute("select title, body, action_url from notifications where user_id=%s order by created_at desc limit 1", (STU,))
title, body, url = cur.fetchone()
check("payment fires a notification", "payment" in title.lower(), title)
check("notification links to the wallet", url == "/wallet", url)
check("notification body includes the real amount", "4000" in body, body)

print("\n" + "=" * 55)
print("RESULT:", "ALL PASS" if ok else "FAILURES")
print("=" * 55)
db.cleanup()

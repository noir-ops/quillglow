"""Test duplicate document detection: fraud signal fires, own re-use doesn't, cross-benefactor privacy holds."""
import pathlib, pgserver, psycopg2
b = "/home/claude/work/qg/quillglow-main/scripts/"
db = pgserver.get_server("/tmp/pgtest_fraud")
conn = psycopg2.connect(db.get_uri()); conn.autocommit = True; cur = conn.cursor()
cur.execute("""create schema if not exists auth; create table auth.users(id uuid primary key);
create role authenticated;
create table public._ctx(uid uuid); insert into public._ctx values(null);
create or replace function auth.uid() returns uuid language sql stable as $$ select uid from public._ctx limit 1 $$;""")
cur.execute(pathlib.Path(b + "001_create_profiles.sql").read_text().split("-- Create trigger")[0])
cur.execute(pathlib.Path(b + "019_opportunities.sql").read_text())
cur.execute(pathlib.Path(b + "021_benefactor_accounts.sql").read_text())
cur.execute(pathlib.Path(b + "023_rbac_entitlements_audit.sql").read_text())
cur.execute(pathlib.Path(b + "025_secure_documents.sql").read_text())
cur.execute(pathlib.Path(b + "035_document_fraud_detection.sql").read_text())
print("migrations applied cleanly\n")

ok = True
def check(l, c, d=""):
    global ok
    print(f"  {'PASS' if c else 'FAIL'}  {l}  {d}")
    if not c: ok = False

STU_A = "11111111-1111-1111-1111-111111111111"
STU_B = "22222222-2222-2222-2222-222222222222"
BEN_1 = "33333333-3333-3333-3333-333333333333"
BEN_2 = "44444444-4444-4444-4444-444444444444"
ADMIN = "55555555-5555-5555-5555-555555555555"
for u in (STU_A, STU_B, BEN_1, BEN_2, ADMIN): cur.execute("insert into auth.users values (%s)", (u,))
cur.execute("insert into user_roles(user_id,role) values (%s,'admin')", (ADMIN,))
cur.execute("insert into benefactors(user_id,organization_name,contact_name,contact_email) values (%s,'B1','A','a@x.com') returning id", (BEN_1,))
ben1_id = cur.fetchone()[0]
cur.execute("insert into benefactors(user_id,organization_name,contact_name,contact_email) values (%s,'B2','B','b@x.com') returning id", (BEN_2,))
ben2_id = cur.fetchone()[0]

cur.execute("insert into opportunities(title,slug,status,benefactor_id) values ('Schol A','schol-a','active',%s) returning id", (ben1_id,))
opp1 = cur.fetchone()[0]
cur.execute("insert into opportunities(title,slug,status,benefactor_id) values ('Schol B','schol-b','active',%s) returning id", (ben1_id,))
opp1b = cur.fetchone()[0]
cur.execute("insert into opportunities(title,slug,status,benefactor_id) values ('Schol C','schol-c','active',%s) returning id", (ben2_id,))
opp2 = cur.fetchone()[0]

# --- Scenario 1: student A re-uses THEIR OWN file across two of their own
#     applications. Nobody else ever touches this checksum. Should be 0.
HASH_SELF = "self-reuse-hash-only-A-ever-uses-this"
cur.execute("insert into opportunity_applications(user_id,opportunity_id,status) values (%s,%s,'submitted') returning id", (STU_A, opp1))
app_a1 = cur.fetchone()[0]
cur.execute("insert into opportunity_applications(user_id,opportunity_id,status) values (%s,%s,'submitted') returning id", (STU_A, opp1b))
app_a2 = cur.fetchone()[0]
cur.execute("""insert into secure_documents(owner_id,storage_path,document_type,resource_type,resource_id,checksum)
 values (%s,'p/self1.pdf','recommendation','opportunity_application',%s,%s) returning id""", (STU_A, str(app_a1), HASH_SELF))
doc_self1 = cur.fetchone()[0]
cur.execute("""insert into secure_documents(owner_id,storage_path,document_type,resource_type,resource_id,checksum)
 values (%s,'p/self2.pdf','recommendation','opportunity_application',%s,%s)""", (STU_A, str(app_a2), HASH_SELF))

# --- Scenario 2: student A and student B submit the BYTE-IDENTICAL file to
#     DIFFERENT benefactors' scholarships. Exactly one cross-owner match each way.
HASH_FRAUD = "shared-fraudulent-hash-A-and-B-both-use"
cur.execute("insert into opportunity_applications(user_id,opportunity_id,status) values (%s,%s,'submitted') returning id", (STU_A, opp2))
app_a3 = cur.fetchone()[0]
cur.execute("insert into opportunity_applications(user_id,opportunity_id,status) values (%s,%s,'submitted') returning id", (STU_B, opp1))
app_b1 = cur.fetchone()[0]
cur.execute("""insert into secure_documents(owner_id,storage_path,document_type,resource_type,resource_id,checksum)
 values (%s,'p/fraud-a.pdf','recommendation','opportunity_application',%s,%s) returning id""", (STU_A, str(app_a3), HASH_FRAUD))
doc_fraud_a = cur.fetchone()[0]
cur.execute("""insert into secure_documents(owner_id,storage_path,document_type,resource_type,resource_id,checksum)
 values (%s,'p/fraud-b.pdf','recommendation','opportunity_application',%s,%s) returning id""", (STU_B, str(app_b1), HASH_FRAUD))
doc_fraud_b = cur.fetchone()[0]

# --- Scenario 3: a genuinely unique document.
HASH_UNIQUE = "nobody-else-ever-uses-this-one"
cur.execute("insert into opportunity_applications(user_id,opportunity_id,status) values (%s,%s,'submitted') returning id", (STU_B, opp2))
app_b2 = cur.fetchone()[0]
cur.execute("""insert into secure_documents(owner_id,storage_path,document_type,resource_type,resource_id,checksum)
 values (%s,'p/unique.pdf','recommendation','opportunity_application',%s,%s) returning id""", (STU_B, str(app_b2), HASH_UNIQUE))
doc_unique = cur.fetchone()[0]

print("1) same student reusing their own document across THEIR OWN applications is NOT flagged")
cur.execute("select document_duplicate_count(%s,%s)", (doc_self1, BEN_1))
check("self-reuse shows 0 duplicates", cur.fetchone()[0] == 0)

print("\n2) real fraud signal: different students, same file, different benefactors")
cur.execute("select document_duplicate_count(%s,%s)", (doc_fraud_b, BEN_1))
check("benefactor 1 (who owns student B's application) sees exactly 1 duplicate", cur.fetchone()[0] == 1)
cur.execute("select document_duplicate_count(%s,%s)", (doc_fraud_a, BEN_2))
check("benefactor 2 (who owns student A's OTHER application) also sees exactly 1", cur.fetchone()[0] == 1)

print("\n3) unique document shows zero duplicates")
cur.execute("select document_duplicate_count(%s,%s)", (doc_unique, BEN_2))
check("genuinely unique document shows 0", cur.fetchone()[0] == 0)

print("\n4) authorization: someone with no access to the application gets 0, not the real count")
ben3_user = "66666666-6666-6666-6666-666666666666"
cur.execute("insert into auth.users values (%s)", (ben3_user,))
cur.execute("insert into benefactors(user_id,organization_name,contact_name,contact_email) values (%s,'B3','C','c@x.com') returning id", (ben3_user,))
cur.execute("select document_duplicate_count(%s,%s)", (doc_fraud_b, ben3_user))
check("an unrelated benefactor with no access gets 0, not leaked count", cur.fetchone()[0] == 0)

print("\n5) admin sees full investigative detail")
cur.execute("select * from admin_document_duplicates(%s)", (doc_fraud_b,))
rows = cur.fetchall()
check("admin gets exactly the one real match, with owner identity", len(rows) == 1 and rows[0][1] == STU_A, str(rows))

print("\n6) the owning student can see their own document's duplicate count")
cur.execute("select document_duplicate_count(%s,%s)", (doc_fraud_b, STU_B))
check("owning student sees the count for their own document", cur.fetchone()[0] == 1)

print("\n" + "=" * 55)
print("RESULT:", "ALL PASS" if ok else "FAILURES")
print("=" * 55)
db.cleanup()

"""Test that match_opportunities() enforces review_status itself, not just status."""
import pathlib, pgserver, psycopg2
b = "/home/claude/work/qg/quillglow-main/scripts/"
db = pgserver.get_server("/tmp/pgtest_match")
conn = psycopg2.connect(db.get_uri()); conn.autocommit = True; cur = conn.cursor()
cur.execute("""create schema if not exists auth; create table auth.users(id uuid primary key);
create role authenticated;
create table public._ctx(uid uuid); insert into public._ctx values(null);
create or replace function auth.uid() returns uuid language sql stable as $$ select uid from public._ctx limit 1 $$;""")
cur.execute(pathlib.Path(b + "016_learning_graph.sql").read_text())
cur.execute(pathlib.Path(b + "019_opportunities.sql").read_text())
cur.execute(pathlib.Path(b + "021_benefactor_accounts.sql").read_text())
cur.execute(pathlib.Path(b + "036_match_requires_approval.sql").read_text())
print("migrations applied cleanly\n")

ok = True
def check(l, c, d=""):
    global ok
    print(f"  {'PASS' if c else 'FAIL'}  {l}  {d}")
    if not c: ok = False

STU = "11111111-1111-1111-1111-111111111111"
cur.execute("insert into auth.users values (%s)", (STU,))
cur.execute("insert into student_opportunity_profiles(user_id,country) values (%s,'NG')", (STU,))

print("1) normal case — properly approved AND active, matches correctly")
cur.execute("""insert into opportunities(title,slug,status,review_status,award_amount)
 values ('Legit Approved','legit','active','approved',500) returning id""")
legit = cur.fetchone()[0]
cur.execute("select opportunity_id from match_opportunities(%s,20)", (STU,))
ids = [r[0] for r in cur.fetchall()]
check("a properly approved+active scholarship still matches", legit in ids)

print("\n2) THE gap this closes: status=active but review_status NOT approved")
cur.execute("""insert into opportunities(title,slug,status,review_status,award_amount)
 values ('Reopened Rejected','reopened','active','rejected',500) returning id""")
reopened = cur.fetchone()[0]
cur.execute("select opportunity_id from match_opportunities(%s,20)", (STU,))
ids = [r[0] for r in cur.fetchall()]
check("a REJECTED listing manually flipped to status=active is NOT shown", reopened not in ids)

print("\n3) pending_review + active also correctly excluded")
cur.execute("""insert into opportunities(title,slug,status,review_status,award_amount)
 values ('Still Pending','pending','active','pending_review',500) returning id""")
pending = cur.fetchone()[0]
cur.execute("select opportunity_id from match_opportunities(%s,20)", (STU,))
ids = [r[0] for r in cur.fetchall()]
check("pending_review is NOT shown even if status=active", pending not in ids)

print("\n4) draft is correctly excluded (as before — unchanged behavior)")
cur.execute("""insert into opportunities(title,slug,status,review_status,award_amount)
 values ('Draft One','draft-one','draft','draft',500) returning id""")
draft = cur.fetchone()[0]
cur.execute("select opportunity_id from match_opportunities(%s,20)", (STU,))
ids = [r[0] for r in cur.fetchall()]
check("draft (status != active) still excluded", draft not in ids)

print("\n5) min_exam_readiness — confirms the ORIGINAL reported behavior is correct, not a bug")
cur.execute("""insert into opportunities(title,slug,status,review_status,award_amount,min_exam_readiness)
 values ('High Bar','high-bar','active','approved',750,90) returning id""")
high_bar = cur.fetchone()[0]
cur.execute("select opportunity_id from match_opportunities(%s,20)", (STU,))
ids = [r[0] for r in cur.fetchall()]
check("a scholarship requiring 90 readiness is excluded for a student with ~0 readiness", high_bar not in ids)

cur.execute("insert into intelligence_scores(user_id,score_type,scope,value) values (%s,'exam_readiness','global',95)", (STU,))
cur.execute("select opportunity_id from match_opportunities(%s,20)", (STU,))
ids = [r[0] for r in cur.fetchall()]
check("the SAME scholarship appears once readiness genuinely meets the bar", high_bar in ids)

print("\n" + "=" * 55)
print("RESULT:", "ALL PASS" if ok else "FAILURES")
print("=" * 55)
db.cleanup()

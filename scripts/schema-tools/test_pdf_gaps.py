"""Test Section C/D/E gap closures from the proposal PDF."""
import pathlib, pgserver, psycopg2, datetime
b = "/home/claude/work/qg/quillglow-main/scripts/"
db = pgserver.get_server("/tmp/pgtest_pdf")
conn = psycopg2.connect(db.get_uri()); conn.autocommit = True; cur = conn.cursor()
cur.execute("""create schema if not exists auth; create table auth.users(id uuid primary key);
create role authenticated; create table public._ctx(uid uuid); insert into public._ctx values(null);
create or replace function auth.uid() returns uuid language sql stable as $$ select uid from public._ctx limit 1 $$;
create table public.subscriptions(id uuid primary key default gen_random_uuid(), user_id uuid, plan_type text, status text);
create table public.benefactors(id uuid primary key default gen_random_uuid(), user_id uuid unique);
""")
cur.execute(pathlib.Path(b+"016_learning_graph.sql").read_text())
cur.execute(pathlib.Path(b+"019_opportunities.sql").read_text())
cur.execute(pathlib.Path(b+"029_pdf_gaps.sql").read_text())
print("migrations applied cleanly\n")
ok = True
def check(l, c, d=""):
    global ok
    print(f"  {'PASS' if c else 'FAIL'}  {l}  {d}")
    if not c: ok = False

U = "11111111-1111-1111-1111-111111111111"
cur.execute("insert into auth.users values (%s)", (U,))

print("1) Section D — new event types are storable")
for et in ("scholarship_application", "mentor_interaction", "purchase", "certification"):
    cur.execute("""select record_learning_event(%s,%s,'test',null,%s,'Physics','completed',null,null,null,'{}')""",
                (U, et, et))
cur.execute("select count(distinct event_type) from learning_events where user_id=%s", (U,))
check("all 4 new PDF event types recorded", cur.fetchone()[0] == 4)
cur.execute("""select count(*) from learning_events where event_type in
 ('scholarship_application','mentor_interaction','purchase','certification')""")
check("stored under correct types", cur.fetchone()[0] == 4)

print("\n2) Section E — improvement surfaces opportunities")
cur.execute("""insert into student_opportunity_profiles(user_id,country,education_level,syllabus,target_subjects)
 values (%s,'NG','secondary','WAEC',array['Physics'])""", (U,))
cur.execute("""insert into intelligence_scores(user_id,score_type,scope,value)
 values (%s,'exam_readiness','global',80)""", (U,))
# A strong STEM match, and a weak one that must NOT be pushed.
cur.execute("""insert into opportunities(title,slug,status,countries,subjects,award_amount,deadline)
 values ('STEM Physics Grant','stem-phys','active',array['NG'],array['Physics'],9000,current_date+60)
 returning id""")
strong = cur.fetchone()[0]
cur.execute("""insert into opportunities(title,slug,status,countries,award_amount,deadline)
 values ('Tiny Generic Award','tiny','active',null,50,current_date+900) returning id""")
weak = cur.fetchone()[0]
# Give the student real Physics mastery.
cur.execute("""insert into learning_concepts(syllabus,subject,name,slug,depth) values
 ('WAEC','Physics','Motion','phys-motion',2) returning id""")
cid = cur.fetchone()[0]
cur.execute("""insert into student_concept_mastery(user_id,concept_id,mastery,confidence,state,evidence_count)
 values (%s,%s,0.9,0.9,'mastered',10)""", (U, cid))

cur.execute("select generate_opportunity_recommendations(%s,10)", (U,))
n = cur.fetchone()[0]
check("recommendations generated", n > 0, f"created={n}")
cur.execute("select target_id, title, reason, score from recommendations where user_id=%s order by score desc", (U,))
recs = cur.fetchall()
check("strong STEM match recommended", any(r[0] == str(strong) for r in recs), str([r[1] for r in recs]))
check("weak match NOT pushed (below 50 threshold)", not any(r[0] == str(weak) for r in recs))
check("reason cites the subject improvement",
      any("improving" in (r[2] or "") for r in recs), str([r[2] for r in recs]))

print("\n3) no duplicate spam on repeat runs")
cur.execute("select generate_opportunity_recommendations(%s,10)", (U,))
second = cur.fetchone()[0]
cur.execute("select count(*) from recommendations where user_id=%s", (U,))
total = cur.fetchone()[0]
check("second run creates no duplicates", second == 0 and total == len(recs), f"created={second} total={total}")

print("\n4) dismissal allows future re-recommendation")
cur.execute("update recommendations set dismissed_at=now() where user_id=%s", (U,))
cur.execute("select generate_opportunity_recommendations(%s,10)", (U,))
check("dismissed items can resurface later", cur.fetchone()[0] > 0)

print("\n5) RLS present")
cur.execute("select count(*) from pg_policies where tablename='recommendations'")
check("recommendations table has policies", cur.fetchone()[0] >= 2)

print("\n" + "=" * 50); print("RESULT:", "ALL PASS" if ok else "FAILURES"); print("=" * 50)
db.cleanup()

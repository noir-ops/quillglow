"""Test the Learning Graph migration against real Postgres."""
import pathlib
import pgserver
import psycopg2

SQL = pathlib.Path("/home/claude/work/qg/quillglow-main/scripts/016_learning_graph.sql").read_text()

print("starting postgres...")
db = pgserver.get_server("/tmp/pgtest_graph")
conn = psycopg2.connect(db.get_uri())
conn.autocommit = True
cur = conn.cursor()

cur.execute("""
create schema if not exists auth;
create table auth.users (id uuid primary key);
create role authenticated;
create or replace function auth.uid() returns uuid language sql as $$ select null::uuid $$;
""")

print("applying migration...")
cur.execute(SQL)
print("  applied cleanly\n")

ok = True
def check(label, cond, detail=""):
    global ok
    print(f"  {'PASS' if cond else 'FAIL'}  {label}  {detail}")
    if not cond: ok = False

U = "11111111-1111-1111-1111-111111111111"
cur.execute("insert into auth.users values (%s)", (U,))

# Build a tiny curriculum: Maths > Algebra > {Fractions, Quadratics}
cur.execute("""
insert into learning_concepts (syllabus, subject, name, slug, depth, difficulty) values
 ('WAEC','Mathematics','Mathematics','waec-math',0,0.5) returning id
""")
subj = cur.fetchone()[0]
cur.execute("""
insert into learning_concepts (parent_id, syllabus, subject, name, slug, depth, difficulty) values
 (%s,'WAEC','Mathematics','Algebra','waec-math-algebra',1,0.5) returning id
""", (subj,))
topic = cur.fetchone()[0]
ids = {}
for nm, slug, diff in [("Fractions","waec-math-fractions",0.3), ("Quadratics","waec-math-quadratics",0.8)]:
    cur.execute("""insert into learning_concepts (parent_id,syllabus,subject,name,slug,depth,difficulty)
                   values (%s,'WAEC','Mathematics',%s,%s,2,%s) returning id""",(topic,nm,slug,diff))
    ids[nm]=cur.fetchone()[0]
# a third, never attempted, to test coverage penalty
cur.execute("""insert into learning_concepts (parent_id,syllabus,subject,name,slug,depth,difficulty)
               values (%s,'WAEC','Mathematics','Geometry','waec-math-geom',2,0.5)""",(topic,))

def ev(concept, outcome=None, score=None, mx=None, etype="quiz_answer"):
    cur.execute("""select record_learning_event(%s,%s,'test',%s,null,'Mathematics',%s,%s,%s,null,'{}')""",
                (U, etype, concept, outcome, score, mx))
    return cur.fetchone()[0]

# ── 1. Event logging ───────────────────────────────────────────────────────
print("1) event logging")
eid = ev(ids["Fractions"], "correct")
check("returns event id", eid > 0, f"id={eid}")
cur.execute("select count(*) from learning_events where user_id=%s",(U,))
check("event persisted", cur.fetchone()[0]==1)

# ── 2. Mastery created + confidence gate ──────────────────────────────────
print("\n2) mastery creation and confidence gating")
cur.execute("select mastery,confidence,state from student_concept_mastery where concept_id=%s",(ids["Fractions"],))
m,c,s = cur.fetchone()
check("mastery=1.0 after one correct", float(m)==1.0, f"mastery={m}")
check("state is 'learning', NOT 'mastered' (low confidence)", s=="learning", f"state={s}")

# ── 3. Repeated correct answers build confidence -> mastered ──────────────
print("\n3) repeated evidence builds mastery")
for _ in range(5): ev(ids["Fractions"], "correct")
cur.execute("select mastery,confidence,state,evidence_count from student_concept_mastery where concept_id=%s",(ids["Fractions"],))
m,c,s,n = cur.fetchone()
check("state becomes 'mastered'", s=="mastered", f"state={s} mastery={float(m):.3f} conf={float(c):.2f}")
check("evidence_count tracks", n==6, f"n={n}")

# ── 4. Wrong answers degrade, but not instantly ───────────────────────────
print("\n4) EWMA smoothing on wrong answers")
before = float(m)
ev(ids["Fractions"], "incorrect")
cur.execute("select mastery,state from student_concept_mastery where concept_id=%s",(ids["Fractions"],))
m2,s2 = cur.fetchone()
check("one wrong answer drops but doesn't zero mastery", 0.5 < float(m2) < before, f"{before:.3f} -> {float(m2):.3f}")

# ── 5. Weak state ─────────────────────────────────────────────────────────
print("\n5) weak detection")
for _ in range(8): ev(ids["Quadratics"], "incorrect")
cur.execute("select mastery,state from student_concept_mastery where concept_id=%s",(ids["Quadratics"],))
m3,s3 = cur.fetchone()
check("repeated failures -> 'weak'", s3=="weak", f"state={s3} mastery={float(m3):.3f}")

# ── 6. Scored events (exams) ──────────────────────────────────────────────
print("\n6) scored events")
ev(ids["Quadratics"], None, 45, 100, "exam_attempt")
cur.execute("select mastery from student_concept_mastery where concept_id=%s",(ids["Quadratics"],))
check("score/max_score normalises", float(cur.fetchone()[0])>float(m3), "45/100 nudges mastery up from 0")

# ── 7. Non-gradeable events log but don't affect mastery ──────────────────
print("\n7) exposure events")
cur.execute("select evidence_count from student_concept_mastery where concept_id=%s",(ids["Fractions"],))
n_before = cur.fetchone()[0]
ev(ids["Fractions"], "completed", etype="note_created")
cur.execute("select evidence_count from student_concept_mastery where concept_id=%s",(ids["Fractions"],))
check("'completed' outcome doesn't move mastery", cur.fetchone()[0]==n_before, "logged only")

# ── 8. Events without concept_id still log (pre-curriculum) ───────────────
print("\n8) unmapped events")
cur.execute("""select record_learning_event(%s,'tutor_exchange','tutor',null,'photosynthesis','Biology','correct',null,null,null,'{}')""",(U,))
cur.execute("select count(*) from learning_events where raw_topic='photosynthesis'")
check("raw_topic logged without concept mapping", cur.fetchone()[0]==1, "backfillable later")

# ── 9. Exam readiness + coverage penalty ──────────────────────────────────
print("\n9) exam readiness")
cur.execute("select compute_exam_readiness(%s,'WAEC','Mathematics')",(U,))
er = float(cur.fetchone()[0])
cur.execute("select breakdown from intelligence_scores where score_type='exam_readiness'")
bd = cur.fetchone()[0]
check("score computed and stored", 0 < er < 100, f"exam_readiness={er}")
check("coverage penalty applied (2 of 3 concepts)", bd["concepts_covered"]==2 and bd["concepts_total"]==3, str(bd))

# ── 10. Learning risk ─────────────────────────────────────────────────────
print("\n10) learning risk")
cur.execute("select compute_learning_risk(%s)",(U,))
risk = float(cur.fetchone()[0])
cur.execute("select breakdown from intelligence_scores where score_type='learning_risk'")
rb = cur.fetchone()[0]
check("risk computed", 0 <= risk <= 100, f"risk={risk}")
check("breakdown is explainable", set(rb)=={"weak_ratio","recent_accuracy","days_inactive"}, str(rb))

# ── 11. Spaced repetition scheduling ──────────────────────────────────────
print("\n11) spaced repetition")
cur.execute("""select state, extract(day from next_review_at-now())::int
               from student_concept_mastery where user_id=%s order by state""",(U,))
sched = cur.fetchall()
d=dict(sched)
check("weak reviewed soonest", d.get("weak",99)==1, str(sched))
check("stronger states scheduled further out", all(d[k]>d["weak"] for k in d if k!="weak"), str(sched))

# ── 12. Append-only guarantee ─────────────────────────────────────────────
print("\n12) append-only")
cur.execute("select count(*) from pg_policies where tablename='learning_events' and cmd in ('UPDATE','DELETE','INSERT')")
check("no client write policies on event log", cur.fetchone()[0]==0)

# ── 13. Rebuild from event log (append-only payoff) ──────────────────────
print("\n13) rebuild_mastery replay")
cur.execute("select count(*) from learning_events where user_id=%s",(U,))
ev_before = cur.fetchone()[0]
cur.execute("select concept_id,round(mastery,4),state,evidence_count from student_concept_mastery where user_id=%s order by concept_id",(U,))
snap_before = cur.fetchall()
cur.execute("select rebuild_mastery(%s)",(U,))
replayed = cur.fetchone()[0]
cur.execute("select count(*) from learning_events where user_id=%s",(U,))
ev_after = cur.fetchone()[0]
cur.execute("select concept_id,round(mastery,4),state,evidence_count from student_concept_mastery where user_id=%s order by concept_id",(U,))
snap_after = cur.fetchall()
check("event log NOT duplicated by rebuild", ev_before==ev_after, f"{ev_before} -> {ev_after}")
check("replayed every gradeable event", replayed>0, f"replayed={replayed}")
check("rebuilt state is identical to live state", snap_before==snap_after, "deterministic replay")

print("\n"+"="*55)
print("RESULT:", "ALL PASS" if ok else "FAILURES PRESENT")
print("="*55)
db.cleanup()

"""Test Consistency and Growth scores."""
import pathlib, pgserver, psycopg2, datetime
b="/home/claude/work/qg/quillglow-main/scripts/"
db=pgserver.get_server("/tmp/pgtest_sc")
conn=psycopg2.connect(db.get_uri()); conn.autocommit=True; cur=conn.cursor()
cur.execute("""create schema if not exists auth; create table auth.users(id uuid primary key);
create role authenticated; create table public._ctx(uid uuid); insert into public._ctx values(null);
create or replace function auth.uid() returns uuid language sql stable as $$ select uid from public._ctx limit 1 $$;
create table public.subscriptions(id uuid primary key default gen_random_uuid(), user_id uuid, plan_type text, status text);
create table public.benefactors(id uuid primary key default gen_random_uuid(), user_id uuid unique);
""")
cur.execute(pathlib.Path(b+"016_learning_graph.sql").read_text())
cur.execute(pathlib.Path(b+"019_opportunities.sql").read_text())
cur.execute(pathlib.Path(b+"027_consistency_growth_scores.sql").read_text())
print("migrations applied cleanly\n")
ok=True
def check(l,c,d=""):
    global ok
    print(f"  {'PASS' if c else 'FAIL'}  {l}  {d}")
    if not c: ok=False

REG="11111111-1111-1111-1111-111111111111"   # regular studier
CRAM="22222222-2222-2222-2222-222222222222"  # crammer
IMP="33333333-3333-3333-3333-333333333333"   # improving
DEC="44444444-4444-4444-4444-444444444444"   # declining
NEW="55555555-5555-5555-5555-555555555555"   # new user
for u in (REG,CRAM,IMP,DEC,NEW): cur.execute("insert into auth.users values (%s)",(u,))

def ev(u, days_ago, outcome):
    cur.execute("""insert into learning_events(user_id,event_type,source,outcome,created_at)
     values (%s,'quiz_answer','t',%s, now() - make_interval(days=>%s))""",(u,outcome,days_ago))

print("1) consistency: regular vs cramming")
for d in range(14): ev(REG, d, 'correct')          # 14 consecutive days
for _ in range(30): ev(CRAM, 3, 'correct')          # 30 events, one single day
cur.execute("select compute_consistency_score(%s)",(REG,)); reg=float(cur.fetchone()[0])
cur.execute("select compute_consistency_score(%s)",(CRAM,)); cram=float(cur.fetchone()[0])
check("regular studier scores higher than crammer", reg>cram, f"regular={reg} crammer={cram}")
cur.execute("select breakdown from intelligence_scores where user_id=%s and score_type='consistency'",(REG,))
bd=cur.fetchone()[0]
check("streak detected", bd['longest_streak']>=13, str(bd['longest_streak']))
check("breakdown explainable", set(bd)>={'active_days','longest_streak'}, str(bd))

print("\n2) growth: improving vs declining")
for _ in range(10): ev(IMP, 50, 'incorrect')   # weak baseline
for _ in range(10): ev(IMP, 5, 'correct')      # strong recent
for _ in range(10): ev(DEC, 50, 'correct')     # strong baseline
for _ in range(10): ev(DEC, 5, 'incorrect')    # weak recent
cur.execute("select compute_growth_score(%s)",(IMP,)); imp=float(cur.fetchone()[0])
cur.execute("select compute_growth_score(%s)",(DEC,)); dec=float(cur.fetchone()[0])
check("improving student scores above neutral", imp>50, f"improving={imp}")
check("declining student scores below neutral", dec<50, f"declining={dec}")
check("improving ranks above declining", imp>dec)

print("\n3) growth: insufficient data is neutral, not zero")
cur.execute("select compute_growth_score(%s)",(NEW,)); new=float(cur.fetchone()[0])
check("new user gets neutral 50, not 0", new==50, f"score={new}")
cur.execute("select breakdown from intelligence_scores where user_id=%s and score_type='growth'",(NEW,))
check("status explains why", cur.fetchone()[0]['status']=='insufficient_data')

print("\n4) refresh_all_scores returns all six")
cur.execute("""insert into student_opportunity_profiles(user_id,country) values (%s,'NG')""",(REG,))
cur.execute("select refresh_all_scores(%s)",(REG,))
allsc=cur.fetchone()[0]
expected={'exam_readiness','learning_risk','consistency','growth','scholarship_readiness','opportunity'}
check("all 6 PDF scores computed", set(allsc)==expected, str(sorted(allsc)))
cur.execute("select count(distinct score_type) from intelligence_scores where user_id=%s",(REG,))
check("all persisted", cur.fetchone()[0]==6)

print("\n"+"="*50); print("RESULT:","ALL PASS" if ok else "FAILURES"); print("="*50)
db.cleanup()

"""Test the opportunities/matching engine."""
import pathlib, pgserver, psycopg2
base="/home/claude/work/qg/quillglow-main/scripts/"
G=pathlib.Path(base+"016_learning_graph.sql").read_text()
O=pathlib.Path(base+"019_opportunities.sql").read_text()
db=pgserver.get_server("/tmp/pgtest_opp")
conn=psycopg2.connect(db.get_uri()); conn.autocommit=True; cur=conn.cursor()
cur.execute("create schema if not exists auth; create table auth.users(id uuid primary key); create role authenticated; create or replace function auth.uid() returns uuid language sql as $$ select null::uuid $$;")
cur.execute(G); cur.execute(O); print("migrations applied cleanly\n")
ok=True
def check(l,c,d=""):
    global ok
    print(f"  {'PASS' if c else 'FAIL'}  {l}  {d}")
    if not c: ok=False

NG="11111111-1111-1111-1111-111111111111"   # Nigeria, 17, WAEC
US="22222222-2222-2222-2222-222222222222"   # US, 25
cur.execute("insert into auth.users values (%s),(%s)",(NG,US))
cur.execute("""insert into student_opportunity_profiles (user_id,country,date_of_birth,education_level,syllabus,target_subjects)
 values (%s,'NG',current_date - interval '17 years','secondary','WAEC',array['Mathematics'])""",(NG,))
cur.execute("""insert into student_opportunity_profiles (user_id,country,date_of_birth,education_level,syllabus)
 values (%s,'US',current_date - interval '25 years','postgraduate','SAT')""",(US,))

def opp(**k):
    cols=",".join(k); vals=",".join(["%s"]*len(k))
    cur.execute(f"insert into opportunities ({cols}) values ({vals}) returning id",tuple(k.values()))
    return cur.fetchone()[0]

o_ng   = opp(title='NG STEM Grant',slug='ng-stem',countries=['NG'],subjects=['Mathematics'],award_amount=5000,deadline='2027-06-01')
o_us   = opp(title='US Only',slug='us-only',countries=['US'],award_amount=8000,deadline='2027-06-01')
o_open = opp(title='Global Open',slug='global',award_amount=1000,is_rolling=True)
o_old  = opp(title='Expired',slug='expired',deadline='2020-01-01')
o_age  = opp(title='Adults Only',slug='adults',min_age=21,award_amount=9000,deadline='2027-06-01')
o_gate = opp(title='High Achievers',slug='high',min_exam_readiness=80,award_amount=20000,deadline='2027-06-01')
o_soon = opp(title='Closing Soon',slug='soon',countries=['NG'],award_amount=3000,deadline=(__import__('datetime').date.today()+__import__('datetime').timedelta(days=10)).isoformat())

print("1) hard eligibility filters")
cur.execute("select title from match_opportunities(%s,50)",(NG,))
ng=[r[0] for r in cur.fetchall()]
check("country filter excludes US-only", 'US Only' not in ng, str(ng))
check("expired excluded", 'Expired' not in ng)
check("age gate excludes 17yo from 21+", 'Adults Only' not in ng)
check("readiness gate excludes (no score yet)", 'High Achievers' not in ng)
check("own-country opportunity included", 'NG STEM Grant' in ng)
check("global open included", 'Global Open' in ng)

cur.execute("select title from match_opportunities(%s,50)",(US,))
us=[r[0] for r in cur.fetchall()]
check("US student sees US opp", 'US Only' in us)
check("US student does NOT see NG opp", 'NG STEM Grant' not in us)
check("25yo passes age gate", 'Adults Only' in us, str(us))

print("\n2) readiness gate opens when earned")
cur.execute("""insert into intelligence_scores(user_id,score_type,scope,value)
 values (%s,'exam_readiness','global',85)""",(NG,))
cur.execute("select title from match_opportunities(%s,50)",(NG,))
check("high-value opp unlocks at 85 readiness", 'High Achievers' in [r[0] for r in cur.fetchall()])

print("\n3) graph-driven ranking")
cur.execute("insert into learning_concepts(syllabus,subject,name,slug,depth) values ('WAEC','Mathematics','Quadratics','q',2) returning id")
cid=cur.fetchone()[0]
cur.execute("""insert into student_concept_mastery(user_id,concept_id,mastery,confidence,state,evidence_count)
 values (%s,%s,0.9,0.9,'mastered',10)""",(NG,cid))
cur.execute("select title,match_score,reasons from match_opportunities(%s,50)",(NG,))
rows=cur.fetchall()
stem=[r for r in rows if r[0]=='NG STEM Grant'][0]
check("subject mastery feeds match reasons", stem[2]['strong_concepts']==1, str(stem[2]))
check("scores are ranked descending", [r[1] for r in rows]==sorted([r[1] for r in rows],reverse=True))
soon=[r for r in rows if r[0]=='Closing Soon'][0]
check("closing-soon surfaces urgency in reasons", soon[2]['days_left']==10, str(soon[2]))

print("\n4) scholarship readiness")
cur.execute("select compute_scholarship_readiness(%s)",(NG,))
sr=float(cur.fetchone()[0])
cur.execute("select breakdown from intelligence_scores where user_id=%s and score_type='scholarship_readiness'",(NG,))
bd=cur.fetchone()[0]
check("computed in range", 0<sr<=100, f"score={sr}")
check("profile completeness counted", bd['profile_completeness']==1.0, str(bd))
cur.execute("select compute_scholarship_readiness(%s)",(US,))
check("incomplete profile scores lower", float(cur.fetchone()[0])<sr, "US profile missing target_subjects")

print("\n5) opportunity score")
cur.execute("select compute_opportunity_score(%s)",(NG,))
os_=float(cur.fetchone()[0])
cur.execute("select breakdown from intelligence_scores where user_id=%s and score_type='opportunity'",(NG,))
ob=cur.fetchone()[0]
check("computed in range", 0<os_<=100, f"score={os_}")
check("counts closing-soon", ob['closing_soon']>=1, str(ob))

print("\n6) applications isolation")
cur.execute("insert into opportunity_applications(user_id,opportunity_id,status) values (%s,%s,'submitted')",(NG,o_ng))
try:
    cur.execute("insert into opportunity_applications(user_id,opportunity_id) values (%s,%s)",(NG,o_ng))
    check("duplicate application rejected", False)
except Exception: check("duplicate application rejected", True)
cur.execute("select count(*) from pg_policies where tablename='opportunity_applications'")
check("RLS policy present", cur.fetchone()[0]>0)

print("\n"+"="*55); print("RESULT:","ALL PASS" if ok else "FAILURES"); print("="*55)
db.cleanup()

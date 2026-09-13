"""Test the event bus: dedupe, claim, retry, backoff, dead-letter, recovery."""
import pathlib, pgserver, psycopg2, threading, time

SQL = pathlib.Path("/home/claude/work/qg/quillglow-main/scripts/018_event_bus.sql").read_text()
db = pgserver.get_server("/tmp/pgtest_ev")
dsn = db.get_uri(); conn=psycopg2.connect(dsn); conn.autocommit=True; cur=conn.cursor()
cur.execute("create schema if not exists auth; create table auth.users (id uuid primary key); create role authenticated;")
cur.execute(SQL); print("migration applied cleanly\n")

ok=True
def check(l,c,d=""):
    global ok
    print(f"  {'PASS' if c else 'FAIL'}  {l}  {d}")
    if not c: ok=False

U="11111111-1111-1111-1111-111111111111"
cur.execute("insert into auth.users values (%s)",(U,))

print("1) dedupe / debounce")
for i in range(20):
    cur.execute("select emit_event('assessment.requested',%s,%s::jsonb,%s,0)",(U,'{"q":%d}'%i,f"assess:{U}"))
cur.execute("select count(*) from platform_events where status='pending' and dedupe_key=%s",(f"assess:{U}",))
check("20 emissions collapse to 1 pending event", cur.fetchone()[0]==1)
cur.execute("select payload from platform_events where dedupe_key=%s",(f"assess:{U}",))
check("payload merged (last wins)", cur.fetchone()[0]=={"q":19})

print("\n2) distinct keys stay separate")
cur.execute("select emit_event('curriculum.requested',%s,'{}'::jsonb,%s,0)",(U,f"curr:{U}"))
cur.execute("select count(*) from platform_events where status='pending'")
check("2 distinct pending events", cur.fetchone()[0]==2)

print("\n3) claim locks events")
cur.execute("select id,event_type from claim_events('worker-1',10)")
claimed=cur.fetchall()
check("claimed both", len(claimed)==2)
cur.execute("select count(*) from platform_events where status='processing'")
check("marked processing", cur.fetchone()[0]==2)
cur.execute("select count(*) from claim_events('worker-2',10)")
check("second worker gets nothing (no double-processing)", cur.fetchone()[0]==0)

print("\n4) concurrent workers never double-claim")
for i in range(30):
    cur.execute("select emit_event('scores.refresh_requested',%s,'{}'::jsonb,%s,0)",(U,f"score:{i}"))
got=[]; lock=threading.Lock()
def worker(wid):
    c=psycopg2.connect(dsn); c.autocommit=True; cc=c.cursor()
    cc.execute("select id from claim_events(%s,10)",(f"w{wid}",))
    ids=[r[0] for r in cc.fetchall()]
    with lock: got.extend(ids)
    c.close()
ts=[threading.Thread(target=worker,args=(i,)) for i in range(6)]
[t.start() for t in ts]; [t.join() for t in ts]
check("no event claimed twice", len(got)==len(set(got)), f"{len(got)} claims, {len(set(got))} unique")
check("all 30 claimed", len(set(got))==30, f"{len(set(got))}")

print("\n5) complete")
cur.execute("select complete_event(%s)",(claimed[0][0],))
cur.execute("select status,processed_at is not null from platform_events where id=%s",(claimed[0][0],))
s,p=cur.fetchone(); check("marked done with timestamp", s=="done" and p)

print("\n6) retry with backoff")
eid=claimed[1][0]
cur.execute("select fail_event(%s,'boom')",(eid,))
cur.execute("select status,attempts,run_after>now(),last_error from platform_events where id=%s",(eid,))
s,a,future,err=cur.fetchone()
check("requeued as pending", s=="pending")
check("backoff pushes run_after into future", future, f"attempts={a}")
check("error recorded", err=="boom")

print("\n7) dead-letter after max attempts")
for _ in range(3):
    cur.execute("update platform_events set run_after=now() where id=%s",(eid,))
    cur.execute("select id from claim_events('w',10) where id=%s",(eid,))
    cur.execute("select fail_event(%s,'boom again')",(eid,))
cur.execute("select status,attempts from platform_events where id=%s",(eid,))
s,a=cur.fetchone()
check("dead-lettered, not retried forever", s=="failed", f"status={s} attempts={a}")
check("row retained for inspection", a>=3)

print("\n8) stale recovery (crashed worker)")
cur.execute("select emit_event('assessment.requested',%s,'{}'::jsonb,'stale-test',0)",(U,))
cur.execute("select id from claim_events('crashy',10)")
cur.execute("update platform_events set locked_at=now()-interval '30 minutes' where status='processing'")
cur.execute("select requeue_stale_events(10)")
n=cur.fetchone()[0]
check("stuck events requeued", n>0, f"requeued={n}")

print("\n9) delayed events")
cur.execute("select emit_event('curriculum.requested',%s,'{}'::jsonb,'delayed',60)",(U,))
cur.execute("select count(*) from claim_events('w',50) ")
cur.execute("select count(*) from platform_events where dedupe_key='delayed' and status='pending'")
check("delayed event not claimed early", cur.fetchone()[0]==1)

print("\n10) health view")
cur.execute("select event_type,status,count from event_queue_health order by event_type,status")
rows=cur.fetchall()
check("health view reports queue state", len(rows)>0, f"{len(rows)} groups")

print("\n"+"="*55); print("RESULT:","ALL PASS" if ok else "FAILURES"); print("="*55)
db.cleanup()

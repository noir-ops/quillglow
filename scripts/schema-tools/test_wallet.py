"""Test wallet ledger integrity and notification preferences."""
import pathlib, pgserver, psycopg2, threading
db=pgserver.get_server("/tmp/pgtest_wal")
dsn=db.get_uri(); conn=psycopg2.connect(dsn); conn.autocommit=True; cur=conn.cursor()
cur.execute("""create schema if not exists auth; create table auth.users(id uuid primary key);
create role authenticated;
create table public._ctx(uid uuid); insert into public._ctx values (null);
create or replace function auth.uid() returns uuid language sql stable as $$ select uid from public._ctx limit 1 $$;""")
cur.execute(pathlib.Path("/home/claude/work/qg/quillglow-main/scripts/024_wallet_notifications.sql").read_text())
print("migration applied cleanly\n")
ok=True
def check(l,c,d=""):
    global ok
    print(f"  {'PASS' if c else 'FAIL'}  {l}  {d}")
    if not c: ok=False
U="11111111-1111-1111-1111-111111111111"
cur.execute("insert into auth.users values (%s)",(U,))

print("1) credits and debits")
cur.execute("select * from post_wallet_transaction(%s,500,'scholarship_award','Award')",(U,))
tid,bal,dup=cur.fetchone()
check("credit posts", float(bal)==500 and dup is False, f"bal={bal}")
cur.execute("select * from post_wallet_transaction(%s,-120,'marketplace_purchase','Book')",(U,))
_,bal,_=cur.fetchone()
check("debit reduces balance", float(bal)==380, f"bal={bal}")

print("\n2) overdraft blocked")
try:
    cur.execute("select * from post_wallet_transaction(%s,-1000,'marketplace_purchase')",(U,))
    check("overdraft rejected", False, "it succeeded!")
except Exception as e:
    check("overdraft rejected", "Insufficient funds" in str(e))
cur.execute("select balance_cached from wallets where user_id=%s",(U,))
check("balance unchanged after rejection", float(cur.fetchone()[0])==380)

print("\n3) idempotency (webhook replay)")
cur.execute("select * from post_wallet_transaction(%s,50,'topup','Top up',null,null,'evt_123')",(U,))
t1,b1,d1=cur.fetchone()
cur.execute("select * from post_wallet_transaction(%s,50,'topup','Top up',null,null,'evt_123')",(U,))
t2,b2,d2=cur.fetchone()
check("replay flagged duplicate", d2 is True)
check("money NOT moved twice", float(b2)==float(b1)==430, f"{b1} vs {b2}")
cur.execute("select count(*) from wallet_transactions where idempotency_key='evt_123'")
check("only one ledger row", cur.fetchone()[0]==1)

print("\n4) concurrent debits cannot both pass")
cur.execute("select * from post_wallet_transaction(%s,-330,'adjustment')",(U,))  # leave 100
results=[]; lock=threading.Lock()
def worker():
    c=psycopg2.connect(dsn); c.autocommit=True; cc=c.cursor()
    try:
        cc.execute("select * from post_wallet_transaction(%s,-80,'marketplace_purchase')",(U,))
        with lock: results.append(True)
    except Exception:
        with lock: results.append(False)
    c.close()
ts=[threading.Thread(target=worker) for _ in range(5)]
[t.start() for t in ts]; [t.join() for t in ts]
cur.execute("select balance_cached from wallets where user_id=%s",(U,))
final=float(cur.fetchone()[0])
check("only 1 of 5 concurrent debits succeeded", sum(results)==1, f"{sum(results)} succeeded")
check("balance never went negative", final>=0, f"final={final}")

print("\n5) ledger is source of truth")
cur.execute("update wallets set balance_cached=999999 where user_id=%s",(U,))
cur.execute("select reconcile_wallet(%s)",(U,))
rec=float(cur.fetchone()[0])
check("reconcile restores from ledger", rec==final, f"{rec} vs {final}")
cur.execute("select count(*) from pg_policies where tablename='wallet_transactions' and cmd in ('INSERT','UPDATE','DELETE')")
check("ledger not client-writable", cur.fetchone()[0]==0)

print("\n6) notifications + preferences")
cur.execute("select send_notification(%s,'scholarship','Award granted','You won!','/x','in_app')",(U,))
check("in_app sent", cur.fetchone()[0] is not None)
cur.execute("insert into notification_preferences (user_id,email_marketplace) values (%s,false)",(U,))
cur.execute("select send_notification(%s,'marketplace','Sale','..',null,'email')",(U,))
check("email respects opt-out", cur.fetchone()[0] is None)
cur.execute("select send_notification(%s,'scholarship','Deadline','..',null,'email')",(U,))
check("email sent when opted in", cur.fetchone()[0] is not None)
cur.execute("select send_notification(%s,'marketplace','Sale','..',null,'in_app')",(U,))
check("in_app always delivered regardless of opt-out", cur.fetchone()[0] is not None)
cur.execute("select unread_notification_count(%s)",(U,))
check("unread count works", cur.fetchone()[0]==3, )

print("\n"+"="*50); print("RESULT:","ALL PASS" if ok else "FAILURES"); print("="*50)
db.cleanup()

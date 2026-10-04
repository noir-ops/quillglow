"""Test the atomic quota migration against a real Postgres instance."""
import pathlib
import re
import threading

import pgserver
import psycopg2

SQL = pathlib.Path("/home/claude/work/qg/quillglow-main/scripts/015_atomic_ai_quota.sql").read_text()

print("starting postgres...")
db = pgserver.get_server("/tmp/pgtest_quota")
dsn = db.get_uri()
conn = psycopg2.connect(dsn)
conn.autocommit = True
cur = conn.cursor()

# ── Minimal stand-ins for the tables the migration depends on ───────────────
cur.execute("""
create schema if not exists auth;
create table auth.users (id uuid primary key);

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  plan_type text not null default 'scholar',
  status text not null default 'active'
);
create table public.usage_tracking (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  month_year text not null,
  tasks_created integer default 0,
  ai_generations_used integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id, month_year)
);
alter table public.usage_tracking enable row level security;
create policy "Users can update their own usage" on public.usage_tracking
  for update to public using (true);
create policy "Users can insert their own usage" on public.usage_tracking
  for insert to public with check (true);
create role authenticated;
""")

# Strip Supabase-only grants that don't apply to a bare instance
sql = SQL
print("applying migration...")
cur.execute(sql)
print("  migration applied cleanly\n")

FREE = "11111111-1111-1111-1111-111111111111"
PAID = "22222222-2222-2222-2222-222222222222"
cur.execute("insert into auth.users values (%s),(%s)", (FREE, PAID))
cur.execute(
    "insert into public.subscriptions (user_id, plan_type) values (%s,'scholar'),(%s,'genius')",
    (FREE, PAID),
)


def consume(user, feature, amount=1, c=None):
    cc = c or cur
    cc.execute("select * from public.consume_ai_quota(%s,%s,%s)", (user, feature, amount))
    return cc.fetchone()


ok = True


def check(label, cond, detail=""):
    global ok
    print(f"  {'PASS' if cond else 'FAIL'}  {label}  {detail}")
    if not cond:
        ok = False


# ── 1. Free user hits the per-feature cap ──────────────────────────────────
print("1) free user, audio_overview limit = 3")
results = [consume(FREE, "audio_overview") for _ in range(5)]
allowed = [r[0] for r in results]
check("first 3 allowed, next 2 denied", allowed == [True, True, True, False, False], str(allowed))
check("remaining hits 0", results[2][3] == 0, f"remaining={results[2][3]}")
check("denied call did NOT increment", results[3][1] == 3 and results[4][1] == 3,
      f"used={results[3][1]},{results[4][1]}")

# ── 2. Paid user unlimited ─────────────────────────────────────────────────
print("\n2) paid user, unlimited")
r = [consume(PAID, "audio_overview") for _ in range(10)]
check("all 10 allowed", all(x[0] for x in r))
check("limit reported as -1", r[0][2] == -1, f"limit={r[0][2]}")

# ── 3. Umbrella ai_total cap ───────────────────────────────────────────────
print("\n3) free user umbrella cap (ai_total = 100)")
cur.execute("select ai_generations_used from usage_tracking where user_id=%s", (FREE,))
before = cur.fetchone()[0]
# burn tutor_chat to its own cap of 50
for _ in range(50):
    consume(FREE, "tutor_chat")
cur.execute("select ai_generations_used, feature_usage from usage_tracking where user_id=%s", (FREE,))
total, fu = cur.fetchone()
check("tutor_chat capped at 50", fu.get("tutor_chat") == 50, f"tutor_chat={fu.get('tutor_chat')}")
check("ai_total accumulates across features", total == 53, f"ai_total={total}")
denied = consume(FREE, "tutor_chat")
check("51st tutor_chat denied", denied[0] is False)

# ── 4. Refund ──────────────────────────────────────────────────────────────
print("\n4) refund")
cur.execute("select public.refund_ai_quota(%s,'tutor_chat',1)", (FREE,))
cur.execute("select feature_usage->>'tutor_chat', ai_generations_used from usage_tracking where user_id=%s", (FREE,))
f, t = cur.fetchone()
check("refund decrements feature", int(f) == 49, f"tutor_chat={f}")
check("refund decrements total", t == 52, f"ai_total={t}")
after = consume(FREE, "tutor_chat")
check("slot freed by refund is reusable", after[0] is True)

# ── 5. CONCURRENCY — the real test ─────────────────────────────────────────
print("\n5) concurrency: 20 parallel requests against a limit of 10")
cur.execute("insert into auth.users values ('33333333-3333-3333-3333-333333333333')")
RACE = "33333333-3333-3333-3333-333333333333"
cur.execute("insert into subscriptions (user_id, plan_type) values (%s,'scholar')", (RACE,))
cur.execute("insert into plan_limits values ('scholar','race_test',10) on conflict do nothing")

granted = []
lock = threading.Lock()


def worker():
    c = psycopg2.connect(dsn)
    c.autocommit = True
    cc = c.cursor()
    cc.execute("select * from public.consume_ai_quota(%s,'race_test',1)", (RACE,))
    r = cc.fetchone()
    with lock:
        granted.append(r[0])
    c.close()


threads = [threading.Thread(target=worker) for _ in range(20)]
for t in threads:
    t.start()
for t in threads:
    t.join()

n_allowed = sum(granted)
cur.execute("select feature_usage->>'race_test' from usage_tracking where user_id=%s", (RACE,))
stored = int(cur.fetchone()[0])
check("exactly 10 of 20 allowed", n_allowed == 10, f"allowed={n_allowed}")
check("stored counter == allowed count (no leak)", stored == 10, f"stored={stored}")

# ── 6. Direct writes blocked ───────────────────────────────────────────────
print("\n6) policy lockdown")
cur.execute("select count(*) from pg_policies where tablename='usage_tracking' and cmd in ('UPDATE','INSERT')")
check("user-writable policies removed", cur.fetchone()[0] == 0)

# ── 7. Status function ─────────────────────────────────────────────────────
print("\n7) quota status")
cur.execute("select * from public.get_ai_quota_status(%s)", (FREE,))
rows = cur.fetchall()
check("returns a row per configured feature", len(rows) >= 6, f"rows={len(rows)}")
ao = [r for r in rows if r[0] == "audio_overview"][0]
check("audio_overview shows 3/3 used, 0 remaining", ao[1] == 3 and ao[3] == 0, str(ao))

print("\n" + "=" * 55)
print("RESULT:", "ALL PASS" if ok else "FAILURES PRESENT")
print("=" * 55)
db.cleanup()

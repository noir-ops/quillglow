"""Test chat retention pruning: age-based, min-keep floor, hard cap, ordering."""
import pathlib, pgserver, psycopg2, json
from datetime import datetime, timedelta, timezone

db = pgserver.get_server("/tmp/pgtest_ret")
conn = psycopg2.connect(db.get_uri()); conn.autocommit = True; cur = conn.cursor()
cur.execute("create schema if not exists auth; create table auth.users(id uuid primary key); create role authenticated; create or replace function auth.uid() returns uuid language sql stable as $$ select null::uuid $$;")
cur.execute(pathlib.Path("/home/claude/work/qg/quillglow-main/scripts/020_sprout_chat_sessions.sql").read_text())
cur.execute("""
create table public.tutor_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null, subject text, context_type text,
  messages jsonb not null default '[]'::jsonb, updated_at timestamptz default now()
);
""")
cur.execute(pathlib.Path("/home/claude/work/qg/quillglow-main/scripts/028_chat_retention.sql").read_text())
print("migrations applied cleanly\n")

ok = True
def check(l, c, d=""):
    global ok
    print(f"  {'PASS' if c else 'FAIL'}  {l}  {d}")
    if not c: ok = False

U = "11111111-1111-1111-1111-111111111111"
cur.execute("insert into auth.users values (%s)", (U,))

def msg(role, days_ago, text):
    ts = (datetime.now(timezone.utc) - timedelta(days=days_ago)).isoformat()
    return {"role": role, "content": text, "created_at": ts}

# ── Session 1: mix of old and recent, more than min_keep ────────────────────
old_msgs = [msg("user", 120, f"old-{i}") for i in range(15)]      # older than 90 days
recent_msgs = [msg("user", 5, f"recent-{i}") for i in range(8)]    # within 90 days
s1_messages = old_msgs + recent_msgs
cur.execute("insert into sprout_chat_sessions (user_id, messages, message_count) values (%s,%s,%s) returning id",
            (U, json.dumps(s1_messages), len(s1_messages)))
s1 = cur.fetchone()[0]

# ── Session 2: ALL old, fewer than min_keep total ────────────────────────────
s2_messages = [msg("user", 200, f"ancient-{i}") for i in range(6)]
cur.execute("insert into sprout_chat_sessions (user_id, messages, message_count) values (%s,%s,%s) returning id",
            (U, json.dumps(s2_messages), len(s2_messages)))
s2 = cur.fetchone()[0]

# ── Session 3: ALL old, more than min_keep — should keep exactly min_keep (10), newest ──
s3_messages = [msg("user", 300, f"veryold-{i}") for i in range(25)]
cur.execute("insert into sprout_chat_sessions (user_id, messages, message_count) values (%s,%s,%s) returning id",
            (U, json.dumps(s3_messages), len(s3_messages)))
s3 = cur.fetchone()[0]

# ── Session 4: all recent, small — should be untouched entirely ─────────────
s4_messages = [msg("user", 1, f"today-{i}") for i in range(5)]
cur.execute("insert into sprout_chat_sessions (user_id, messages, message_count) values (%s,%s,%s) returning id",
            (U, json.dumps(s4_messages), len(s4_messages)))
s4 = cur.fetchone()[0]

# ── tutor_sessions: no per-message timestamp, huge, must cap by count ───────
t_messages = [{"role": "user", "content": f"t-{i}"} for i in range(350)]
cur.execute("insert into tutor_sessions (user_id, messages) values (%s,%s) returning id",
            (U, json.dumps(t_messages)))
t1 = cur.fetchone()[0]

cur.execute("select * from prune_chat_history(90, 10, 200)")
results = {(r[1], str(r[0])): {"before": r[2], "after": r[3]} for r in cur.fetchall()}

print("1) mixed old+recent session (23 total, 8 within 90d)")
r = results.get(("sprout_chat_sessions", s1))
check("session pruned", r is not None, str(r))
cur.execute("select messages from sprout_chat_sessions where id=%s", (s1,))
kept1 = [m["content"] for m in cur.fetchone()[0]]
if r:
    # min_keep=10 is a FLOOR, not a ceiling — the OR logic guarantees at least
    # 10 messages survive regardless of age, so here that's the 8 recent ones
    # PLUS the 2 newest old ones (to reach the floor of 10). This is the
    # intended behaviour: a returning student never sees fewer than min_keep
    # messages even if all recent ones are few.
    check("kept the floor of 10 (8 recent + 2 newest-old to satisfy min_keep)",
          r["after"] == 10 and kept1 == [f"old-{i}" for i in (13,14)] + [f"recent-{i}" for i in range(8)],
          str(kept1))

print("\n2) all-old session BELOW min_keep floor — must not be emptied")
r = results.get(("sprout_chat_sessions", s2))
check("session with only 6 msgs (< min_keep=10) is left alone entirely", r is None, str(r))
cur.execute("select jsonb_array_length(messages) from sprout_chat_sessions where id=%s", (s2,))
check("all 6 ancient messages preserved (floor protects against emptying)", cur.fetchone()[0] == 6)

print("\n3) all-old session ABOVE min_keep — keeps exactly min_keep, newest ones, correct order")
r = results.get(("sprout_chat_sessions", s3))
check("pruned", r is not None and r["after"] == 10, str(r))
cur.execute("select messages from sprout_chat_sessions where id=%s", (s3,))
kept = cur.fetchone()[0]
contents = [m["content"] for m in kept]
check("kept the 10 NEWEST (highest indices), not oldest", contents == [f"veryold-{i}" for i in range(15, 25)], str(contents))
check("chronological order preserved after pruning", [m["created_at"] for m in kept] == sorted(m["created_at"] for m in kept))

print("\n4) small recent session untouched")
check("session 4 not in results at all", ("sprout_chat_sessions", s4) not in results)
cur.execute("select jsonb_array_length(messages) from sprout_chat_sessions where id=%s", (s4,))
check("all 5 messages still there", cur.fetchone()[0] == 5)

print("\n5) tutor_sessions hard cap (no per-message timestamps)")
r = results.get(("tutor_sessions", t1))
check("tutor session pruned", r is not None, str(r))
if r:
    check("capped to exactly 200", r["after"] == 200, f"after={r['after']}")
cur.execute("select messages from tutor_sessions where id=%s", (t1,))
tkept = cur.fetchone()[0]
tcontents = [m["content"] for m in tkept]
check("kept the newest 200 (highest indices)", tcontents == [f"t-{i}" for i in range(150, 350)], str(tcontents[:3])+"...")

print("\n6) idempotency — running twice doesn't double-prune or error")
cur.execute("select * from prune_chat_history(90, 10, 200)")
second_run = cur.fetchall()
check("second run finds nothing left to prune", len(second_run) == 0, f"{len(second_run)} rows")

print("\n" + "=" * 55)
print("RESULT:", "ALL PASS" if ok else "FAILURES")
print("=" * 55)
db.cleanup()

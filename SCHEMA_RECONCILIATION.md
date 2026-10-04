# Phase 0 · Step 1 — Schema Reconciliation

**Goal:** make the entire QuillGlow database reproducible from `scripts/`, so you can spin up a clean staging project and refactor safely.

**Current state:** 56 tables used in code, 18 covered by migrations, **38 with no migration at all**.

**Time:** 2–4 days. Most of it is mechanical.

---

## Why this is first

Right now you cannot:
- create a clean environment to test a migration against,
- roll back a bad schema change with confidence,
- onboard anyone else onto the project,
- or let an AI agent touch the DB safely.

Everything in Phases 1–3 assumes all four. So this comes first.

---

## Step 1.1 — Dump the live schema

Install the Supabase CLI, then dump **schema only** (no data):

```bash
npm install -g supabase
supabase login

# Link to your existing project (find the ref in Dashboard → Settings → General)
supabase link --project-ref <your-project-ref>

# Schema-only dump of the public schema
supabase db dump --schema public -f supabase/baseline_public.sql

# Auth/storage triggers and policies you may depend on
supabase db dump --schema auth --schema storage -f supabase/baseline_auth_storage.sql

# RLS policies, functions, triggers come with the above, but dump roles too
supabase db dump --role-only -f supabase/baseline_roles.sql
```

**No CLI access?** Dashboard → SQL Editor, and run:

```sql
-- table + column inventory
select table_name, column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema = 'public'
order by table_name, ordinal_position;

-- constraints and keys
select tc.table_name, tc.constraint_name, tc.constraint_type, kcu.column_name
from information_schema.table_constraints tc
left join information_schema.key_column_usage kcu
  on tc.constraint_name = kcu.constraint_name
where tc.table_schema = 'public'
order by tc.table_name;

-- indexes
select tablename, indexname, indexdef
from pg_indexes where schemaname = 'public' order by tablename;

-- RLS policies  ← do not skip this one
select tablename, policyname, permissive, roles, cmd, qual, with_check
from pg_policies where schemaname = 'public' order by tablename;

-- functions and triggers
select routine_name, routine_definition
from information_schema.routines where routine_schema = 'public';

select event_object_table, trigger_name, action_timing, event_manipulation, action_statement
from information_schema.triggers where trigger_schema = 'public';
```

Export each result to CSV and keep them in `supabase/inventory/`.

> **RLS is the part people forget.** 24 of your 38 undocumented tables are user-scoped (`user_id` filters in code). If you rebuild those tables without their policies, staging will look fine while every user can read every other user's data. Capture policies now.

---

## Step 1.2 — Verify the dump is complete

Run the verifier against your dump. It cross-checks the dump against every table and column the code actually uses:

```bash
python3 scripts/schema-tools/verify_schema.py supabase/baseline_public.sql
```

It reports three things:
- **MISSING** — code uses it, dump doesn't have it → your dump is incomplete, or the code references a dead table
- **ORPHAN** — dump has it, no code uses it → candidate for deletion (verify before dropping)
- **COLUMN GAPS** — table exists but a column the code reads/writes is absent

Iterate until MISSING is empty. Orphans are informational.

---

## Step 1.3 — Commit the baseline

Once verification passes:

```bash
mkdir -p supabase/migrations
cp supabase/baseline_public.sql supabase/migrations/00000000000000_baseline.sql
git add supabase/ && git commit -m "chore: baseline schema (56 tables)"
```

From this commit forward, **every schema change is a new numbered migration**. No more dashboard edits. That single discipline change is the actual deliverable of this step.

Your existing `scripts/*.sql` files stay as historical record — the baseline supersedes them. Add a note at the top of `scripts/README.md` saying so, so nobody runs them again by mistake.

---

## Step 1.4 — Stand up staging

```bash
# Create a second Supabase project in the dashboard, then:
supabase link --project-ref <staging-ref>
supabase db push
```

Verify it matches:

```bash
supabase db diff --linked
# should print no differences
```

Then point a local `.env.staging` at it. You now have somewhere safe to break things.

---

## Step 1.5 — Decide on the orphans

The verifier will likely flag a few tables in the DB that no code touches. For each: confirm it's genuinely dead, then drop it **in a migration** (not the dashboard). Fewer tables = less to carry through the refactor.

Do **not** drop anything you're unsure about. A dead table costs almost nothing; a wrongly-dropped one costs a restore.

---

## Exit criteria

You're done with Step 1 when all five are true:

- [ ] `supabase db push` builds the full schema into an empty project
- [ ] `verify_schema.py` reports zero MISSING tables and zero column gaps
- [ ] RLS policies are captured in the baseline, not just table definitions
- [ ] Staging project exists and `supabase db diff --linked` is clean
- [ ] Baseline migration is committed to git

---

## Reference: the 38 tables with no migration

24 of these are user-scoped and **need RLS policies** captured.

| Table | Cols | User-scoped |
|---|---|---|
| ambassador_certificates | 10 | |
| ambassador_rewards | 7 | |
| ambassadors | 14 | ✓ |
| audio_overviews | 12 | ✓ |
| community_channels | 3 | |
| community_messages | 5 | |
| community_reports | 1 | |
| early_access | 3 | |
| echomind_logs | 8 | ✓ |
| essay_attempts | 9 | ✓ |
| feature_feedback | 4 | ✓ |
| generated_exams | 10 | ✓ |
| habit_completions | 4 | ✓ |
| habits | 8 | ✓ |
| leaderboard | 0 | (likely a view) |
| mind_maps | 9 | ✓ |
| mock_exam_attempts | 15 | ✓ |
| partners | 1 | |
| referrals | 8 | |
| revision_notes | 12 | ✓ |
| search_bookmarks | 3 | ✓ |
| search_history | 3 | ✓ |
| study_agent_sessions | 16 | ✓ |
| study_buddy_matches | 3 | |
| study_buddy_requests | 3 | ✓ |
| study_room_members | 5 | ✓ |
| study_room_messages | 6 | |
| study_rooms | 7 | |
| study_sessions | 5 | ✓ |
| study_tracker_orders | 14 | |
| subject_colors | 3 | ✓ |
| time_blocks | 7 | ✓ |
| tutor_memory | 8 | ✓ |
| tutor_profiles | 5 | ✓ |
| tutor_sessions | 6 | ✓ |
| user_public_profile | 5 | ✓ |
| user_themes | 3 | ✓ |
| writing_improver_logs | 8 | ✓ |

`leaderboard` shows 0 columns because code only calls `select("*")` on it — it's almost certainly the view from `scripts/005_create_leaderboard_view.sql`. Confirm it's a view, not a table.

Full per-table column detail is in `scripts/schema-tools/schema-inventory.json`.

#!/usr/bin/env python3
"""
Verify a Supabase schema dump covers everything the QuillGlow code actually uses.

Usage:
    python3 scripts/schema-tools/verify_schema.py supabase/baseline_public.sql

Reports:
    MISSING     - code uses the table, the dump doesn't define it
    COLUMN GAP  - table exists but a column the code reads/writes is absent
    ORPHAN      - dump defines it, no code touches it (deletion candidate)
    RLS GAP     - user-scoped table with no RLS policy in the dump

Exit code is non-zero if there are MISSING tables or COLUMN GAPs, so you can
wire this into CI once the baseline is committed.
"""
import json
import pathlib
import re
import sys

HERE = pathlib.Path(__file__).parent
INVENTORY = HERE / "schema-inventory.json"

# Tables the code never touches directly but that must exist.
IGNORE_ORPHANS = {"schema_migrations", "supabase_migrations"}

# Column names that are relation embeds or client-side aliases, not real columns.
# Extend this as you find false positives.
NOT_REAL_COLUMNS = {
    "habit_completions",   # nested relation in a habits select
    "flashcards",          # nested relation in a flashcard_decks select
    "study_plan_goals",    # nested relation in a study_plans select
}


def parse_dump(sql: str):
    """Return {table: {columns}} plus the set of tables with RLS policies."""
    tables = {}

    # CREATE TABLE ... ( ... );
    for m in re.finditer(
        r'create table (?:if not exists )?(?:"?public"?\.)?"?([a-z_][a-z0-9_]*)"?\s*\(',
        sql,
        re.I,
    ):
        name = m.group(1).lower()
        start = m.end() - 1
        depth, i = 0, start
        while i < len(sql):
            if sql[i] == "(":
                depth += 1
            elif sql[i] == ")":
                depth -= 1
                if depth == 0:
                    break
            i += 1
        body = sql[start + 1 : i]

        cols = set()
        depth = 0
        line = ""
        for ch in body + ",":
            if ch == "(":
                depth += 1
            elif ch == ")":
                depth -= 1
            if ch == "," and depth == 0:
                c = line.strip()
                cm = re.match(r'"?([a-z_][a-z0-9_]*)"?\s+', c)
                if cm and cm.group(1).lower() not in (
                    "constraint", "primary", "foreign", "unique", "check", "exclude",
                ):
                    cols.add(cm.group(1).lower())
                line = ""
            else:
                line += ch
        tables[name] = cols

    # Views count as "exists" for our purposes.
    for m in re.finditer(
        r'create (?:or replace )?view (?:"?public"?\.)?"?([a-z_][a-z0-9_]*)"?', sql, re.I
    ):
        tables.setdefault(m.group(1).lower(), set())

    # ALTER TABLE ... ADD COLUMN
    for m in re.finditer(
        r'alter table (?:only )?(?:"?public"?\.)?"?([a-z_][a-z0-9_]*)"?\s+add column (?:if not exists )?"?([a-z_][a-z0-9_]*)"?',
        sql,
        re.I,
    ):
        tables.setdefault(m.group(1).lower(), set()).add(m.group(2).lower())

    rls = set()
    for m in re.finditer(
        r'create policy .*? on (?:"?public"?\.)?"?([a-z_][a-z0-9_]*)"?', sql, re.I | re.S
    ):
        rls.add(m.group(1).lower())

    return tables, rls


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(2)

    dump_path = pathlib.Path(sys.argv[1])
    if not dump_path.exists():
        print(f"error: {dump_path} not found")
        sys.exit(2)
    if not INVENTORY.exists():
        print(f"error: {INVENTORY} not found (run extract_schema.py first)")
        sys.exit(2)

    inventory = json.loads(INVENTORY.read_text())["detail"]
    dump_tables, rls_tables = parse_dump(dump_path.read_text(errors="ignore"))

    code_tables = set(inventory)
    dump_names = set(dump_tables)

    missing = sorted(code_tables - dump_names)
    orphans = sorted(dump_names - code_tables - IGNORE_ORPHANS)

    col_gaps = {}
    rls_gaps = []
    for t in sorted(code_tables & dump_names):
        entry = inventory[t]
        have = dump_tables[t]
        if not have:  # view, or unparsed - skip column check
            continue
        want = {
            c for c in entry["inferred_columns"]
            if c not in NOT_REAL_COLUMNS and c not in have
        }
        if want:
            col_gaps[t] = sorted(want)
        if entry["likely_user_scoped_rls"] and t not in rls_tables:
            rls_gaps.append(t)

    print("=" * 62)
    print("SCHEMA VERIFICATION")
    print("=" * 62)
    print(f"  tables used in code : {len(code_tables)}")
    print(f"  tables in dump      : {len(dump_names)}")
    print()

    if missing:
        print(f"MISSING ({len(missing)}) - code uses these, dump does not define them:")
        for t in missing:
            print(f"    {t}")
        print()
    else:
        print("MISSING: none\n")

    if col_gaps:
        total = sum(len(v) for v in col_gaps.values())
        print(f"COLUMN GAPS ({total} across {len(col_gaps)} tables):")
        for t, cols in col_gaps.items():
            print(f"    {t}: {', '.join(cols)}")
        print()
    else:
        print("COLUMN GAPS: none\n")

    if rls_gaps:
        print(f"RLS GAPS ({len(rls_gaps)}) - user-scoped tables with no policy in dump:")
        for t in rls_gaps:
            print(f"    {t}")
        print("  -> re-dump with policies, or these tables leak across users.")
        print()
    else:
        print("RLS GAPS: none\n")

    if orphans:
        print(f"ORPHANS ({len(orphans)}) - in dump, unused by code (review before dropping):")
        for t in orphans:
            print(f"    {t}")
        print()
    else:
        print("ORPHANS: none\n")

    ok = not missing and not col_gaps
    print("=" * 62)
    print("RESULT:", "PASS" if ok else "FAIL")
    print("=" * 62)
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()

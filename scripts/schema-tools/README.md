# Schema Tools

Tooling for Phase 0 · Step 1 (schema reconciliation). See `/SCHEMA_RECONCILIATION.md`
in the repo root for the full runbook.

## extract_schema.py

Scans every `.ts`/`.tsx` file and infers, per table, which columns the code reads,
writes and filters on. Regenerates `schema-inventory.json`.

```bash
python3 scripts/schema-tools/extract_schema.py
```

Re-run this whenever you add or change database calls, so the verifier stays accurate.

## verify_schema.py

Checks a Supabase schema dump against `schema-inventory.json`.

```bash
python3 scripts/schema-tools/verify_schema.py supabase/baseline_public.sql
```

Reports MISSING tables, COLUMN GAPS, RLS GAPS and ORPHANS. Exits non-zero on
MISSING or COLUMN GAPS, so it can run in CI once the baseline is committed.

### Tuning false positives

Supabase's nested-relation selects (e.g. `select("*, habit_completions(*)")`) look
like columns to the extractor. Known cases are listed in `NOT_REAL_COLUMNS` at the
top of `verify_schema.py` — add to that set if the verifier flags a column that is
actually a relation embed.

## schema-inventory.json

Generated. Per-table detail: inferred columns, which are written vs filtered,
whether the table looks user-scoped (needs RLS), and which files touch it.
Useful on its own for finding every call site before refactoring a table.

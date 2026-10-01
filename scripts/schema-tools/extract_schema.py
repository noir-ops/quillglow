"""
Extract the schema the CODE expects, table by table.

Scans every .ts/.tsx file for Supabase calls and infers, per table:
  - columns read      (.select("a, b"), .eq("col", ...), .order("col"))
  - columns written   (.insert({...}), .update({...}), .upsert({...}))
  - which files touch it

This does not replace a live `supabase db dump`. It gives you the checklist to
verify the dump against, so you can prove no table or column was missed.
"""
import json
import pathlib
import re
from collections import defaultdict

ROOT = pathlib.Path(__file__).resolve().parents[2]
MIGRATION_DIR = ROOT / "scripts"

# Tables already reproducible from scripts/*.sql
covered = set()
for sql in MIGRATION_DIR.glob("*.sql"):
    for m in re.finditer(
        r"create table (?:if not exists )?(?:public\.)?([a-z_]+)", sql.read_text(), re.I
    ):
        covered.add(m.group(1).lower())

tables = defaultdict(
    lambda: {"read": set(), "written": set(), "filtered": set(), "files": set(), "rls_hint": set()}
)

FILTER_METHODS = ("eq", "neq", "gt", "gte", "lt", "lte", "like", "ilike", "in", "contains", "order")


def scan(path: pathlib.Path):
    src = path.read_text(errors="ignore")
    rel = str(path.relative_to(ROOT))

    for m in re.finditer(r'\.from\("([a-z_]+)"\)', src):
        table = m.group(1)
        entry = tables[table]
        entry["files"].add(rel)

        # Look at the chained calls that follow this .from()
        window = src[m.end() : m.end() + 1200]
        # Stop at the next .from() so chains don't bleed together
        nxt = window.find('.from("')
        if nxt != -1:
            window = window[:nxt]

        # .select("col_a, col_b, relation(...)")
        for sel in re.finditer(r'\.select\(\s*"([^"]*)"', window):
            raw = sel.group(1)
            if "*" in raw:
                entry["read"].add("*")
            # strip nested relation blocks before splitting
            flat = re.sub(r"\([^)]*\)", "", raw)
            for col in flat.split(","):
                col = col.strip().split(":")[0].strip()
                if col and col != "*" and re.fullmatch(r"[a-z_][a-z0-9_]*", col):
                    entry["read"].add(col)

        # filters / ordering imply indexed-ish columns
        for meth in FILTER_METHODS:
            for f in re.finditer(rf'\.{meth}\(\s*"([a-z_][a-z0-9_]*)"', window):
                entry["filtered"].add(f.group(1))
                if f.group(1) == "user_id":
                    entry["rls_hint"].add("user_id")

        # .insert({...}) / .update({...}) / .upsert({...})
        for w in re.finditer(r"\.(insert|update|upsert)\(\s*\{", window):
            start = window.index("{", w.end() - 1)
            depth, i = 0, start
            while i < len(window):
                if window[i] == "{":
                    depth += 1
                elif window[i] == "}":
                    depth -= 1
                    if depth == 0:
                        break
                i += 1
            block = window[start : i + 1]
            # top-level keys only
            for k in re.finditer(r"[{,]\s*([a-z_][a-z0-9_]*)\s*:", block):
                entry["written"].add(k.group(1))


for p in ROOT.rglob("*.ts"):
    if "node_modules" not in str(p):
        scan(p)
for p in ROOT.rglob("*.tsx"):
    if "node_modules" not in str(p):
        scan(p)

# ── Report ──────────────────────────────────────────────────────────────────
missing = sorted(t for t in tables if t not in covered)
present = sorted(t for t in tables if t in covered)

report = {
    "summary": {
        "tables_used_in_code": len(tables),
        "tables_with_migrations": len(present),
        "tables_MISSING_migrations": len(missing),
    },
    "missing_migrations": missing,
    "has_migrations": present,
    "detail": {},
}

for t in sorted(tables):
    e = tables[t]
    cols = sorted((e["read"] | e["written"] | e["filtered"]) - {"*"})
    report["detail"][t] = {
        "has_migration": t in covered,
        "inferred_columns": cols,
        "written_columns": sorted(e["written"]),
        "filtered_columns": sorted(e["filtered"]),
        "select_star_used": "*" in e["read"],
        "likely_user_scoped_rls": "user_id" in e["rls_hint"],
        "touched_by": sorted(e["files"]),
    }

out = pathlib.Path(__file__).parent / "schema-inventory.json"
out.write_text(json.dumps(report, indent=2))

print(f"Tables used in code:        {len(tables)}")
print(f"Covered by migrations:      {len(present)}")
print(f"MISSING migrations:         {len(missing)}")
print()
print("Missing:")
for t in missing:
    d = report["detail"][t]
    flag = " [user-scoped]" if d["likely_user_scoped_rls"] else ""
    print(f"  {t:32s} {len(d['inferred_columns']):3d} cols{flag}")

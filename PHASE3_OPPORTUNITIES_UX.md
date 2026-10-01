# Phase 3 · Opportunities + Outcome-Based UX

**Status:** Code complete, 20/20 assertions passing. Depends on unexecuted migrations.

---

## 1. Opportunities engine — `scripts/019_opportunities.sql`

Scholarships, competitions and grants, matched **against the Learning Graph**.
That's the whole point of building it on top rather than beside: a student who
improves in Physics immediately surfaces STEM scholarships, with no duplicate
eligibility logic anywhere.

### Hard filters vs soft ranking

**Hard filters exclude outright** — country, age, education level, gender,
syllabus, deadline, and a minimum Exam Readiness™ gate. Showing a student a
scholarship they cannot legally enter is worse than showing nothing.

**Soft signals only rank** — demonstrated subject mastery, overall readiness,
specificity of fit, deadline urgency, award size.

**Verified:** a 17-year-old Nigerian student on WAEC correctly sees their own
country's grants and global opportunities, and correctly does *not* see US-only,
expired, 21+, or high-readiness-gated ones. Once their Exam Readiness reaches 85,
the gated $20k opportunity unlocks automatically.

### Two new Intelligence Scores

- **Scholarship Readiness™** — 35% profile completeness, 35% academic readiness,
  15% eligible count, 15% application activity. Profile completeness is weighted
  heavily because an empty profile is the single biggest blocker to matching.
- **Opportunity Score™** — quality of the current pipeline: best match, breadth,
  and how many close soon.

Both store an explainable `breakdown`, same as the Phase 1 scores.

### A bug worth recording

The first implementation used `IF v_p IS NOT NULL` to check whether a student
profile existed. In plpgsql that expression is only true when **every field** of
the record is non-null — so a fully complete profile with one empty optional
column scored `profile_completeness = 0.0`.

That would have silently halved every student's Scholarship Readiness in
production, with no error anywhere. Caught by the test suite, fixed to use
`FOUND`.

---

## 2. Outcome-based UX — additive, nothing existing touched

You asked early on not to touch QuillGlow's frontend. Phase 3 is frontend by
definition, so it's built as a **separate route group** (`app/(outcomes)/`) with
**zero edits to any of the 56 existing pages**. The legacy tool-based navigation
keeps working exactly as it does today.

That means this can be trialled with a subset of users, or behind a flag, before
anything is switched over — and reverted by deleting a folder.

| Route | Content |
|---|---|
| `/learn` | Sprout chat |
| `/prepare` | Intelligence Scores |
| `/opportunities` | Matched scholarships |
| `/grow` | Progress over time |

### Components — `components/sprout/`

- `outcome-nav.tsx` — Learn / Prepare / Opportunities / Grow
- `sprout-chat.tsx` — Sprout conversation, renders RAG source badges, handles the
  429 quota response as an upgrade prompt rather than an error
- `intelligence-scores.tsx` — scores with their breakdowns visible, so a number is
  explainable rather than a black box. Empty state says *why* it's empty instead
  of showing zeros that look like failure.
- `opportunity-list.tsx` — ranked matches with the reasons shown

---

## API surface

| Endpoint | Purpose |
|---|---|
| `GET /api/opportunities/match` | Ranked, eligibility-filtered matches |
| `GET·POST /api/opportunities/profile` | Matching profile |
| `GET·POST /api/opportunities/applications` | Application tracking |

---

## Test

```bash
python3 scripts/schema-tools/test_opp.py    # 20 assertions
```

Full suite is now **82 assertions** across five files.

---

## Deliberately deferred

**Marketplace and Wallet.** Cut in the original plan and still cut. They're the
least differentiated pieces and the most self-contained, which makes them the
safest things to defer. Shipping Learn / Prepare / Opportunities properly beats
shipping four workflows badly.

**Growth™ and Consistency™ scores.** They need months of longitudinal data to
mean anything. Building them now would produce numbers that move randomly.

**Mentor / parent / benefactor portals.** These need a role system that doesn't
exist yet. Adding roles late is painful, but adding them speculatively before
there's a real second user type is worse.

---

## What this still depends on

Everything here is code-complete and unit-verified, and **none of it runs yet**:

1. Schema baseline — still not dumped
2. Migrations 015–019 — never executed against a real database
3. No syllabus seeded — matching works, but subject-strength ranking stays at
   zero until concepts exist
4. Opportunities table is empty — the engine works, there's nothing in it

The engine is real. The content isn't there yet.

---

# Post-Phase-3 fixes

## Sprout chat history

Previously each page load started blank — nothing persisted. Now:

- **`scripts/020_sprout_chat_sessions.sql`** — one row per conversation
  (`sprout_chat_sessions`), holding a `messages` jsonb array, title, and
  timestamps. Deliberately a separate table from `tutor_sessions` (which keeps
  one row per user+subject with a single running thread) — Sprout needs
  multiple named, browsable conversations per user, closer to a ChatGPT-style
  history list.
- **`lib/services/sprout-sessions.ts`** — list / get / create / append / delete.
  Auto-titles a conversation from its first message.
- **`/api/sprout/sessions`, `/api/sprout/sessions/[id]`** — history list, full
  session fetch, delete.
- **`/api/sprout/chat`** now loads history server-side from the session rather
  than trusting client-resent history, and persists every exchange after
  generating a reply. A save failure never costs the student their answer — it
  logs and moves on rather than blocking the response.
- **`SproutChat` component** — added a history sidebar (desktop only; hidden
  below `sm` to keep mobile usable), auto-opens the most recent conversation on
  load, "New chat" button, per-conversation delete.

## Sidebar alphabetized A–Z

`navItems` (desktop sidebar) and `mobileMoreNav` (mobile "More" overflow list)
are now sorted alphabetically by label, case-insensitive.

**Left untouched, deliberately:** `mobileMainNav` — the 4-icon mobile bottom tab
bar. Reordering "Home" out of first position there breaks a near-universal
mobile app convention, and a 4-item row doesn't really function as a
browsable "sidebar" the way the other two lists do. Flag if you'd rather it be
sorted too.

One side effect worth knowing: Dashboard is no longer pinned first in the
desktop sidebar — a literal A–Z sort puts it wherever "Dashboard" falls
alphabetically (currently 3rd, after Audio and Browse). Say so if you'd rather
pin Dashboard at the top and alphabetize everything below it instead.

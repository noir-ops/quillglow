# Phase 1 · Student Learning Graph

**Status:** ✅ Foundation shipped and instrumented. Curriculum seeding is the remaining work (non-engineering).

---

## Why this first

The proposal scheduled the Assessor and Curriculum agents (Sprint 3) *before* the
Student Memory Graph (Sprint 5). Both agents are stateful by definition — an
Assessor with nothing to read from and nothing to write to is just a chat prompt.

So the graph lands first, and **existing features are instrumented now**. Evidence
accumulates from live traffic starting today, which means when the agents are
built in Phase 2 they have real history instead of cold-starting.

---

## The core design decision: append-only evidence

`learning_events` is **append-only and is the single source of truth.**
`student_concept_mastery` and `intelligence_scores` are **derived and disposable.**

You will change the mastery algorithm several times. With a replayable log you
run `rebuild_mastery()` and recompute. Without it, every algorithm change
silently corrupts historical scores and you can never explain to a parent why a
score moved.

**Verified:** replay reproduces live state exactly, and does not duplicate the
event log.

---

## Schema — `scripts/016_learning_graph.sql`

| Table | Role |
|---|---|
| `learning_concepts` | Curriculum tree: syllabus → subject → topic → concept, with prerequisites and difficulty |
| `learning_events` | **Append-only** evidence log |
| `student_concept_mastery` | Derived: mastery, confidence, state, spaced-repetition schedule |
| `intelligence_scores` | Cached scores with an explainable `breakdown` |

### Functions

- `record_learning_event(...)` — appends evidence + updates mastery in one transaction
- `apply_mastery_from_event(...)` — pure derived-state update, shared by recorder and rebuilder
- `rebuild_mastery(user?)` — replays the log; run after any algorithm change
- `compute_exam_readiness(user, syllabus?, subject?)` — Exam Readiness™
- `compute_learning_risk(user)` — Learning Risk™

Writes go through `SECURITY DEFINER` functions only. Clients have SELECT policies
on their own rows and no write policies at all, so the log can't be edited.

---

## Mastery model

**EWMA with a confidence gate.**

- New evidence is weighted at `alpha = 0.3`, so recent performance matters more
  but one bad day doesn't erase established mastery. *Verified: a single wrong
  answer takes mastery 1.000 → 0.700, not → 0.*
- **Confidence must exceed 0.4 before any concept can read as `mastered`.** One
  lucky answer stays `learning`. This is the guard against a student appearing
  exam-ready off three questions.
- States: `unseen → learning → weak | review | mastered`
- Spaced repetition follows state: weak = 2d, review = 7d, mastered = 21d.

**Exam Readiness™** is weighted by concept difficulty *and* confidence, then
scaled by syllabus coverage. Mastering 5 topics out of 200 is not readiness — the
coverage term is what stops the score being misleadingly high early on.

**Learning Risk™** = 45% weak-concept share + 35% recent inaccuracy + 20%
inactivity, with a stored `breakdown` so you can always explain the number.

---

## `rawTopic`: how evidence accumulates before the curriculum exists

`concept_id` is nullable. Features pass `rawTopic` (free text) until the syllabus
is seeded, and events are backfilled to concepts later.

This is deliberate: **it decouples engineering from curriculum work.** Syllabus
structuring is slow, manual, expert labour and is the long pole of the project.
Waiting for it would mean months of lost evidence.

---

## Instrumented features

| Feature | Event | Signal |
|---|---|---|
| `mock-exam` (PUT) | `quiz_answer` **per question** + `exam_attempt` | Graded — strongest signal |
| `essay` | `essay_submitted` | Graded 0–100 |
| `quests/submit` | `quest_completed` | Graded 0–100 |
| `tutor/chat` | `tutor_exchange` | Engagement |
| `generate-flashcards` | `flashcard_review` | Exposure |

Mock exam emits **one event per question** with the question's topic, so evidence
is concept-level rather than a single blurred exam score.

All emission is **fire-and-forget** — a logging failure can never break the
feature that produced it, and adds no latency.

---

## Read APIs

| Endpoint | Returns |
|---|---|
| `GET /api/learning-graph/scores` | Intelligence Scores with breakdowns |
| `GET /api/learning-graph/mastery` | Full mastery map |
| `GET /api/learning-graph/mastery?view=weak` | Weakest concepts — what to study next |
| `GET /api/learning-graph/mastery?view=due` | Concepts due for spaced review |

Nothing in the UI consumes these yet — that's deliberate. Phase 3 builds the
outcome-based dashboard against finished services.

---

## Verification

`scripts/schema-tools/test_graph.py` — 19 assertions against real Postgres, all
passing. Covers: confidence gating, EWMA smoothing, weak detection, score
normalisation, exposure-vs-assessment separation, unmapped events, coverage
penalty, spaced-repetition ordering, append-only policy, and deterministic replay.

```bash
pip install pgserver psycopg2-binary
python3 scripts/schema-tools/test_graph.py
```

---

## Apply

```bash
psql "$STAGING_DB_URL" -f scripts/016_learning_graph.sql
```

> Run **after** the schema baseline (Step 1) and the quota migration (Step 3).

---

## Next: seed one syllabus

The graph is inert until `learning_concepts` has real curriculum in it.

**Pick one syllabus** — WAEC or JAMB, whichever your first market uses — and
structure it: subject → topic → concept, with prerequisites and difficulty.
One complete syllabus beats five partial ones.

Start this in parallel now; it is the long pole and it isn't engineering work.
Until it lands, events keep accumulating with `rawTopic` and can be backfilled.

**Backfill path once seeded:** map distinct `raw_topic` values to `concept_id`,
`UPDATE learning_events` accordingly, then run `rebuild_mastery()`. Every event
collected in the meantime becomes usable retroactively.

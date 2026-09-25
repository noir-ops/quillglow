# Navigation Consolidation — §29

Client instruction: *"No need to remove any features this phase. Just first to
consolidate into primary buttons recommended."*

Nothing was removed. Every previously-reachable destination now sits under one of
the primary navigation groups.

## Final structure

| Group | Items |
|---|---|
| **Home** | Today, Analytics, Leaderboard, Grow |
| **Learn** | Study with Sprout, Browse, Notes, Flashcards, Mind Maps, Revision, WriteReal, Audio, Study Together |
| **Prepare** | Exam Readiness, Practice Exams, Study Planner, Study Agent, Focus Timer, Stress Relief |
| **Opportunities** | Scholarships |
| **Store** | Store, Ambassador |
| **AI** | Study AI, Sprout AI, EchoMind |
| **Account** | Profile, Subscription, Settings |

## Consolidation decisions

**Focus Timer (Pomodoro) + Stress Relief → Prepare**
Per client: *"to be part of study planner instead of stand alone features."*
Both are session-support tools for planned study, so they sit beside Study
Planner rather than competing with it for top-level attention.

**EchoMind → AI**
Per client: *"remains but possibly need to consolidate into one of the AIs. It's
good feature but do not want redundant features."* It now appears as an AI
capability alongside Study AI and Sprout AI, rather than as a separate product.

> **Open item.** This is placement, not true consolidation. Genuinely merging
> EchoMind's reflection capability *into* Study AI or Sprout AI — so there is one
> assistant rather than three entries under "AI" — is a follow-up that needs a
> product decision on which agent absorbs it.

**Study Together → Learn**
Spec §31 says *defer*, not remove. It stays reachable, still gated behind the
existing `studyTogetherEnabled` flag.

## Prepare vs Grow

Previously identical. Now:

- **Prepare** — the exams and testing hub. Leads with actions (practice exams,
  planner, study agent, timer, stress relief); readiness scores are supporting
  context.
- **Grow** — retrospective analytics. All Intelligence Scores plus topic-by-topic
  mastery progress over time.

Each cross-links to the other so the distinction is discoverable rather than
something a student has to infer.

## Collapsed sidebar

The collapsed rail shows **one icon per group**, not per feature — otherwise it
would be as long as the flat menu it replaced.

## Verification

A script diffs the original flat destination list against the new grouped
structure. Current result: **0 orphaned routes** — every destination that was
reachable before is reachable now.

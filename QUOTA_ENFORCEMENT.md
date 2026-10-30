# AI quota enforcement

Current setup: [PHASE1_PLAN_LIMITS_SETUP.md](PHASE1_PLAN_LIMITS_SETUP.md).
Apply Phase 0 before Phase 1. Older 015/066 files are historical bootstrap SQL;
do not rerun them over Phase 0/1.

Monthly allowances live in `public.plan_limits`: 0 means not included, -1 means
unlimited, and positive integers are calendar-month caps (UTC). Flashcards count
cards; EchoMind counts verified session starts; StudyPilot counts full systems;
WriteReal counts requests separately for each mode.

`consume_ai_quota_v2` resolves the canonical effective plan, locks the month's
usage row, checks feature and optional combined caps, increments once, and reports
the actual limiting pool. The legacy consume RPC delegates to it during rollout.
`get_ai_quota_status` reads the same allowances, month and counters. Service-only
refunds restore at most the amount actually used by that feature.

The quota service authenticates and enforces before model calls. RPC/database
errors fail closed with 503; exhausted allowances return 429 with the actual
limit, plan, pool and reset date. Failed generations are refunded.

WriteReal, EchoMind, StudyPilot and the other existing gated AI tools use this
service. Settings, public pricing and tool meters read live values. Admin edits
are role-checked, validated, protected against stale writes and audited atomically.
Manual non-AI product constraints and public support chat are outside monthly AI
entitlements. Direct learner edits to limits and counters remain blocked.

Tests: `test-plan-limits.cjs`, `test-revenue-routes.cjs`, and
`test-revenue-integrity.cjs` under scripts. The setup guide explains dependencies.

/**
 * Study coach — the link between EchoMind and the Study Planner.
 *
 * One snapshot of where a learner stands, built from what they have ACTUALLY
 * done and planned (never invented):
 *   - their study plans and planner goals (done / overdue / upcoming)
 *   - weekly review checkpoints and their test scores
 *   - syllabus coverage per selected subject — which curriculum topics are
 *     strong, need work, covered (reinforce), planned, or not started
 *   - the latest weekly-review feedback that hasn't been acted on yet
 *
 * Used by: EchoMind's prompts (so every review is grounded in syllabus +
 * planner memory), EchoMind's Study Coach panel, the Weekly Review & Test
 * mode, and the coach card on the Study Planner page.
 */
import { getSelectedSubjects } from "@/lib/services/syllabus"

// ── Types ───────────────────────────────────────────────────────────────────

export type TopicStatus = "strong" | "needs_work" | "covered" | "planned" | "not_started"

export interface CoachGoal {
  goalId: string
  taskId: string | null
  planId: string
  planTitle: string
  subject: string | null
  title: string
  description: string | null
  dueDate: string | null
  completed: boolean
}

export interface CoachReview {
  goalId: string
  taskId: string | null
  planId: string
  planTitle: string
  subject: string | null
  title: string
  dueDate: string | null
  weekNumber: number
  status: "done" | "overdue" | "due" | "upcoming"
  score: number | null
}

export interface CoachPlan {
  id: string
  title: string
  subject: string | null
  startDate: string
  endDate: string
  done: number
  total: number
  active: boolean
}

export interface CoverageTopic {
  id: string
  name: string
  status: TopicStatus
}

export interface CoverageSubject {
  syllabus: string
  subject: string
  topics: CoverageTopic[]
  counts: Record<TopicStatus, number>
}

export interface CoachSuggestion {
  topic: string
  reason?: string
  action?: string
}

export interface CoachFeedback {
  id: string
  planId: string
  planTitle: string
  subject: string | null
  weekNumber: number
  completedCount: number
  totalCount: number
  score: number | null
  suggestions: CoachSuggestion[]
  createdAt: string
}

export interface CoachSnapshot {
  today: string
  plans: CoachPlan[]
  thisWeek: { done: number; total: number }
  overdue: CoachGoal[]
  upcoming: CoachGoal[]
  recentlyCompleted: CoachGoal[]
  reviews: CoachReview[]
  coverage: CoverageSubject[]
  feedback: CoachFeedback[]
  hasSyllabus: boolean
}

// ── Helpers ─────────────────────────────────────────────────────────────────

const DAY_MS = 86_400_000
export const isoDay = (d: Date) => d.toISOString().slice(0, 10)
export const addDays = (day: string, n: number) => isoDay(new Date(new Date(day + "T00:00:00Z").getTime() + n * DAY_MS))

const STOP = new Set([
  "and", "the", "of", "in", "to", "a", "an", "for", "with", "on", "its", "their", "introduction",
  "basic", "basics", "revision", "review", "week", "practice", "exam", "topics", "topic", "part", "unit",
])

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim()
const tokens = (s: string) =>
  norm(s)
    .split(" ")
    .filter((t) => t.length > 2 && !STOP.has(t))
    .map((t) => t.replace(/s$/, ""))

/**
 * Does a planner goal title refer to a curriculum topic? Conservative on
 * purpose: containment either way, or at least 60% of the topic's meaningful
 * words appearing in the goal title. Only the title is used — goal
 * descriptions list many subtopics and would over-match.
 */
export function matchesTopic(goalTitle: string, topicName: string): boolean {
  const a = norm(goalTitle)
  const b = norm(topicName)
  if (!a || !b) return false
  if (a.includes(b) || b.includes(a)) return true
  const tt = tokens(topicName)
  if (tt.length === 0) return false
  const gt = new Set(tokens(goalTitle))
  return tt.filter((t) => gt.has(t)).length / tt.length >= 0.6
}

const sameSubject = (planSubject: string | null, subject: string) => {
  if (!planSubject) return true
  const a = norm(planSubject)
  const b = norm(subject)
  return a.includes(b) || b.includes(a)
}

const weekNumberOf = (startDate: string | null, due: string | null) => {
  if (!startDate || !due) return 1
  const day = (v: string) => new Date(String(v).slice(0, 10) + "T00:00:00Z").getTime()
  const diff = (day(due) - day(startDate)) / DAY_MS
  return Math.max(1, Math.floor(diff / 7) + 1)
}

/**
 * A plan still counts as "active" until a week after it ends. Only active
 * plans feed overdue / upcoming / this-week and Catch me up. Unfinished
 * sessions from plans that ended long ago are history, not a to-do list —
 * counting them showed e.g. "22 sessions overdue" made up of a finished
 * Chemistry plan's topics under an Economics coach, and Catch me up would
 * have dumped all of them onto the learner's calendar.
 */
export const ACTIVE_PLAN_GRACE_DAYS = 7
export const isPlanActive = (endDate: string | null | undefined, today: string) =>
  !!endDate && String(endDate).slice(0, 10) >= addDays(today, -ACTIVE_PLAN_GRACE_DAYS)

/** Monday of the week containing `day` (UTC). */
const mondayOf = (day: string) => {
  const d = new Date(day + "T00:00:00Z")
  const dow = (d.getUTCDay() + 6) % 7 // Mon=0 … Sun=6
  return addDays(day, -dow)
}

// ── Snapshot ────────────────────────────────────────────────────────────────

export async function getStudyCoachSnapshot(supabase: any, userId: string): Promise<CoachSnapshot> {
  const today = isoDay(new Date())

  const { data: planRows } = await supabase
    .from("study_plans")
    .select("id, title, subject, start_date, end_date")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(10)
  const plans: any[] = planRows ?? []
  const planIds = plans.map((p) => p.id)
  const planById = new Map(plans.map((p) => [p.id, p]))

  const [goalsRes, tasksRes, feedbackRes, selected, masteryRes] = await Promise.all([
    planIds.length
      ? supabase
          .from("study_plan_goals")
          .select("id, plan_id, title, description, due_date, completed, completed_at, is_review")
          .in("plan_id", planIds)
          .order("due_date", { ascending: true })
      : Promise.resolve({ data: [] }),
    // Mirrored planner tasks, found by plan (a few ids) rather than by goal
    // (could be hundreds of ids — too long for a request URL).
    planIds.length
      ? supabase.from("tasks").select("id, plan_goal_id").eq("user_id", userId).in("plan_id", planIds)
      : Promise.resolve({ data: [] }),
    supabase
      .from("study_plan_review_feedback")
      .select("id, plan_id, review_task_id, week_number, completed_count, total_count, suggestions, applied, score_percentage, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(50),
    getSelectedSubjects(userId).catch(() => [] as { syllabus: string; subject: string }[]),
    supabase
      .from("student_concept_mastery")
      .select("state, learning_concepts!inner(parent_id)")
      .eq("user_id", userId)
      .neq("state", "unseen")
      .limit(5000),
  ])

  const goals: any[] = goalsRes.data ?? []
  const taskByGoal = new Map<string, string>()
  for (const t of tasksRes.data ?? []) if (t.plan_goal_id) taskByGoal.set(t.plan_goal_id, t.id)
  const feedbackRows: any[] = feedbackRes.data ?? []

  const toGoal = (g: any): CoachGoal => ({
    goalId: g.id,
    taskId: taskByGoal.get(g.id) ?? null,
    planId: g.plan_id,
    planTitle: planById.get(g.plan_id)?.title ?? "Study plan",
    subject: planById.get(g.plan_id)?.subject ?? null,
    title: g.title,
    description: g.description ?? null,
    dueDate: g.due_date ?? null,
    completed: !!g.completed,
  })

  const study = goals.filter((g) => !g.is_review)
  const reviewGoals = goals.filter((g) => g.is_review)

  // Plans
  const coachPlans: CoachPlan[] = plans.map((p) => {
    const mine = study.filter((g) => g.plan_id === p.id)
    return {
      id: p.id,
      title: p.title,
      subject: p.subject ?? null,
      startDate: p.start_date,
      endDate: p.end_date,
      done: mine.filter((g) => g.completed).length,
      total: mine.length,
      active: isPlanActive(p.end_date, today),
    }
  })

  // This week (Mon–Sun)
  const weekStart = mondayOf(today)
  const weekEnd = addDays(weekStart, 6)
  const activeIds = new Set(plans.filter((p) => isPlanActive(p.end_date, today)).map((p) => p.id))
  const current = study.filter((g) => activeIds.has(g.plan_id))
  const inWeek = current.filter((g) => g.due_date && g.due_date >= weekStart && g.due_date <= weekEnd)

  const overdue = current.filter((g) => !g.completed && g.due_date && g.due_date < today).map(toGoal)
  const upcoming = current
    .filter((g) => !g.completed && g.due_date && g.due_date >= today && g.due_date <= addDays(today, 7))
    .map(toGoal)
  const recentlyCompleted = study
    .filter((g) => g.completed && g.completed_at && g.completed_at.slice(0, 10) >= addDays(today, -14))
    .sort((a, b) => String(b.completed_at).localeCompare(String(a.completed_at)))
    .map(toGoal)

  // Weekly reviews (+ the score from the test, if taken)
  // Unfinished reviews from ended plans are left out (nothing to act on);
  // completed ones stay, so past weekly scores remain visible.
  const reviews: CoachReview[] = reviewGoals.filter((g) => g.completed || activeIds.has(g.plan_id)).map((g) => {
    const plan = planById.get(g.plan_id)
    const weekNumber = weekNumberOf(plan?.start_date ?? null, g.due_date ?? null)
    const taskId = taskByGoal.get(g.id) ?? null
    const fb = feedbackRows.find(
      (f) => (taskId && f.review_task_id === taskId) || (f.plan_id === g.plan_id && f.week_number === weekNumber),
    )
    let status: CoachReview["status"] = "upcoming"
    if (g.completed) status = "done"
    else if (g.due_date && g.due_date < today) status = "overdue"
    else if (g.due_date && g.due_date <= addDays(today, 6)) status = "due"
    return {
      goalId: g.id,
      taskId,
      planId: g.plan_id,
      planTitle: plan?.title ?? "Study plan",
      subject: plan?.subject ?? null,
      title: g.title,
      dueDate: g.due_date ?? null,
      weekNumber,
      status,
      score: fb?.score_percentage != null ? Number(fb.score_percentage) : null,
    }
  })

  // Syllabus coverage
  const topicState = new Map<string, Set<string>>() // topic id -> child concept states
  for (const row of masteryRes.data ?? []) {
    const lc = Array.isArray(row.learning_concepts) ? row.learning_concepts[0] : row.learning_concepts
    const parent = lc?.parent_id
    if (!parent) continue
    if (!topicState.has(parent)) topicState.set(parent, new Set())
    topicState.get(parent)!.add(row.state)
  }

  const subjects = (selected ?? []).slice(0, 8)
  const topicLists = await Promise.all(
    subjects.map((s) =>
      supabase
        .from("learning_concepts")
        .select("id, name")
        .eq("syllabus", s.syllabus)
        .eq("subject", s.subject)
        .eq("depth", 1)
        .order("name")
        .then((r: any) => r.data ?? []),
    ),
  )

  const coverage: CoverageSubject[] = subjects.map((s, i) => {
    const subjectGoals = study.filter((g) => sameSubject(planById.get(g.plan_id)?.subject ?? null, s.subject))
    const topics: CoverageTopic[] = (topicLists[i] as any[]).map((t) => {
      const states = topicState.get(t.id) ?? new Set<string>()
      const matching = subjectGoals.filter((g) => matchesTopic(g.title, t.name))
      let status: TopicStatus = "not_started"
      if (states.has("weak")) status = "needs_work"
      else if (states.has("mastered") || states.has("review")) status = "strong"
      else if (matching.some((g) => g.completed) || states.has("learning")) status = "covered"
      else if (matching.length > 0) status = "planned"
      return { id: t.id, name: t.name, status }
    })
    const counts: Record<TopicStatus, number> = { strong: 0, needs_work: 0, covered: 0, planned: 0, not_started: 0 }
    for (const t of topics) counts[t.status]++
    return { syllabus: s.syllabus, subject: s.subject, topics, counts }
  })

  // Weekly-review feedback not acted on yet
  const feedback: CoachFeedback[] = feedbackRows
    .filter((f) => !f.applied && Array.isArray(f.suggestions) && f.suggestions.length > 0)
    .slice(0, 3)
    .map((f) => ({
      id: f.id,
      planId: f.plan_id,
      planTitle: planById.get(f.plan_id)?.title ?? "Study plan",
      subject: planById.get(f.plan_id)?.subject ?? null,
      weekNumber: f.week_number,
      completedCount: f.completed_count,
      totalCount: f.total_count,
      score: f.score_percentage != null ? Number(f.score_percentage) : null,
      suggestions: (f.suggestions as any[])
        .filter((x) => x && typeof x.topic === "string" && x.topic.trim())
        .map((x) => ({ topic: String(x.topic), reason: x.reason ? String(x.reason) : undefined, action: x.action ? String(x.action) : undefined })),
      createdAt: f.created_at,
    }))

  return {
    today,
    plans: coachPlans,
    thisWeek: { done: inWeek.filter((g) => g.completed).length, total: inWeek.length },
    overdue,
    upcoming,
    recentlyCompleted,
    reviews,
    coverage,
    feedback,
    hasSyllabus: subjects.length > 0,
  }
}

// ── Prompt context ──────────────────────────────────────────────────────────

const shortDate = (d: string | null) =>
  d ? new Date(d + "T00:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }) : "no date"

const list = (items: string[], max: number) =>
  items.length === 0 ? "" : items.slice(0, max).join("; ") + (items.length > max ? `; +${items.length - max} more` : "")

/**
 * The learner's planner + coverage as a compact prompt block, so EchoMind's
 * reviews are grounded in what they've actually covered, what's next and
 * what's overdue. Returns null when there is nothing to say.
 */
export function describeStudyPlanForPrompt(s: CoachSnapshot, focusTopic?: string): string | null {
  const lines: string[] = []
  const active = s.plans.filter((p) => p.active)

  if (active.length > 0) {
    lines.push(
      "Study plans: " +
        active
          .slice(0, 4)
          .map((p) => `"${p.title}"${p.subject ? ` (${p.subject})` : ""} — ${p.done}/${p.total} sessions done`)
          .join("; "),
    )
    if (s.thisWeek.total > 0) lines.push(`This week: ${s.thisWeek.done}/${s.thisWeek.total} planned sessions done.`)
    if (s.overdue.length) lines.push(`Overdue: ${list(s.overdue.map((g) => `${g.title} (due ${shortDate(g.dueDate)})`), 6)}.`)
    if (s.upcoming.length) lines.push(`Next up: ${list(s.upcoming.map((g) => `${g.title} (${shortDate(g.dueDate)})`), 6)}.`)
    if (s.recentlyCompleted.length) lines.push(`Recently completed: ${list(s.recentlyCompleted.map((g) => g.title), 6)}.`)
    const pendingReviews = s.reviews.filter((r) => r.status === "due" || r.status === "overdue")
    if (pendingReviews.length)
      lines.push(`Weekly reviews waiting: ${list(pendingReviews.map((r) => `Week ${r.weekNumber} of "${r.planTitle}" (${r.status})`), 3)}.`)
    const scored = s.reviews.filter((r) => r.score != null)
    if (scored.length) lines.push(`Weekly review scores: ${list(scored.map((r) => `Week ${r.weekNumber} ${Math.round(r.score!)}%`), 4)}.`)
  } else {
    lines.push("The learner has no active study plan yet.")
  }

  for (const c of s.coverage) {
    const by = (st: TopicStatus) => c.topics.filter((t) => t.status === st).map((t) => t.name)
    const parts = [
      `${c.subject} (${c.syllabus}): ${c.counts.strong} strong, ${c.counts.covered} covered (reinforce), ${c.counts.needs_work} need work, ${c.counts.planned} planned, ${c.counts.not_started} not started`,
    ]
    if (by("needs_work").length) parts.push(`  Needs work: ${list(by("needs_work"), 6)}`)
    if (by("covered").length) parts.push(`  Covered, reinforce: ${list(by("covered"), 6)}`)
    if (by("not_started").length) parts.push(`  Not started yet: ${list(by("not_started"), 8)}`)
    lines.push(parts.join("\n"))
  }

  const fb = s.feedback[0]
  if (fb) {
    lines.push(
      `Latest weekly review (Week ${fb.weekNumber}, ${fb.completedCount}/${fb.totalCount} done${fb.score != null ? `, test ${Math.round(fb.score)}%` : ""}) suggested: ${list(
        fb.suggestions.map((x) => `${x.topic}${x.action ? ` (${x.action})` : ""}`),
        5,
      )}.`,
    )
  }

  if (lines.length === 0) return null

  const focus = focusTopic
    ? `\nWhen the topic "${focusTopic}" relates to the plan or coverage above, say so plainly — e.g. that it's overdue, coming up, already covered (so reinforce it), or not started yet.`
    : ""

  return `STUDY PLANNER & SYLLABUS PROGRESS (real data from the learner's Study Planner — use it, never invent plan items):
${lines.join("\n")}

COACHING RULES:
- Tie your review to this progress: reinforce what they've covered, flag what's overdue, and point to what's next.
- Encourage genuinely and specifically (name what they've done). Never guilt-trip about overdue work — offer a small next step instead.
- If a gap is obvious (not started, needs work), end by suggesting one concrete planner action.${focus}`
}

// ── Weekly review feedback ──────────────────────────────────────────────────

/**
 * Looks at the week a review covers (the 7 days ending on the review's due
 * date), asks the model what to reinforce next based on what was and wasn't
 * finished — and the test score, when a test was taken — and stores the
 * proposal. Never rewrites the plan itself; the learner applies suggestions.
 *
 * Shared by the planner checkbox path (PATCH /api/tasks/[id]) and EchoMind's
 * Weekly Review & Test (POST /api/echomind/weekly-review/complete).
 */
export async function generateWeeklyReviewFeedback({
  supabase,
  userId,
  planId,
  reviewTaskId,
  reviewDueDate,
  scorePercentage = null,
  attemptId = null,
}: {
  supabase: any
  userId: string
  planId: string
  reviewTaskId: string | null
  reviewDueDate: string | null
  scorePercentage?: number | null
  attemptId?: string | null
}) {
  const { data: plan } = await supabase.from("study_plans").select("subject, start_date").eq("id", planId).maybeSingle()

  // Callers pass either a DATE ("2026-09-20", from study_plan_goals) or a
  // TIMESTAMPTZ ("2026-09-20T00:00:00+00:00", from tasks). Normalised to the
  // day so the date arithmetic below can't produce an invalid date.
  const dueDay = reviewDueDate ? String(reviewDueDate).slice(0, 10) : null
  const weekEnd = dueDay ?? isoDay(new Date())
  const weekStart = addDays(weekEnd, -6)

  const { data: weekGoals } = await supabase
    .from("study_plan_goals")
    .select("title, description, priority, completed, due_date")
    .eq("plan_id", planId)
    .eq("is_review", false)
    .gte("due_date", weekStart)
    .lte("due_date", weekEnd)
    .order("due_date")

  const goals: any[] = weekGoals ?? []
  const completed = goals.filter((g) => g.completed)
  const missed = goals.filter((g) => !g.completed)
  const weekNumber = weekNumberOf(plan?.start_date ?? null, dueDay)

  let suggestions: CoachSuggestion[] = []
  try {
    const { aiChatCompletion, isAIConfigured } = await import("@/lib/ai/provider")
    if (await isAIConfigured()) {
      const prompt = `A student just completed their weekly review for ${plan?.subject ?? "their studies"}.

Completed this week (${completed.length}/${goals.length}):
${completed.map((g) => `- ${g.title}`).join("\n") || "(none)"}

NOT completed this week:
${missed.map((g) => `- ${g.title} (priority: ${g.priority})`).join("\n") || "(none — full week completed)"}
${scorePercentage != null ? `\nWeekly review test score: ${Math.round(scorePercentage)}%.` : ""}

Based on what was and wasn't finished${scorePercentage != null ? " and the test score" : ""}, suggest what to focus on next week. Return ONLY JSON:
{ "suggestions": [ { "topic": "", "reason": "", "action": "review again | catch up | move on | extra practice" } ] }
Give at most 5 suggestions. Use topic names from the lists above where possible. If everything was completed and the score is good, suggest moving forward plus one light reinforcement item.`

      const response = await aiChatCompletion(
        {
          messages: [
            { role: "system", content: "You are a study coach analysing a week of completed and missed tasks. Return only valid JSON." },
            { role: "user", content: prompt },
          ],
          temperature: 0.5,
          max_tokens: 600,
        },
        { task: "summarization", agent: "study_ai", cacheable: false },
      )
      if (response.ok) {
        const data = await response.json()
        const raw = data.choices?.[0]?.message?.content?.trim() ?? "{}"
        const cleaned = raw.replace(/^```json\s*/i, "").replace(/```\s*$/, "")
        const parsed = JSON.parse(cleaned)?.suggestions
        suggestions = Array.isArray(parsed) ? parsed.filter((x: any) => x && typeof x.topic === "string").slice(0, 5) : []
      }
    }
  } catch (err) {
    console.error("[weekly-review] AI suggestion generation failed:", err)
  }

  const row: Record<string, unknown> = {
    plan_id: planId,
    review_task_id: reviewTaskId,
    user_id: userId,
    week_number: weekNumber,
    completed_count: completed.length,
    total_count: goals.length,
    suggestions,
  }
  if (scorePercentage != null) row.score_percentage = Math.round(scorePercentage * 100) / 100
  if (attemptId) row.attempt_id = attemptId

  const { data: feedback, error } = await supabase.from("study_plan_review_feedback").insert(row).select().single()
  if (error) {
    console.error("[weekly-review] could not save feedback:", error.message)
    return { week_number: weekNumber, completed_count: completed.length, total_count: goals.length, suggestions, score_percentage: scorePercentage }
  }
  return feedback
}

"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { toast } from "sonner"
import { CalendarPlus, CheckCircle2, ClipboardCheck, Clock, Loader2, Lock, Plus, RefreshCw, Sparkles, Trophy } from "lucide-react"
import { cn } from "@/lib/utils"
import { MockExamInterface } from "@/components/exam-generator/mock-exam-interface"
import type { CoachReview, CoachSnapshot, CoachSuggestion } from "@/lib/services/study-coach"

interface TestState {
  attemptId: string
  goalId: string | null
  label: string
  topics: string[]
  questions: { id: number; question: string; options: string[] }[]
  totalQuestions: number
  timeLimit: number
}

interface ResultState {
  score: number
  goalId: string | null
  label: string
  subject: string | null
  feedback: { id?: string; suggestions?: CoachSuggestion[]; completed_count?: number; total_count?: number } | null
  feedbackLoading: boolean
}

const STATUS_STYLE: Record<CoachReview["status"], { label: string; cls: string }> = {
  overdue: { label: "Overdue", cls: "bg-amber-500/12 text-amber-600 dark:text-amber-400 border-amber-500/25" },
  due: { label: "Due now", cls: "bg-indigo-500/12 text-indigo-600 dark:text-indigo-400 border-indigo-500/25" },
  upcoming: { label: "Upcoming", cls: "bg-muted text-muted-foreground border-border" },
  done: { label: "Done", cls: "bg-emerald-500/12 text-emerald-600 dark:text-emerald-400 border-emerald-500/25" },
}

const fmt = (d: string | null) =>
  d ? new Date(d.slice(0, 10) + "T00:00:00Z").toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }) : ""

/**
 * EchoMind's 4th option. Lists the learner's weekly review checkpoints from
 * their study plans, generates a test from that week's planner topics, runs
 * it in the normal exam screen (graded on the server, counted in the Mock
 * Exam Score), then completes the review in the Study Planner and shows the
 * AI's next-week suggestions with one-tap "add to planner".
 */
export function WeeklyReviewPanel({ onUsageChanged, onPlannerChanged }: { onUsageChanged?: () => void; onPlannerChanged?: () => void }) {
  const [snapshot, setSnapshot] = useState<CoachSnapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [starting, setStarting] = useState<string | null>(null)
  const [limitReached, setLimitReached] = useState(false)
  const [test, setTest] = useState<TestState | null>(null)
  const [result, setResult] = useState<ResultState | null>(null)
  const [adding, setAdding] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/echomind/coach", { cache: "no-store" })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Could not load your weekly reviews")
      setSnapshot(data.snapshot)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load your weekly reviews")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const startTest = async (goalId: string | null) => {
    const key = goalId ?? "quick"
    setStarting(key)
    try {
      const res = await fetch("/api/echomind/weekly-review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(goalId ? { goalId } : {}),
      })
      const data = await res.json()
      if (res.status === 429 || data.error === "limit_reached") {
        setLimitReached(true)
        onUsageChanged?.()
        return
      }
      if (!res.ok) throw new Error(data.message || data.error || "Could not create the test")
      setTest(data)
      onUsageChanged?.()
      window.scrollTo({ top: 0, behavior: "smooth" })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not create the test")
    } finally {
      setStarting(null)
    }
  }

  // Fired by the exam screen once the server has graded the test.
  const handleGraded = async ({ attemptId, scorePercentage }: { attemptId: string; scorePercentage: number }) => {
    if (!test) return
    const review = snapshot?.reviews.find((r) => r.goalId === test.goalId)
    setResult({
      score: scorePercentage,
      goalId: test.goalId,
      label: test.label,
      subject: review?.subject ?? null,
      feedback: null,
      feedbackLoading: !!test.goalId,
    })
    try {
      const res = await fetch("/api/echomind/weekly-review/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attemptId, goalId: test.goalId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Could not complete the review")
      setResult((r) => (r ? { ...r, feedback: data.feedback ?? null, feedbackLoading: false } : r))
      if (test.goalId) {
        toast.success("Weekly review marked done in your Study Planner")
        onPlannerChanged?.()
      }
    } catch (e) {
      setResult((r) => (r ? { ...r, feedbackLoading: false } : r))
      toast.error(e instanceof Error ? e.message : "Could not complete the review")
    }
  }

  const addToPlanner = async (key: string, items: { title: string; subject?: string | null; reason?: string }[], feedbackId?: string) => {
    setAdding(key)
    try {
      const res = await fetch("/api/echomind/coach/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "add", items, feedbackId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Could not update your planner")
      toast.success(
        data.added > 0
          ? `Added ${data.added} session${data.added === 1 ? "" : "s"} to your Study Planner${data.skipped ? ` (${data.skipped} already scheduled)` : ""}`
          : "Those are already in your Study Planner",
      )
      onPlannerChanged?.()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update your planner")
    } finally {
      setAdding(null)
    }
  }

  // ── Taking the test ───────────────────────────────────────────────────────
  if (test && !result) {
    return (
      <div className="space-y-3">
        <div className="rounded-xl border border-indigo-500/25 bg-indigo-500/[0.05] px-4 py-3">
          <p className="text-sm font-semibold">{test.label}</p>
          <p className="text-xs text-muted-foreground">Covers: {test.topics.join(", ")}</p>
        </div>
        <MockExamInterface
          attemptId={test.attemptId}
          questions={test.questions}
          totalQuestions={test.totalQuestions}
          timeLimit={test.timeLimit}
          onComplete={handleGraded}
          onExit={() => {
            setTest(null)
            load()
          }}
        />
      </div>
    )
  }

  // ── Results + feedback ────────────────────────────────────────────────────
  if (result) {
    const suggestions = result.feedback?.suggestions ?? []
    const good = result.score >= 70
    return (
      <div className="space-y-4">
        <div className={cn("rounded-2xl border p-5 text-center space-y-2", good ? "border-emerald-500/30 bg-emerald-500/[0.06]" : "border-amber-500/30 bg-amber-500/[0.06]")}>
          <Trophy className={cn("mx-auto h-8 w-8", good ? "text-emerald-500" : "text-amber-500")} />
          <p className="text-3xl font-bold">{Math.round(result.score)}%</p>
          <p className="text-sm text-muted-foreground">{result.label}</p>
          <p className="text-sm">
            {good
              ? "Strong week — this is what steady studying looks like. Keep going."
              : result.score >= 40
                ? "Solid effort. A few topics need another look — your coach has lined them up below."
                : "Tough week, and that's okay — this is exactly what reviews are for. Let's reinforce the gaps."}
          </p>
          <p className="text-xs text-muted-foreground">This score is included in your Mock Exam Score.</p>
        </div>

        {result.goalId && (
          <div className="rounded-2xl border p-4 space-y-3">
            <p className="flex items-center gap-2 text-sm font-semibold">
              <Sparkles className="h-4 w-4 text-indigo-500" /> What to focus on next week
            </p>
            {result.feedbackLoading ? (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Analysing your week…
              </p>
            ) : suggestions.length === 0 ? (
              <p className="text-sm text-muted-foreground">No specific suggestions this time — keep following your plan.</p>
            ) : (
              <>
                <ul className="space-y-2">
                  {suggestions.map((sug, i) => (
                    <li key={i} className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium">
                          {sug.topic}
                          {sug.action && <span className="ml-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">{sug.action}</span>}
                        </p>
                        {sug.reason && <p className="text-xs text-muted-foreground">{sug.reason}</p>}
                      </div>
                      <button
                        onClick={() => addToPlanner(`s-${i}`, [{ title: sug.topic, subject: result.subject, reason: sug.reason }])}
                        disabled={!!adding}
                        className="flex shrink-0 items-center gap-1 rounded-lg border px-2 py-1 text-[11px] font-semibold hover:bg-muted disabled:opacity-50"
                      >
                        {adding === `s-${i}` ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />} Add
                      </button>
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() =>
                    addToPlanner(
                      "all",
                      suggestions.map((x) => ({ title: x.topic, subject: result.subject, reason: x.reason })),
                      result.feedback?.id,
                    )
                  }
                  disabled={!!adding}
                  className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  {adding === "all" ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarPlus className="h-4 w-4" />}
                  Add all to my Study Planner
                </button>
              </>
            )}
          </div>
        )}

        <button
          onClick={() => {
            setResult(null)
            setTest(null)
            load()
          }}
          className="w-full rounded-xl border px-4 py-2 text-sm font-medium hover:bg-muted"
        >
          Back to weekly reviews
        </button>
      </div>
    )
  }

  // ── List of reviews ───────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-2xl border p-4 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading your weekly reviews…
      </div>
    )
  }
  if (error || !snapshot) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-2xl border p-4 text-sm">
        <span className="text-muted-foreground">{error ?? "Could not load your weekly reviews"}</span>
        <button onClick={() => { setLoading(true); load() }} className="flex items-center gap-1 text-xs font-medium text-primary">
          <RefreshCw className="h-3.5 w-3.5" /> Retry
        </button>
      </div>
    )
  }

  const order: CoachReview["status"][] = ["overdue", "due", "upcoming", "done"]
  const reviews = [...snapshot.reviews].sort(
    (a, b) => order.indexOf(a.status) - order.indexOf(b.status) || String(a.dueDate).localeCompare(String(b.dueDate)),
  )

  return (
    <div className="space-y-3">
      {limitReached && (
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-red-500/20 bg-red-500/[0.06] p-3">
          <div className="flex items-center gap-2 text-sm">
            <Lock className="h-4 w-4 text-red-400" />
            You&apos;ve used this month&apos;s weekly review tests. They reset on the 1st.
          </div>
          <a href="/upgrade" className="shrink-0 rounded-lg bg-indigo-500 px-3 py-1.5 text-xs font-semibold text-white">Unlock Genius</a>
        </div>
      )}

      <p className="text-xs text-muted-foreground px-0.5">
        Each test covers that week&apos;s Study Planner topics. Your score counts toward your Mock Exam Score, the review is
        ticked off in your planner, and EchoMind suggests what to focus on next.
      </p>

      {reviews.length === 0 ? (
        <div className="rounded-2xl border border-dashed p-4 text-sm space-y-2">
          <p className="text-muted-foreground">
            No weekly reviews yet. Export a plan from StudyPilot and a review is scheduled at the end of every week.
          </p>
          <Link href="/study-agent" className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold hover:bg-muted">
            <Sparkles className="h-3.5 w-3.5 text-indigo-500" /> Build a plan with StudyPilot
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {reviews.map((r) => (
            <div key={r.goalId} className="flex items-center justify-between gap-3 rounded-2xl border bg-card p-3">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-muted">
                  {r.status === "done" ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <ClipboardCheck className="h-4 w-4 text-muted-foreground" />}
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <p className="text-sm font-semibold">Week {r.weekNumber}</p>
                    <span className={cn("rounded-full border px-1.5 py-0.5 text-[10px] font-semibold", STATUS_STYLE[r.status].cls)}>
                      {STATUS_STYLE[r.status].label}
                    </span>
                    {r.score != null && <span className="text-[11px] font-semibold text-muted-foreground">{Math.round(r.score)}%</span>}
                  </div>
                  <p className="truncate text-xs text-muted-foreground" title={r.planTitle}>
                    {r.planTitle}
                    {r.dueDate && <> · <Clock className="inline h-3 w-3" /> {fmt(r.dueDate)}</>}
                  </p>
                </div>
              </div>
              {r.status !== "done" && (
                <button
                  onClick={() => startTest(r.goalId)}
                  disabled={!!starting}
                  className={cn(
                    "flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold disabled:opacity-50",
                    r.status === "upcoming" ? "border hover:bg-muted" : "bg-indigo-500 text-white hover:bg-indigo-600",
                  )}
                >
                  {starting === r.goalId && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  {starting === r.goalId ? "Creating…" : r.status === "upcoming" ? "Take early" : "Take the test"}
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Works with or without a plan */}
      <button
        onClick={() => startTest(null)}
        disabled={!!starting}
        className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed px-4 py-3 text-sm font-medium hover:bg-muted/50 disabled:opacity-50"
      >
        {starting === "quick" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4 text-indigo-500" />}
        {starting === "quick" ? "Creating your test…" : "Quick review: test me on everything I completed in the last 7 days"}
      </button>
    </div>
  )
}

"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { toast } from "sonner"
import { AlertTriangle, ArrowRight, CalendarClock, CheckCircle2, ClipboardCheck, Compass, Loader2, Sparkles } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { cn } from "@/lib/utils"
import type { CoachGoal, CoachSnapshot } from "@/lib/services/study-coach"

const LIST_LIMIT = 4
const DAY_MS = 86_400_000

function dueLabel(due: string | null, today: string): string {
  if (!due) return ""
  const diff = Math.round((new Date(due + "T00:00:00Z").getTime() - new Date(today + "T00:00:00Z").getTime()) / DAY_MS)
  if (diff === 0) return "Today"
  if (diff === 1) return "Tomorrow"
  if (diff === -1) return "Yesterday"
  if (diff < 0) return `${-diff} days ago`
  return new Date(due + "T00:00:00Z").toLocaleDateString(undefined, { weekday: "short", timeZone: "UTC" })
}

/**
 * Study Coach preview for the main dashboard — focused on what's due and
 * overdue in the learner's active study plans. Sessions can be ticked off
 * here (plan + calendar stay in sync), overdue work can be caught up in one
 * tap, and a due weekly review links straight to its test. The full coach
 * (coverage, suggestions, reviews) lives in EchoMind.
 */
export function StudyCoachPreview() {
  const [snapshot, setSnapshot] = useState<CoachSnapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  const [pending, setPending] = useState<string | null>(null)
  const [catchingUp, setCatchingUp] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/echomind/coach", { cache: "no-store" })
      if (!res.ok) throw new Error()
      setSnapshot((await res.json()).snapshot)
      setFailed(false)
    } catch {
      setFailed(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const markDone = async (g: CoachGoal) => {
    setPending(g.goalId)
    try {
      // Updates the plan goal and its calendar task together.
      const res = await fetch("/api/study-plans/goals/toggle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goalId: g.goalId, completed: true }),
      })
      if (!res.ok) throw new Error()
      toast.success(`"${g.title}" done — nice work`)
      await load()
    } catch {
      toast.error("Could not update that session. Please try again.")
    } finally {
      setPending(null)
    }
  }

  const catchUp = async () => {
    setCatchingUp(true)
    try {
      const res = await fetch("/api/echomind/coach/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reschedule" }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast.success(data.moved > 0 ? `Moved ${data.moved} session${data.moved === 1 ? "" : "s"} forward — max 2 a day` : "Nothing needed moving")
      await load()
    } catch {
      toast.error("Could not reschedule. Please try again.")
    } finally {
      setCatchingUp(false)
    }
  }

  const header = (
    <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0 pb-3">
      <CardTitle className="flex items-center gap-2 text-lg">
        <Compass className="h-5 w-5 text-indigo-500" />
        Study Coach
      </CardTitle>
      <Button asChild variant="ghost" size="sm" className="shrink-0 gap-1">
        <Link href="/echomind">
          Open coach <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </Button>
    </CardHeader>
  )

  if (loading) {
    return (
      <Card>
        {header}
        <CardContent className="flex items-center justify-center py-8 text-sm text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading your sessions…
        </CardContent>
      </Card>
    )
  }
  // A dashboard widget shouldn't shout about a failed load — just hide.
  if (failed || !snapshot) return null

  const s = snapshot
  const hasActivePlan = s.plans.some((p) => p.active)
  const review = s.reviews.find((r) => r.status === "overdue") ?? s.reviews.find((r) => r.status === "due")
  const dueSoon = s.upcoming

  const Row = ({ g, overdue }: { g: CoachGoal; overdue?: boolean }) => (
    <div className="flex items-center gap-3 rounded-lg border px-3 py-2">
      <Checkbox
        checked={false}
        disabled={pending === g.goalId}
        onCheckedChange={() => markDone(g)}
        aria-label={`Mark "${g.title}" done`}
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium" title={g.title}>{g.title}</p>
        <p className="truncate text-xs text-muted-foreground">
          <span className={cn(overdue && "font-medium text-amber-600 dark:text-amber-400")}>{dueLabel(g.dueDate, s.today)}</span>
          {g.subject ? ` · ${g.subject}` : ""}
        </p>
      </div>
      {pending === g.goalId ? (
        <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
      ) : (
        <Link
          href={`/echomind?mode=my_knowledge&topic=${encodeURIComponent(g.title)}`}
          className="shrink-0 rounded-md px-2 py-1 text-xs font-semibold text-indigo-500 hover:bg-indigo-500/10"
        >
          Review
        </Link>
      )}
    </div>
  )

  return (
    <Card>
      {header}
      <CardContent className="space-y-4">
        {!hasActivePlan ? (
          <div className="space-y-3 py-4 text-center">
            <p className="text-sm text-muted-foreground">No active study plan yet — build one and your due sessions will show here.</p>
            <Button asChild size="sm" variant="outline" className="gap-1.5">
              <Link href="/study-agent">
                <Sparkles className="h-3.5 w-3.5 text-indigo-500" /> Build a plan with StudyPilot
              </Link>
            </Button>
          </div>
        ) : (
          <>
            {review && (
              <div
                className={cn(
                  "flex items-center justify-between gap-3 rounded-lg border p-3",
                  review.status === "overdue" ? "border-amber-500/30 bg-amber-500/[0.06]" : "border-indigo-500/25 bg-indigo-500/[0.05]",
                )}
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  <ClipboardCheck className={cn("h-4 w-4 shrink-0", review.status === "overdue" ? "text-amber-500" : "text-indigo-500")} />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">Week {review.weekNumber} review {review.status === "overdue" ? "is overdue" : "is due"}</p>
                    <p className="truncate text-xs text-muted-foreground">{review.planTitle}</p>
                  </div>
                </div>
                <Button asChild size="sm" className="shrink-0">
                  <Link href="/echomind?mode=weekly_review">Take the test</Link>
                </Button>
              </div>
            )}

            {s.overdue.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="flex items-center gap-1.5 text-sm font-semibold">
                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                    Overdue <span className="font-normal text-muted-foreground">({s.overdue.length})</span>
                  </p>
                  <Button variant="outline" size="sm" onClick={catchUp} disabled={catchingUp} className="h-8 gap-1.5 text-xs">
                    {catchingUp ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CalendarClock className="h-3.5 w-3.5" />}
                    Catch me up
                  </Button>
                </div>
                {s.overdue.slice(0, LIST_LIMIT).map((g) => (
                  <Row key={g.goalId} g={g} overdue />
                ))}
                {s.overdue.length > LIST_LIMIT && (
                  <p className="text-xs text-muted-foreground">
                    +{s.overdue.length - LIST_LIMIT} more — “Catch me up” spreads them over the coming days.
                  </p>
                )}
              </div>
            )}

            <div className="space-y-2">
              <p className="text-sm font-semibold">
                Due this week <span className="font-normal text-muted-foreground">({dueSoon.length})</span>
              </p>
              {dueSoon.length === 0 ? (
                <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  {s.overdue.length === 0 ? "You're all caught up — nothing due in the next 7 days." : "Nothing else due in the next 7 days."}
                </p>
              ) : (
                <>
                  {dueSoon.slice(0, LIST_LIMIT).map((g) => (
                    <Row key={g.goalId} g={g} />
                  ))}
                  {dueSoon.length > LIST_LIMIT && (
                    <Link href="/planner" className="block text-xs font-medium text-primary hover:underline">
                      +{dueSoon.length - LIST_LIMIT} more in your Study Planner
                    </Link>
                  )}
                </>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}

"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { toast } from "sonner"
import {
  AlertTriangle,
  CalendarPlus,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  ClipboardCheck,
  Compass,
  Loader2,
  Plus,
  RefreshCw,
  Sparkles,
  Target,
  X,
} from "lucide-react"
import { cn } from "@/lib/utils"
import type { CoachSnapshot, CoverageSubject, TopicStatus } from "@/lib/services/study-coach"

type ReviewMode = "my_knowledge" | "confusion_history" | "future_me"

interface StudyCoachPanelProps {
  /**
   * EchoMind passes these so actions happen in place. Without them (e.g. on
   * the Study Planner page) the same actions become links into EchoMind.
   */
  onReviewTopic?: (topic: string, mode: ReviewMode) => void
  onOpenWeeklyReview?: () => void
  /** Bump to make the panel re-fetch (e.g. after a weekly review completes). */
  refreshKey?: number
  variant?: "full" | "compact"
}

const STATUS_META: Record<TopicStatus, { label: string; chip: string; dot: string }> = {
  strong: { label: "Strong", chip: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20", dot: "bg-emerald-500" },
  covered: { label: "Covered — reinforce", chip: "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20", dot: "bg-sky-500" },
  needs_work: { label: "Needs work", chip: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20", dot: "bg-amber-500" },
  planned: { label: "Planned", chip: "bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20", dot: "bg-violet-500" },
  not_started: { label: "Not started", chip: "bg-muted text-muted-foreground border-border", dot: "bg-muted-foreground/40" },
}
const STATUS_ORDER: TopicStatus[] = ["strong", "covered", "needs_work", "planned", "not_started"]

const echoLink = (topic: string, mode: ReviewMode) =>
  `/echomind?mode=${mode}&topic=${encodeURIComponent(topic)}`

function encouragement(s: CoachSnapshot): string {
  const { done, total } = s.thisWeek
  if (total > 0 && done >= total) return `Every session this week is done — brilliant consistency. 🎉`
  if (total > 0 && done > 0) return `${done} of ${total} sessions done this week — keep the momentum going.`
  if (total > 0) return `${total} session${total === 1 ? "" : "s"} planned this week — the first one is the hardest. You've got this.`
  if (s.recentlyCompleted.length > 0) return `You've finished ${s.recentlyCompleted.length} session${s.recentlyCompleted.length === 1 ? "" : "s"} in the last two weeks. Nice work.`
  return "Let's build your week — a small plan you actually follow beats a big one you don't."
}

export function StudyCoachPanel({ onReviewTopic, onOpenWeeklyReview, refreshKey = 0, variant = "full" }: StudyCoachPanelProps) {
  const [snapshot, setSnapshot] = useState<CoachSnapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [openSubject, setOpenSubject] = useState<string | null>(null)
  const [expandAll, setExpandAll] = useState<Record<string, boolean>>({})

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/echomind/coach", { cache: "no-store" })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Could not load your study progress")
      setSnapshot(data.snapshot)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load your study progress")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load, refreshKey])

  const planAction = async (key: string, body: Record<string, unknown>, success: (d: any) => string) => {
    setBusy(key)
    try {
      const res = await fetch("/api/echomind/coach/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Could not update your planner")
      toast.success(success(data))
      await load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update your planner")
    } finally {
      setBusy(null)
    }
  }

  const addToPlanner = (key: string, items: { title: string; subject?: string | null; reason?: string }[], feedbackId?: string) =>
    planAction(key, { action: "add", items, feedbackId }, (d) =>
      d.added > 0
        ? `Added ${d.added} session${d.added === 1 ? "" : "s"} to your Study Planner${d.skipped ? ` (${d.skipped} already scheduled)` : ""}`
        : "Those are already in your Study Planner",
    )

  const ReviewButton = ({ topic, mode, label }: { topic: string; mode: ReviewMode; label: string }) =>
    onReviewTopic ? (
      <button
        onClick={() => onReviewTopic(topic, mode)}
        className="shrink-0 rounded-lg border px-2 py-1 text-[11px] font-semibold text-indigo-500 border-indigo-500/25 hover:bg-indigo-500/10 transition-colors"
      >
        {label}
      </button>
    ) : (
      <Link
        href={echoLink(topic, mode)}
        className="shrink-0 rounded-lg border px-2 py-1 text-[11px] font-semibold text-indigo-500 border-indigo-500/25 hover:bg-indigo-500/10 transition-colors"
      >
        {label}
      </Link>
    )

  const WeeklyReviewButton = ({ children, className }: { children: React.ReactNode; className: string }) =>
    onOpenWeeklyReview ? (
      <button onClick={onOpenWeeklyReview} className={className}>
        {children}
      </button>
    ) : (
      <Link href="/echomind?mode=weekly_review" className={className}>
        {children}
      </Link>
    )

  if (loading) {
    return (
      <div className="rounded-2xl border border-border bg-card p-4 flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading your study progress…
      </div>
    )
  }
  if (error || !snapshot) {
    return (
      <div className="rounded-2xl border border-border bg-card p-4 flex items-center justify-between gap-3 text-sm">
        <span className="text-muted-foreground">{error ?? "Could not load your study progress"}</span>
        <button onClick={() => { setLoading(true); load() }} className="flex items-center gap-1 text-xs font-medium text-primary">
          <RefreshCw className="h-3.5 w-3.5" /> Retry
        </button>
      </div>
    )
  }

  const s = snapshot
  const activePlans = s.plans.filter((p) => p.active)
  const pendingReview = s.reviews.find((r) => r.status === "overdue") ?? s.reviews.find((r) => r.status === "due")
  const fb = s.feedback[0]
  const compact = variant === "compact"

  return (
    <div className="rounded-2xl border border-indigo-500/20 bg-gradient-to-br from-indigo-500/[0.06] via-card to-card p-4 space-y-4">
      {/* Header + encouragement */}
      <div className="flex items-start gap-3">
        <div className="h-9 w-9 shrink-0 rounded-xl bg-indigo-500/15 flex items-center justify-center">
          <Compass className="h-4 w-4 text-indigo-500" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold">Study Coach</p>
          <p className="text-xs text-muted-foreground">{encouragement(s)}</p>
        </div>
      </div>

      {/* No plan yet */}
      {activePlans.length === 0 && (
        <div className="rounded-xl border border-dashed p-3 text-sm space-y-2">
          <p className="text-muted-foreground">
            You don&apos;t have an active study plan. Build one and EchoMind will track it, remind you what&apos;s next and
            test you each week.
          </p>
          <div className="flex flex-wrap gap-2">
            <Link href="/study-agent" className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-600">
              <Sparkles className="h-3.5 w-3.5" /> Build a plan with StudyPilot
            </Link>
            <Link href="/planner" className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold hover:bg-muted">
              Open Study Planner
            </Link>
          </div>
        </div>
      )}

      {/* Plan progress */}
      {activePlans.length > 0 && (
        <div className="space-y-2">
          {activePlans.slice(0, compact ? 2 : 4).map((p) => {
            const pct = p.total ? Math.round((p.done / p.total) * 100) : 0
            return (
              <div key={p.id}>
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="truncate font-medium" title={p.title}>{p.title}</span>
                  <span className="shrink-0 text-muted-foreground">{p.done}/{p.total} · {pct}%</span>
                </div>
                <div className="mt-1 h-1.5 rounded-full bg-muted overflow-hidden">
                  <div className="h-full rounded-full bg-indigo-500 transition-all" style={{ width: `${pct}%` }} />
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Weekly review due */}
      {pendingReview && (
        <div className={cn(
          "rounded-xl border p-3 flex items-center justify-between gap-3",
          pendingReview.status === "overdue" ? "border-amber-500/30 bg-amber-500/[0.06]" : "border-indigo-500/25 bg-indigo-500/[0.05]",
        )}>
          <div className="flex items-center gap-2.5 min-w-0">
            <ClipboardCheck className={cn("h-4 w-4 shrink-0", pendingReview.status === "overdue" ? "text-amber-500" : "text-indigo-500")} />
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate">Week {pendingReview.weekNumber} review {pendingReview.status === "overdue" ? "is overdue" : "is due"}</p>
              <p className="text-xs text-muted-foreground truncate">{pendingReview.planTitle}</p>
            </div>
          </div>
          <WeeklyReviewButton className="shrink-0 rounded-lg bg-indigo-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-600">
            Take the test
          </WeeklyReviewButton>
        </div>
      )}

      {/* Overdue → catch up */}
      {s.overdue.length > 0 && (
        <div className="rounded-xl border border-amber-500/25 bg-amber-500/[0.05] p-3 space-y-2">
          <div className="flex items-center justify-between gap-3">
            <p className="flex items-center gap-2 text-sm font-semibold">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              {s.overdue.length} session{s.overdue.length === 1 ? "" : "s"} overdue
            </p>
            <button
              onClick={() => planAction("reschedule", { action: "reschedule" }, (d) => d.moved > 0 ? `Moved ${d.moved} session${d.moved === 1 ? "" : "s"} forward — max 2 a day from today` : "Nothing needed moving")}
              disabled={busy === "reschedule"}
              className="flex shrink-0 items-center gap-1.5 rounded-lg border border-amber-500/30 px-2.5 py-1 text-xs font-semibold text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 disabled:opacity-50"
            >
              {busy === "reschedule" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CalendarClock className="h-3.5 w-3.5" />}
              Catch me up
            </button>
          </div>
          <p className="text-xs text-muted-foreground">
            No stress — “Catch me up” spreads them over the coming days (max 2 a day) on your plan and calendar.
          </p>
          {!compact && (
            <ul className="space-y-1">
              {s.overdue.slice(0, 3).map((g) => (
                <li key={g.goalId} className="flex items-center justify-between gap-2 text-xs">
                  <span className="truncate">
                    {g.title}
                    {g.subject && <span className="text-muted-foreground"> · {g.subject}</span>}
                  </span>
                  <ReviewButton topic={g.title} mode="my_knowledge" label="Review" />
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Next up */}
      {s.upcoming.length > 0 && !compact && (
        <div className="space-y-1.5">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Next up</p>
          {s.upcoming.slice(0, 3).map((g) => (
            <div key={g.goalId} className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2">
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{g.title}</p>
                <p className="text-[11px] text-muted-foreground">
                  {g.dueDate ? new Date(g.dueDate + "T00:00:00Z").toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }) : ""}
                  {g.subject ? ` · ${g.subject}` : ""}
                </p>
              </div>
              <ReviewButton topic={g.title} mode="future_me" label="Preview" />
            </div>
          ))}
        </div>
      )}

      {/* Weekly-review feedback → act on it */}
      {fb && (
        <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/[0.05] p-3 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="flex items-center gap-2 text-sm font-semibold">
                <Target className="h-4 w-4 text-emerald-500" />
                Suggested for next week
              </p>
              <p className="text-xs text-muted-foreground">
                From your Week {fb.weekNumber} review{fb.score != null ? ` · test ${Math.round(fb.score)}%` : ""} · {fb.completedCount}/{fb.totalCount} sessions done
              </p>
            </div>
            <button
              onClick={() => planAction(`dismiss-${fb.id}`, { action: "dismiss", feedbackId: fb.id }, () => "Suggestions dismissed")}
              disabled={busy === `dismiss-${fb.id}`}
              aria-label="Dismiss suggestions"
              className="rounded p-1 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <ul className="space-y-1.5">
            {fb.suggestions.map((sug, i) => (
              <li key={i} className="flex items-start justify-between gap-2 text-sm">
                <div className="min-w-0">
                  <p className="font-medium">
                    {sug.topic}
                    {sug.action && <span className="ml-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">{sug.action}</span>}
                  </p>
                  {sug.reason && <p className="text-xs text-muted-foreground">{sug.reason}</p>}
                </div>
                <button
                  onClick={() => addToPlanner(`fb-${fb.id}-${i}`, [{ title: sug.topic, subject: fb.subject, reason: sug.reason }])}
                  disabled={!!busy}
                  className="flex shrink-0 items-center gap-1 rounded-lg border px-2 py-1 text-[11px] font-semibold hover:bg-muted disabled:opacity-50"
                >
                  {busy === `fb-${fb.id}-${i}` ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />} Add
                </button>
              </li>
            ))}
          </ul>
          <button
            onClick={() =>
              addToPlanner(
                `fb-all-${fb.id}`,
                fb.suggestions.map((x) => ({ title: x.topic, subject: fb.subject, reason: x.reason })),
                fb.id,
              )
            }
            disabled={!!busy}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            {busy === `fb-all-${fb.id}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CalendarPlus className="h-3.5 w-3.5" />}
            Add all to my Study Planner
          </button>
        </div>
      )}

      {/* Syllabus coverage */}
      {s.coverage.length > 0 ? (
        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Syllabus coverage</p>
          {s.coverage.map((c) => (
            <CoverageRow
              key={`${c.syllabus}::${c.subject}`}
              c={c}
              open={openSubject === `${c.syllabus}::${c.subject}` || (s.coverage.length === 1 && openSubject === null && !compact)}
              onToggle={() => setOpenSubject((cur) => (cur === `${c.syllabus}::${c.subject}` ? "__none__" : `${c.syllabus}::${c.subject}`))}
              showAll={!!expandAll[`${c.syllabus}::${c.subject}`]}
              onShowAll={() => setExpandAll((m) => ({ ...m, [`${c.syllabus}::${c.subject}`]: true }))}
              busy={busy}
              ReviewButton={ReviewButton}
              onAdd={(topic) => addToPlanner(`cov-${topic}`, [{ title: topic, subject: c.subject }])}
            />
          ))}
        </div>
      ) : (
        !s.hasSyllabus && (
          <p className="text-xs text-muted-foreground">
            <Link href="/dashboard" className="underline hover:text-foreground">Choose your syllabus and subjects</Link> to see which
            topics you&apos;ve covered and which are still to come.
          </p>
        )
      )}

      {compact && (
        <Link href="/echomind" className="flex items-center justify-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold hover:bg-muted">
          <Sparkles className="h-3.5 w-3.5 text-indigo-500" /> Open EchoMind coach
        </Link>
      )}
    </div>
  )
}

function CoverageRow({
  c,
  open,
  onToggle,
  showAll,
  onShowAll,
  busy,
  ReviewButton,
  onAdd,
}: {
  c: CoverageSubject
  open: boolean
  onToggle: () => void
  showAll: boolean
  onShowAll: () => void
  busy: string | null
  ReviewButton: (p: { topic: string; mode: ReviewMode; label: string }) => React.ReactElement
  onAdd: (topic: string) => void
}) {
  const total = c.topics.length || 1
  const LIMIT = 6
  const groups: { status: TopicStatus; hint: string }[] = [
    { status: "needs_work", hint: "Reinforce these first" },
    { status: "covered", hint: "Covered — a quick review keeps them fresh" },
    { status: "not_started", hint: "Still to cover" },
  ]

  return (
    <div className="rounded-xl border">
      <button onClick={onToggle} className="w-full p-3 text-left space-y-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-semibold truncate">
            {c.subject} <span className="font-normal text-muted-foreground">· {c.syllabus}</span>
          </span>
          <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
        </div>
        {/* stacked bar */}
        <div className="flex h-2 overflow-hidden rounded-full bg-muted">
          {STATUS_ORDER.map((st) =>
            c.counts[st] > 0 ? (
              <div key={st} className={STATUS_META[st].dot} style={{ width: `${(c.counts[st] / total) * 100}%` }} title={`${STATUS_META[st].label}: ${c.counts[st]}`} />
            ) : null,
          )}
        </div>
        <div className="flex flex-wrap gap-x-3 gap-y-1">
          {STATUS_ORDER.filter((st) => c.counts[st] > 0).map((st) => (
            <span key={st} className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <span className={cn("h-2 w-2 rounded-full", STATUS_META[st].dot)} />
              {c.counts[st]} {STATUS_META[st].label.toLowerCase()}
            </span>
          ))}
        </div>
      </button>

      {open && (
        <div className="border-t p-3 space-y-3">
          {c.topics.length === 0 && <p className="text-xs text-muted-foreground">No topics indexed for this subject yet.</p>}
          {groups.map(({ status, hint }) => {
            const items = c.topics.filter((t) => t.status === status)
            if (items.length === 0) return null
            const shown = showAll ? items : items.slice(0, LIMIT)
            return (
              <div key={status} className="space-y-1.5">
                <p className="text-xs font-semibold">
                  {STATUS_META[status].label} <span className="font-normal text-muted-foreground">— {hint}</span>
                </p>
                {shown.map((t) => (
                  <div key={t.id} className="flex items-center justify-between gap-2">
                    <span className={cn("truncate rounded-md border px-2 py-0.5 text-xs", STATUS_META[status].chip)} title={t.name}>
                      {t.name}
                    </span>
                    <div className="flex shrink-0 gap-1">
                      {status === "not_started" ? (
                        <>
                          <ReviewButton topic={t.name} mode="future_me" label="Preview" />
                          <button
                            onClick={() => onAdd(t.name)}
                            disabled={!!busy}
                            className="flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] font-semibold hover:bg-muted disabled:opacity-50"
                          >
                            {busy === `cov-${t.name}` ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />} Plan it
                          </button>
                        </>
                      ) : (
                        <ReviewButton
                          topic={t.name}
                          mode={status === "needs_work" ? "confusion_history" : "my_knowledge"}
                          label={status === "needs_work" ? "Fix it" : "Reinforce"}
                        />
                      )}
                    </div>
                  </div>
                ))}
                {!showAll && items.length > LIMIT && (
                  <button onClick={onShowAll} className="text-[11px] font-medium text-primary hover:underline">
                    Show all {items.length}
                  </button>
                )}
              </div>
            )
          })}
          {c.counts.strong > 0 && (
            <p className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-3.5 w-3.5" /> {c.counts.strong} topic{c.counts.strong === 1 ? "" : "s"} already strong — nice.
            </p>
          )}
        </div>
      )}
    </div>
  )
}

"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ArrowRight, Clock, FileText, Loader2 } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { ApplicationTracker, stageIndex } from "@/components/applications/application-tracker"

interface AppRow {
  id: string
  status: string
  created_at: string
  updated_at: string
  submitted_at: string | null
  screened_at: string | null
  decided_at: string | null
  archived_at: string | null
  opportunities: { title: string; provider: string | null; deadline: string | null } | null
}

const PREVIEW_LIMIT = 3
const isDraft = (s: string) => s === "saved" || s === "in_progress"

function daysUntil(date: string | null): number | null {
  if (!date) return null
  const ms = new Date(date).setHours(23, 59, 59, 999) - Date.now()
  return Math.ceil(ms / 86_400_000)
}

/**
 * Application Dashboard preview for the main dashboard: stage counts, the
 * most recently updated active applications with their progress tracker,
 * and a nudge on unfinished drafts whose deadline is close. The full view
 * (search, filters, archive, actions) stays on /my-applications.
 */
export function ApplicationsPreview() {
  const [apps, setApps] = useState<AppRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/opportunities/applications", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { applications: [] }))
      .then((d) => setApps(d.applications ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  // Same Active definition as the full dashboard: not archived, not withdrawn.
  const active = apps.filter((a) => !a.archived_at && a.status !== "withdrawn")

  const counts = [
    { label: "In progress", value: active.filter((a) => stageIndex(a.status) === 0).length },
    { label: "Submitted", value: active.filter((a) => stageIndex(a.status) === 1).length },
    { label: "Screening", value: active.filter((a) => stageIndex(a.status) === 2).length },
    { label: "Decided", value: active.filter((a) => stageIndex(a.status) === 3).length },
  ]

  // Drafts with the nearest deadline first, then everything else by recency —
  // so something that needs finishing soon is never pushed out of the preview.
  const urgentDraft = (a: AppRow) => {
    const d = daysUntil(a.opportunities?.deadline ?? null)
    return isDraft(a.status) && d !== null && d >= 0 && d <= 14
  }
  const preview = [...active]
    .sort((a, b) => {
      const ua = urgentDraft(a), ub = urgentDraft(b)
      if (ua !== ub) return ua ? -1 : 1
      if (ua && ub) return (daysUntil(a.opportunities?.deadline ?? null) ?? 0) - (daysUntil(b.opportunities?.deadline ?? null) ?? 0)
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    })
    .slice(0, PREVIEW_LIMIT)

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0 pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <FileText className="h-5 w-5 text-primary" />
          Application Dashboard
        </CardTitle>
        <Button asChild variant="ghost" size="sm" className="gap-1 shrink-0">
          <Link href="/my-applications">
            View all <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </Button>
      </CardHeader>

      <CardContent className="space-y-4">
        {loading ? (
          <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading applications…
          </div>
        ) : active.length === 0 ? (
          <div className="space-y-3 py-6 text-center">
            <p className="text-sm text-muted-foreground">
              {apps.length === 0 ? "You haven't started any applications yet." : "No active applications right now."}
            </p>
            <Button asChild size="sm" variant="outline">
              <Link href="/opportunities?type=scholarship">Browse scholarships</Link>
            </Button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {counts.map((c) => (
                <div key={c.label} className="rounded-lg bg-muted/50 px-3 py-2 text-center">
                  <p className="text-xl font-bold">{c.value}</p>
                  <p className="text-[11px] text-muted-foreground">{c.label}</p>
                </div>
              ))}
            </div>

            <div className="space-y-2">
              {preview.map((a) => {
                const draft = isDraft(a.status)
                const days = daysUntil(a.opportunities?.deadline ?? null)
                const dueSoon = draft && days !== null && days >= 0 && days <= 14
                return (
                  <div key={a.id} className="rounded-lg border p-3 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">{a.opportunities?.title ?? "Scholarship"}</p>
                        {a.opportunities?.provider && (
                          <p className="truncate text-xs text-muted-foreground">{a.opportunities.provider}</p>
                        )}
                        {dueSoon && (
                          <p
                            className={cn(
                              "mt-1 inline-flex items-center gap-1 text-xs font-medium",
                              days! <= 3 ? "text-destructive" : "text-amber-600",
                            )}
                          >
                            <Clock className="h-3 w-3" />
                            {days === 0 ? "Due today" : `Due in ${days} day${days === 1 ? "" : "s"}`} — not submitted yet
                          </p>
                        )}
                      </div>
                      <Button asChild size="sm" variant={draft ? "default" : "outline"} className="shrink-0">
                        <Link href={`/applications/${a.id}`}>{draft ? "Continue" : "View"}</Link>
                      </Button>
                    </div>
                    <div className="overflow-x-auto">
                      <ApplicationTracker application={a} compact />
                    </div>
                  </div>
                )
              })}
            </div>

            {active.length > PREVIEW_LIMIT && (
              <p className="text-center text-xs text-muted-foreground">
                +{active.length - PREVIEW_LIMIT} more on your{" "}
                <Link href="/my-applications" className="font-medium text-primary hover:underline">
                  Application Dashboard
                </Link>
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}

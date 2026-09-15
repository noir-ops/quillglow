"use client"

import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Calendar, Check, FileQuestion, FileText, Loader2 } from "lucide-react"

type Target = "planner" | "notes" | "exam"

/**
 * Sends a generated study system into the rest of the app.
 *
 * Practice exams aren't here: they're already read directly from the session
 * by the Practice Exams page, so an "export" would duplicate the same
 * questions into a second place. A link is shown instead.
 */
export function StudyAgentExport({
  sessionId,
  hasPlan,
  hasNotes,
  hasExam,
}: {
  sessionId?: string
  hasPlan: boolean
  hasNotes: boolean
  hasExam: boolean
}) {
  const [busy, setBusy] = useState<Target | null>(null)
  const [done, setDone] = useState<Partial<Record<Target, boolean>>>({})
  const [error, setError] = useState<string | null>(null)

  // Sessions loaded before this feature shipped may predate the id being
  // returned; without it there's nothing to export.
  if (!sessionId) return null

  const run = async (target: Target) => {
    setBusy(target)
    setError(null)
    try {
      const res = await fetch("/api/study-agent/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, target }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || data.error || "Export failed")
      setDone((d) => ({ ...d, [target]: true }))
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong")
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="rounded-xl border border-border/60 bg-muted/20 p-4 space-y-3">
      <div>
        <p className="text-sm font-semibold">Use this in your account</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          Send what was generated into the app so you can work with it like anything else you made.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        {hasPlan && (
          <Button
            variant={done.planner ? "outline" : "default"}
            size="sm"
            onClick={() => run("planner")}
            disabled={busy !== null || done.planner}
            className="gap-2 justify-start sm:justify-center"
          >
            {busy === "planner" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : done.planner ? (
              <Check className="h-4 w-4" />
            ) : (
              <Calendar className="h-4 w-4" />
            )}
            {done.planner ? "Added to Study Plan" : "Send plan to Study Plan"}
          </Button>
        )}

        {hasNotes && (
          <Button
            variant={done.notes ? "outline" : "default"}
            size="sm"
            onClick={() => run("notes")}
            disabled={busy !== null || done.notes}
            className="gap-2 justify-start sm:justify-center"
          >
            {busy === "notes" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : done.notes ? (
              <Check className="h-4 w-4" />
            ) : (
              <FileText className="h-4 w-4" />
            )}
            {done.notes ? "Saved to Notes" : "Save notes to Notes"}
          </Button>
        )}

        {hasExam && (
          <Button
            variant={done.exam ? "outline" : "default"}
            size="sm"
            onClick={() => run("exam")}
            disabled={busy !== null || done.exam}
            className="gap-2 justify-start sm:justify-center"
          >
            {busy === "exam" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : done.exam ? (
              <Check className="h-4 w-4" />
            ) : (
              <FileQuestion className="h-4 w-4" />
            )}
            {done.exam ? "Added to Practice Exams" : "Send exam to Practice Exams"}
          </Button>
        )}
      </div>

      {(done.planner || done.notes || done.exam) && (
        <div className="flex flex-wrap gap-3 text-xs">
          {done.planner && (
            <Link href="/planner" className="text-primary font-medium hover:underline">
              Open Study Plan →
            </Link>
          )}
          {done.notes && (
            <Link href="/notes" className="text-primary font-medium hover:underline">
              Open Notes →
            </Link>
          )}
          {done.exam && (
            <Link href="/exam-generator" className="text-primary font-medium hover:underline">
              Open Practice Exams →
            </Link>
          )}
        </div>
      )}

      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}

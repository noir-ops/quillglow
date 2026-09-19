"use client"

import { useEffect, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2 } from "lucide-react"
import { ApplyDialog } from "./apply-dialog"

interface Match {
  opportunity_id: string
  title: string
  provider: string | null
  opportunity_type: string
  award_amount: number | null
  deadline: string | null
  match_score: number
  reasons: { strong_concepts: number; exam_readiness: number; days_left: number | null; subject_match: string[] | null }
}

export function OpportunityList({ type }: { type?: string } = {}) {
  const [matches, setMatches] = useState<Match[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [saved, setSaved] = useState<Set<string>>(new Set())
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/opportunities/match${type ? `?type=${encodeURIComponent(type)}` : ""}`)
      .then(async (r) => {
        const body = await r.json()
        // A non-2xx response used to be swallowed identically to a genuine
        // zero-match result — "eligible for nothing yet" and "the matching
        // engine broke" rendered as the exact same message. Now they don't.
        if (!r.ok) throw new Error(body.error ?? "Failed to load opportunities")
        setMatches(body.matches ?? [])
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load opportunities"))
      .finally(() => setLoading(false))
  }, [type])

  const save = async (id: string) => {
    setSaving(id)
    try {
      await fetch("/api/opportunities/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ opportunityId: id, status: "saved" }),
      })
      setSaved((s) => new Set(s).add(id))
    } finally {
      setSaving(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Finding opportunities…
      </div>
    )
  }

  if (error) {
    return (
      <Card className="border-destructive/40 bg-destructive/5">
        <CardContent className="p-6 text-sm">
          <p className="font-medium text-destructive">Couldn't load opportunities</p>
          <p className="mt-1 text-muted-foreground">{error}</p>
        </CardContent>
      </Card>
    )
  }

  if (matches.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-muted-foreground">
          No matches yet. Completing your profile is the fastest way to surface opportunities — it&apos;s
          the largest single factor in matching.
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-3">
      {matches.map((m) => (
        <Card key={m.opportunity_id}>
          <CardHeader className="pb-2">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <CardTitle className="text-base">{m.title}</CardTitle>
                {m.provider && <p className="text-xs text-muted-foreground">{m.provider}</p>}
              </div>
              <Badge variant={m.match_score >= 60 ? "default" : "secondary"}>
                {Math.round(m.match_score)}% match
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-2 text-xs">
              {m.award_amount != null && (
                <Badge variant="outline">${m.award_amount.toLocaleString()}</Badge>
              )}
              {m.reasons.days_left != null && (
                <Badge variant={m.reasons.days_left <= 30 ? "destructive" : "outline"}>
                  {m.reasons.days_left} days left
                </Badge>
              )}
              {m.reasons.strong_concepts > 0 && (
                <Badge variant="outline">
                  {m.reasons.strong_concepts} matching strength{m.reasons.strong_concepts > 1 ? "s" : ""}
                </Badge>
              )}
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant={saved.has(m.opportunity_id) ? "secondary" : "outline"}
                disabled={saving === m.opportunity_id}
                onClick={() => save(m.opportunity_id)}
              >
                {saving === m.opportunity_id ? "Saving…" : saved.has(m.opportunity_id) ? "Saved" : "Save for later"}
              </Button>
              {/* The real application step — essay + documents + a validated
                  submit, not just a bookmark. */}
              <ApplyDialog opportunityId={m.opportunity_id}>
                <Button size="sm">Apply</Button>
              </ApplyDialog>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

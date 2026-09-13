"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"

interface Score {
  score_type: string
  scope: string
  value: number
  breakdown: Record<string, any>
  computed_at: string
}

const LABELS: Record<string, { name: string; hint: string; inverted?: boolean }> = {
  exam_readiness: { name: "Exam Readiness", hint: "How prepared you are for your exam" },
  learning_risk: { name: "Learning Risk", hint: "Lower is better", inverted: true },
  scholarship_readiness: { name: "Scholarship Readiness", hint: "How ready you are to win funding" },
  opportunity: { name: "Opportunity Score", hint: "Strength of your current pipeline" },
  consistency: { name: "Consistency", hint: "How regularly you study" },
  growth: { name: "Growth", hint: "Whether you're improving over time" },
}

function tone(value: number, inverted?: boolean) {
  const v = inverted ? 100 - value : value
  if (v >= 70) return "text-emerald-600"
  if (v >= 40) return "text-amber-600"
  return "text-rose-600"
}

export function IntelligenceScores({ filter }: { filter?: string[] } = {}) {
  const [scores, setScores] = useState<Score[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/learning-graph/scores")
      .then((r) => r.json())
      .then((d) => setScores(d.scores ?? []))
      .catch(() => setScores([]))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return <div className="text-sm text-muted-foreground">Loading your scores…</div>
  }

  const known = scores
    .filter((s) => LABELS[s.score_type])
    // Prepare shows only exam-facing scores; Grow shows all of them.
    .filter((s) => !filter || filter.includes(s.score_type))

  // Be honest about an empty state rather than showing zeros that look like failure.
  if (known.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Your scores</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Take a mock exam or work through a tutor session and your scores will appear here.
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {known.map((s) => {
        const meta = LABELS[s.score_type]
        return (
          <Card key={`${s.score_type}:${s.scope}`}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium">{meta.name}</CardTitle>
                {s.scope !== "global" && (
                  <Badge variant="secondary" className="text-[10px]">
                    {s.scope}
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className={`text-3xl font-bold ${tone(s.value, meta.inverted)}`}>
                {Math.round(s.value)}
                <span className="text-base font-normal text-muted-foreground">/100</span>
              </div>
              <Progress value={s.value} className="h-1.5" />
              <p className="text-xs text-muted-foreground">{meta.hint}</p>
              {/* Breakdown is what makes a score explainable rather than a black box. */}
              {s.breakdown && Object.keys(s.breakdown).length > 0 && (
                <ul className="pt-1 text-xs text-muted-foreground">
                  {Object.entries(s.breakdown)
                    .slice(0, 3)
                    .map(([k, v]) => (
                      <li key={k} className="flex justify-between">
                        <span>{k.replace(/_/g, " ")}</span>
                        <span className="font-medium">{String(v)}</span>
                      </li>
                    ))}
                </ul>
              )}
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}

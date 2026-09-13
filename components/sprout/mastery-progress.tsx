"use client"

import { useEffect, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { Loader2 } from "lucide-react"

interface Mastery {
  concept_id: string
  mastery: number
  confidence: number
  state: string
  evidence_count: number
  learning_concepts?: { name?: string; subject?: string }
}

const STATE_LABEL: Record<string, { label: string; variant: any }> = {
  mastered: { label: "Mastered", variant: "default" },
  review: { label: "Review soon", variant: "secondary" },
  weak: { label: "Needs work", variant: "destructive" },
  learning: { label: "Learning", variant: "outline" },
}

/** Topic-level progress — the retrospective view that makes Grow distinct. */
export function MasteryProgress() {
  const [items, setItems] = useState<Mastery[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/learning-graph/mastery")
      .then((r) => r.json())
      .then((d) => setItems(d.mastery ?? []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading your progress…
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-muted-foreground">
          No topic data yet. Take a mock exam or work through a tutor session and your
          topic-by-topic progress will build up here.
        </CardContent>
      </Card>
    )
  }

  const mastered = items.filter((i) => i.state === "mastered").length

  return (
    <div className="space-y-3">
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">Topics mastered</span>
            <span className="text-muted-foreground">
              {mastered} of {items.length}
            </span>
          </div>
          <Progress value={(mastered / items.length) * 100} className="mt-2 h-1.5" />
        </CardContent>
      </Card>

      <div className="space-y-2">
        {items.slice(0, 20).map((m) => {
          const meta = STATE_LABEL[m.state] ?? STATE_LABEL.learning
          return (
            <Card key={m.concept_id}>
              <CardContent className="flex items-center justify-between gap-3 p-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {m.learning_concepts?.name ?? "Topic"}
                  </p>
                  {m.learning_concepts?.subject && (
                    <p className="text-xs text-muted-foreground">{m.learning_concepts.subject}</p>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span className="text-xs text-muted-foreground">
                    {Math.round(Number(m.mastery) * 100)}%
                  </span>
                  <Badge variant={meta.variant} className="text-[10px]">
                    {meta.label}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}

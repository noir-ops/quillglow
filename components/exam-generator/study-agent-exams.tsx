"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ChevronDown, ChevronUp, FileQuestion, Loader2, Sparkles } from "lucide-react"

interface SavedExam {
  sessionId: string
  title: string
  subject: string | null
  questionCount: number
  createdAt: string
  exam: any
}

/**
 * Practice exams the Study Agent already produced.
 *
 * These are read straight from saved sessions — no regeneration, no AI call,
 * so opening one is instant and free. Before this they were written to the
 * database on every Study Agent run and never shown again.
 */
export function StudyAgentExams() {
  const [exams, setExams] = useState<SavedExam[]>([])
  const [loading, setLoading] = useState(true)
  const [openId, setOpenId] = useState<string | null>(null)

  useEffect(() => {
    fetch("/api/study-agent/exams", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setExams(d.exams ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading your saved exams…
        </CardContent>
      </Card>
    )
  }

  // Nothing to show rather than an empty shell — the generator above is the
  // next step either way.
  if (exams.length === 0) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="h-4 w-4 text-primary" />
          From your Study Agent
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Practice exams already generated in past sessions — saved automatically, free to revisit.
        </p>
      </CardHeader>

      <CardContent className="space-y-2">
        {exams.map((e) => {
          const open = openId === e.sessionId
          const questions = e.exam?.questions ?? []

          return (
            <div key={e.sessionId} className="rounded-lg border">
              <button
                type="button"
                onClick={() => setOpenId(open ? null : e.sessionId)}
                aria-expanded={open}
                className="flex w-full items-center justify-between gap-3 p-3 text-left transition-colors hover:bg-accent/40"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{e.title}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    {e.subject && (
                      <Badge variant="outline" className="text-[11px] capitalize">
                        {e.subject}
                      </Badge>
                    )}
                    <span className="text-xs text-muted-foreground">
                      {e.questionCount} question{e.questionCount === 1 ? "" : "s"} ·{" "}
                      {new Date(e.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
                {open ? (
                  <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                )}
              </button>

              {open && (
                <div className="space-y-3 border-t p-3">
                  {questions.length === 0 ? (
                    <p className="text-sm text-muted-foreground">This exam has no questions saved.</p>
                  ) : (
                    questions.map((q: any, i: number) => (
                      <div key={i} className="rounded-md bg-muted/40 p-3">
                        <p className="text-sm font-medium">
                          {i + 1}. {q.question ?? q.prompt ?? "Untitled question"}
                        </p>

                        {Array.isArray(q.options) && q.options.length > 0 && (
                          <ul className="mt-2 space-y-1">
                            {q.options.map((o: string, j: number) => (
                              <li key={j} className="text-sm text-muted-foreground">
                                {String.fromCharCode(65 + j)}. {o}
                              </li>
                            ))}
                          </ul>
                        )}

                        {(q.answer ?? q.correctAnswer) && (
                          <p className="mt-2 text-sm">
                            <span className="font-medium text-emerald-600 dark:text-emerald-400">Answer: </span>
                            {q.answer ?? q.correctAnswer}
                          </p>
                        )}

                        {q.explanation && (
                          <p className="mt-1 text-xs text-muted-foreground">{q.explanation}</p>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}

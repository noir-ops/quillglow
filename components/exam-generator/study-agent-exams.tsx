"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ChevronDown, ChevronUp, Loader2, Sparkles, PlayCircle, Trash2 } from "lucide-react"
import { MockExamInterface } from "@/components/exam-generator/mock-exam-interface"

interface SavedQuestion {
  question: string
  options: string[]
  correctAnswer: string
  explanation: string
  difficulty?: string
}

interface SavedExam {
  sessionId: string
  title: string
  subject: string | null
  questionCount: number
  createdAt: string
  exam: { questions: SavedQuestion[] }
}

/**
 * Saved practice exams — from the Study Agent or from mock exam generation.
 *
 * Previously this only revealed answers on expand: no way to actually
 * attempt the paper and get a real score. "Take Exam" now launches the same
 * MockExamInterface the timed generator uses, in its existing retake mode —
 * client-graded, saved as a fresh mock_exam_attempts row (so retakes build a
 * real history instead of overwriting each other), full results screen with
 * a detailed per-question review.
 *
 * "Preview answers" stays as a lighter option for someone who just wants to
 * check a fact without sitting the whole paper.
 */
export function StudyAgentExams({
  endpoint = "/api/study-agent/exams",
  title = "From your Study Agent",
  description = "Practice exams already generated in past sessions — saved automatically, free to revisit.",
  // Only mock exams are deletable from this list. Study Agent exams live on
  // a session that also holds the plan/notes/flashcards — deleting "just the
  // exam" would need a partial update, not a row delete, and the session
  // itself is already deletable from the Study Agent history panel.
  deleteEndpoint,
}: {
  endpoint?: string
  title?: string
  description?: string
  deleteEndpoint?: string
} = {}) {
  const [exams, setExams] = useState<SavedExam[]>([])
  const [loading, setLoading] = useState(true)
  const [openId, setOpenId] = useState<string | null>(null)
  const [takingExam, setTakingExam] = useState<SavedExam | null>(null)
  // Forces MockExamInterface to remount with a clean attemptId each time,
  // rather than reusing state from a previous attempt of the same exam.
  const [attemptKey, setAttemptKey] = useState(0)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  useEffect(() => {
    fetch(endpoint, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setExams(d.exams ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [endpoint])

  const startExam = (exam: SavedExam) => {
    setAttemptKey((k) => k + 1)
    setTakingExam(exam)
    setOpenId(null)
  }

  const deleteExam = async (sessionId: string) => {
    if (!deleteEndpoint) return
    if (!confirm("Delete this exam? This can't be undone.")) return
    setDeletingId(sessionId)
    try {
      const res = await fetch(`${deleteEndpoint}?id=${sessionId}`, { method: "DELETE" })
      if (!res.ok) throw new Error()
      setExams((prev) => prev.filter((e) => e.sessionId !== sessionId))
    } catch {
      alert("Could not delete that exam.")
    } finally {
      setDeletingId(null)
    }
  }

  // Taking / reviewing an exam replaces the list entirely — a results screen
  // sitting inside a collapsed accordion row would be cramped and easy to
  // miss.
  if (takingExam) {
    const questions = takingExam.exam.questions.map((q, i) => ({
      id: i,
      question: q.question,
      options: q.options,
      difficulty: q.difficulty,
    }))

    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">{takingExam.title}</CardTitle>
          <Button variant="outline" size="sm" onClick={() => setTakingExam(null)}>
            Back to list
          </Button>
        </CardHeader>
        <CardContent>
          <MockExamInterface
            // A fresh id per attempt (not tied to the saved exam's own id) —
            // this reuses the retake code path, which grades locally and
            // saves the result as a NEW mock_exam_attempts row, so retaking
            // the same paper twice produces two separate scored attempts
            // rather than overwriting one.
            key={attemptKey}
            attemptId={`retake-${Date.now()}`}
            questions={questions}
            totalQuestions={questions.length}
            originalQuestions={takingExam.exam.questions}
            onExit={() => setTakingExam(null)}
          />
        </CardContent>
      </Card>
    )
  }

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
          {title}
        </CardTitle>
        <p className="text-sm text-muted-foreground">{description}</p>
      </CardHeader>

      <CardContent className="space-y-2">
        {exams.map((e) => {
          const open = openId === e.sessionId
          const questions = e.exam?.questions ?? []

          return (
            <div key={e.sessionId} className="rounded-lg border">
              <div className="flex items-center justify-between gap-3 p-3">
                <button
                  type="button"
                  onClick={() => setOpenId(open ? null : e.sessionId)}
                  aria-expanded={open}
                  className="flex-1 min-w-0 text-left"
                >
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
                </button>

                <div className="flex items-center gap-1.5 shrink-0">
                  <Button size="sm" onClick={() => startExam(e)} className="gap-1.5">
                    <PlayCircle className="h-3.5 w-3.5" />
                    Take Exam
                  </Button>
                  {deleteEndpoint && (
                    <button
                      type="button"
                      onClick={() => deleteExam(e.sessionId)}
                      disabled={deletingId === e.sessionId}
                      aria-label="Delete this exam"
                      className="p-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50"
                    >
                      {deletingId === e.sessionId
                        ? <Loader2 className="h-4 w-4 animate-spin" />
                        : <Trash2 className="h-4 w-4" />}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setOpenId(open ? null : e.sessionId)}
                    aria-expanded={open}
                    aria-label="Preview answers"
                    className="p-2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {open && (
                <div className="space-y-3 border-t p-3">
                  <p className="text-xs text-muted-foreground -mt-1">
                    Answers shown for reference only — use{" "}
                    <span className="font-medium text-foreground">Take Exam</span> above for a scored attempt.
                  </p>
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

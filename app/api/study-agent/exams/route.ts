import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

/**
 * Practice exams the Study Agent has already generated.
 *
 * Every Study Agent run produces a practice exam and stores it on the session
 * row (`study_agent_sessions.generated_exam`) — they were just never surfaced
 * anywhere, so learners regenerated work they already had. This reads them
 * back; nothing is generated here and no AI call is made, so revisiting a past
 * exam costs nothing and is effectively cached by virtue of already existing.
 */
export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data, error } = await supabase
    .from("study_agent_sessions")
    .select("id, input_text, subject, generated_exam, created_at")
    .eq("user_id", user.id)
    .not("generated_exam", "is", null)
    .order("created_at", { ascending: false })
    .limit(25)

  if (error) {
    console.error("[study-agent-exams] read failed:", error.message)
    return NextResponse.json({ error: "Could not load saved exams" }, { status: 500 })
  }

  const exams = (data ?? [])
    .map((row: any) => {
      // BUG FIXED: this read row.generated_exam?.questions, but the Study
      // Agent actually saves { mcqs, shortAnswer, totalMarks } — "questions"
      // never existed on that object, so questionCount was always 0 and
      // every session got filtered out below. This list has been silently
      // empty since it shipped.
      const mcqs: any[] = Array.isArray(row.generated_exam?.mcqs) ? row.generated_exam.mcqs : []

      // Also converts correctIndex (0-3, how the Study Agent stores it) into
      // correctAnswer as a LETTER, matching mock_exam_attempts' shape — this
      // is what lets the same retake/grading UI handle both sources.
      const questions = mcqs
        .filter((q: any) => q?.question && Array.isArray(q?.options) && q.options.length > 0)
        .map((q: any) => {
          const idx = Number(q?.correctIndex)
          const safeIdx = Number.isInteger(idx) && idx >= 0 && idx < q.options.length ? idx : 0
          return {
            question: String(q.question),
            options: q.options.map((o: any) => String(o)),
            correctAnswer: String.fromCharCode(65 + safeIdx),
            explanation: q?.explanation ? String(q.explanation) : "",
            difficulty: q?.difficulty ?? "medium",
          }
        })

      return {
        sessionId: row.id,
        // input_text is the learner's original prompt — the most recognisable
        // label for "which exam was this".
        title: (row.input_text ?? "").slice(0, 80) || "Untitled study session",
        subject: row.subject ?? null,
        questionCount: questions.length,
        createdAt: row.created_at,
        exam: { questions },
      }
    })
    // A session can exist with an empty exam object if generation partly
    // failed; showing a 0-question exam would be a dead end.
    .filter((e) => e.questionCount > 0)

  return NextResponse.json({ exams })
}

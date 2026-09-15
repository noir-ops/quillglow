import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

/**
 * Mock exams the learner has generated, exposed for UNTIMED review inside
 * Practice Exams.
 *
 * The questions already live on `mock_exam_attempts` — they were only ever
 * reachable through the timed sitting flow, so a learner couldn't go back and
 * study the paper afterwards without starting another clock. This reads them
 * back with answers and explanations attached; no timer, no grading, no AI
 * call, so revisiting costs nothing.
 */
export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data, error } = await supabase
    .from("mock_exam_attempts")
    .select("id, questions, difficulty, total_questions, created_at, subject, syllabus")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(25)

  if (error) {
    console.error("[mock-exam/saved] read failed:", error.message)
    return NextResponse.json({ error: "Could not load saved mock exams" }, { status: 500 })
  }

  const exams = (data ?? [])
    .map((row: any) => ({
      sessionId: row.id,
      title: [row.subject, row.syllabus && `(${row.syllabus})`].filter(Boolean).join(" ") || "Mock MCQ Exam",
      subject: row.subject ?? null,
      questionCount: Array.isArray(row.questions) ? row.questions.length : 0,
      createdAt: row.created_at,
      difficulty: row.difficulty ?? null,
      // Normalised into the same shape the Study Agent exams use, so one
      // component can render both without branching.
      exam: { questions: row.questions ?? [] },
    }))
    .filter((e) => e.questionCount > 0)

  return NextResponse.json({ exams })
}

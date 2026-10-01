import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

/**
 * Records a practice exam's MCQ result once every question has been
 * answered. Feeds the combined Mock Exam Score (see
 * app/api/learning-graph/scores/route.ts).
 */
export async function POST(req: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  let body: { correct?: number; total?: number; subject?: string | null; examId?: string | null }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const total = Math.round(Number(body.total))
  const correct = Math.round(Number(body.correct))
  if (!Number.isFinite(total) || total <= 0 || !Number.isFinite(correct) || correct < 0 || correct > total) {
    return NextResponse.json({ error: "Invalid score" }, { status: 400 })
  }

  const { error } = await supabase.from("practice_exam_scores").insert({
    user_id: user.id,
    generated_exam_id: body.examId || null,
    subject: body.subject || null,
    correct_count: correct,
    total_count: total,
    score_percentage: Math.round((correct / total) * 10000) / 100,
  })

  if (error) {
    console.error("[practice-exam/score] insert failed:", error.message)
    return NextResponse.json({ error: "Could not save score", detail: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

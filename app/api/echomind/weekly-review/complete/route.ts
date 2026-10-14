import { NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase/server"
import { generateWeeklyReviewFeedback } from "@/lib/services/study-coach"

export const dynamic = "force-dynamic"

/**
 * Called after a weekly review test has been graded (by PUT /api/mock-exam).
 *
 * With a goalId: marks that weekly review done in the study plan AND on the
 * planner calendar, then generates next-week feedback using the real test
 * score. Safe to call twice — feedback for the same test is returned, not
 * regenerated.
 */
export async function POST(req: Request) {
  try {
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const body = await req.json().catch(() => ({}))
    const attemptId: string | null = typeof body?.attemptId === "string" ? body.attemptId : null
    const goalId: string | null = typeof body?.goalId === "string" ? body.goalId : null
    if (!attemptId) return NextResponse.json({ error: "attemptId is required" }, { status: 400 })

    const { data: attempt } = await supabase
      .from("mock_exam_attempts")
      .select("id, status, score_percentage")
      .eq("id", attemptId)
      .eq("user_id", user.id)
      .maybeSingle()
    if (!attempt) return NextResponse.json({ error: "Test not found" }, { status: 404 })
    if (attempt.status !== "completed") return NextResponse.json({ error: "This test hasn't been submitted yet" }, { status: 400 })

    const score = attempt.score_percentage != null ? Number(attempt.score_percentage) : null
    if (!goalId) return NextResponse.json({ score, feedback: null })

    const { data: goal } = await supabase
      .from("study_plan_goals")
      .select("id, plan_id, due_date, is_review, study_plans!inner(user_id)")
      .eq("id", goalId)
      .eq("study_plans.user_id", user.id)
      .maybeSingle()
    if (!goal) return NextResponse.json({ error: "Weekly review not found" }, { status: 404 })

    // Idempotent: this test already produced feedback.
    const { data: existing } = await supabase
      .from("study_plan_review_feedback")
      .select("*")
      .eq("user_id", user.id)
      .eq("attempt_id", attemptId)
      .maybeSingle()
    if (existing) return NextResponse.json({ score, feedback: existing })

    const now = new Date().toISOString()
    await supabase.from("study_plan_goals").update({ completed: true, completed_at: now, updated_at: now }).eq("id", goal.id)
    const { data: task } = await supabase
      .from("tasks")
      .update({ completed: true, completed_at: now, updated_at: now })
      .eq("plan_goal_id", goal.id)
      .eq("user_id", user.id)
      .select("id")
      .maybeSingle()

    const feedback = await generateWeeklyReviewFeedback({
      supabase,
      userId: user.id,
      planId: goal.plan_id,
      reviewTaskId: task?.id ?? null,
      reviewDueDate: goal.due_date,
      scorePercentage: score,
      attemptId,
    }).catch((err) => {
      console.error("[weekly-review/complete] feedback failed:", err)
      return null
    })

    return NextResponse.json({ score, feedback })
  } catch (error) {
    console.error("[echomind/weekly-review/complete]", error)
    return NextResponse.json({ error: "Could not complete the weekly review" }, { status: 500 })
  }
}

import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { generateWeeklyReviewFeedback } from "@/lib/services/study-coach"

export const dynamic = "force-dynamic"

/**
 * Updates one task — completion, due date, estimated hours, or title.
 *
 * If the task was mirrored from a study plan goal (plan_goal_id set), the
 * matching study_plan_goals row is updated too, so completing or rescheduling
 * a task on the calendar stays consistent with what "My Study Plans" shows,
 * and vice versa (see app/api/study-plans/goals/toggle/route.ts, which does
 * the same in the other direction).
 *
 * Completing a task flagged is_review kicks off the weekly review feedback
 * flow — see generateWeeklyReviewFeedback in lib/services/study-coach.
 */
// params is a Promise in Next.js 16. This handler used to read it as a plain
// object, so params.id was always undefined and EVERY task update failed:
// ticking a task complete, editing its date/hours, completing a weekly review.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  let body: {
    completed?: boolean
    due_date?: string | null
    estimated_hours?: number | null
    title?: string
    description?: string | null
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const updates: Record<string, unknown> = {}
  if (typeof body.completed === "boolean") {
    updates.completed = body.completed
    updates.completed_at = body.completed ? new Date().toISOString() : null
  }
  if (body.due_date !== undefined) updates.due_date = body.due_date
  if (body.estimated_hours !== undefined) updates.estimated_hours = body.estimated_hours
  if (body.title !== undefined) updates.title = body.title
  if (body.description !== undefined) updates.description = body.description

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 })
  }
  updates.updated_at = new Date().toISOString()

  const { data: task, error } = await supabase
    .from("tasks")
    .update(updates)
    .eq("id", id)
    .eq("user_id", user.id)
    .select("id, plan_goal_id, plan_id, is_review, completed, due_date")
    .maybeSingle()

  if (error || !task) {
    console.error("[tasks/patch] update failed:", error?.message)
    return NextResponse.json({ error: "Could not update task", detail: error?.message }, { status: 500 })
  }

  // Keep the source goal in sync. Best-effort: the task itself already
  // saved, so a sync failure here is logged but doesn't fail the request.
  if (task.plan_goal_id) {
    const goalUpdates: Record<string, unknown> = {}
    if (updates.completed !== undefined) {
      goalUpdates.completed = updates.completed
      goalUpdates.completed_at = updates.completed_at
    }
    if (updates.due_date !== undefined) goalUpdates.due_date = updates.due_date
    if (updates.estimated_hours !== undefined) goalUpdates.estimated_hours = updates.estimated_hours
    if (updates.title !== undefined) goalUpdates.title = updates.title
    if (updates.description !== undefined) goalUpdates.description = updates.description
    if (Object.keys(goalUpdates).length > 0) {
      goalUpdates.updated_at = new Date().toISOString()
      const { error: goalError } = await supabase
        .from("study_plan_goals")
        .update(goalUpdates)
        .eq("id", task.plan_goal_id)
      if (goalError) console.error("[tasks/patch] goal sync failed:", goalError.message)
    }
  }

  let reviewFeedback: unknown = null
  if (task.is_review && body.completed === true && task.plan_id) {
    reviewFeedback = await generateWeeklyReviewFeedback({
      supabase,
      userId: user.id,
      planId: task.plan_id,
      reviewTaskId: task.id,
      reviewDueDate: task.due_date,
    }).catch((err) => {
      console.error("[tasks/patch] weekly review generation failed:", err)
      return null
    })
  }

  return NextResponse.json({ ok: true, task, reviewFeedback })
}

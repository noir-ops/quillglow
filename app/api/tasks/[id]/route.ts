import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

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
 * flow — see triggerWeeklyReview below.
 */
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
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
    .eq("id", params.id)
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
    reviewFeedback = await triggerWeeklyReview({
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

/**
 * Gathers the completed week's goals for this plan, asks the model what to
 * reinforce next week based on what was and wasn't finished, and stores the
 * result — this is the "propose plan/subject updates" half of the weekly
 * review requirement. Never rewrites the plan itself; only proposes.
 */
async function triggerWeeklyReview({
  supabase,
  userId,
  planId,
  reviewTaskId,
  reviewDueDate,
}: {
  supabase: any
  userId: string
  planId: string
  reviewTaskId: string
  reviewDueDate: string | null
}) {
  const { data: plan } = await supabase.from("study_plans").select("subject, start_date").eq("id", planId).maybeSingle()

  // The reviewed week is the 7 days ending on the review task's own due date.
  const weekEnd = reviewDueDate ? new Date(reviewDueDate) : new Date()
  const weekStart = new Date(weekEnd)
  weekStart.setDate(weekStart.getDate() - 6)

  const { data: weekGoals } = await supabase
    .from("study_plan_goals")
    .select("title, description, priority, completed, due_date")
    .eq("plan_id", planId)
    .eq("is_review", false)
    .gte("due_date", weekStart.toISOString().slice(0, 10))
    .lte("due_date", weekEnd.toISOString().slice(0, 10))
    .order("due_date")

  const goals = weekGoals ?? []
  const completed = goals.filter((g: any) => g.completed)
  const missed = goals.filter((g: any) => !g.completed)
  const weekNumber =
    plan?.start_date && reviewDueDate
      ? Math.floor((new Date(reviewDueDate).getTime() - new Date(plan.start_date).getTime()) / (7 * 86400000)) + 1
      : 1

  let suggestions: any[] = []
  try {
    const { aiChatCompletion, isAIConfigured } = await import("@/lib/ai/provider")
    if (await isAIConfigured()) {
      const prompt = `A student just completed their weekly review for ${plan?.subject ?? "their studies"}.

Completed this week (${completed.length}/${goals.length}):
${completed.map((g: any) => `- ${g.title}`).join("\n") || "(none)"}

NOT completed this week:
${missed.map((g: any) => `- ${g.title} (priority: ${g.priority})`).join("\n") || "(none — full week completed)"}

Based on what was and wasn't finished, suggest what to focus on next week. Return ONLY JSON:
{ "suggestions": [ { "topic": "", "reason": "", "action": "review again | catch up | move on | extra practice" } ] }
Give at most 5 suggestions. If everything was completed, suggest moving forward and one light reinforcement item.`

      const response = await aiChatCompletion(
        {
          messages: [
            { role: "system", content: "You are a study coach analysing a week of completed and missed tasks. Return only valid JSON." },
            { role: "user", content: prompt },
          ],
          temperature: 0.5,
          max_tokens: 600,
        },
        { task: "summarization", agent: "study_ai", cacheable: false },
      )
      if (response.ok) {
        const data = await response.json()
        const raw = data.choices?.[0]?.message?.content?.trim() ?? "{}"
        const cleaned = raw.replace(/^```json\s*/i, "").replace(/```\s*$/, "")
        suggestions = JSON.parse(cleaned)?.suggestions ?? []
      }
    }
  } catch (err) {
    console.error("[weekly-review] AI suggestion generation failed:", err)
  }

  const { data: feedback, error: feedbackError } = await supabase
    .from("study_plan_review_feedback")
    .insert({
      plan_id: planId,
      review_task_id: reviewTaskId,
      user_id: userId,
      week_number: weekNumber,
      completed_count: completed.length,
      total_count: goals.length,
      suggestions,
    })
    .select()
    .single()

  if (feedbackError) {
    console.error("[weekly-review] could not save feedback:", feedbackError.message)
    return { weekNumber, completedCount: completed.length, totalCount: goals.length, suggestions }
  }

  return feedback
}

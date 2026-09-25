import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { goalId, completed } = await request.json()

    const { data: goal, error } = await supabase
      .from("study_plan_goals")
      .update({
        completed,
        completed_at: completed ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", goalId)
      .select("id")
      .maybeSingle()

    if (error) throw error

    // Sync the mirrored task (see scripts/061_planner_calendar_sync.sql) so
    // completing a goal here also reflects on the calendar. Best-effort —
    // the goal itself already saved, so a sync miss is logged, not fatal.
    if (goal) {
      const { error: taskSyncError } = await supabase
        .from("tasks")
        .update({
          completed,
          completed_at: completed ? new Date().toISOString() : null,
          updated_at: new Date().toISOString(),
        })
        .eq("plan_goal_id", goalId)
        .eq("user_id", user.id)
      if (taskSyncError) console.error("[v0] Task sync failed:", taskSyncError.message)
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("[v0] Error toggling goal:", error)
    return NextResponse.json({ error: error.message || "Failed to toggle goal" }, { status: 500 })
  }
}

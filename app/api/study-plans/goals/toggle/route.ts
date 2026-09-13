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

    const { error } = await supabase
      .from("study_plan_goals")
      .update({
        completed,
        completed_at: completed ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", goalId)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("[v0] Error toggling goal:", error)
    return NextResponse.json({ error: error.message || "Failed to toggle goal" }, { status: 500 })
  }
}

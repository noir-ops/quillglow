import { createServerClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function POST(request: Request) {
  try {
    const supabase = await createServerClient()
    const { planId, title, description, priority, dueDate, estimatedHours } = await request.json()

    // Validate required fields
    if (!planId || !title) {
      return NextResponse.json({ error: "Plan ID and title are required" }, { status: 400 })
    }

    // Check authentication
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Verify user owns the plan
    const { data: plan } = await supabase
      .from("study_plans")
      .select("id")
      .eq("id", planId)
      .eq("user_id", user.id)
      .single()

    if (!plan) {
      return NextResponse.json({ error: "Plan not found or access denied" }, { status: 404 })
    }

    // Insert the new goal
    const { data: goal, error } = await supabase
      .from("study_plan_goals")
      .insert({
        plan_id: planId,
        title,
        description: description || null,
        priority: priority || "medium",
        due_date: dueDate || null,
        estimated_hours: estimatedHours || null,
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ goal })
  } catch (error: any) {
    console.error("[v0] Add goal error:", error)
    return NextResponse.json({ error: error.message || "Failed to add goal" }, { status: 500 })
  }
}

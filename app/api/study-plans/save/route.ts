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

    const body = await request.json()
    const { plan, goals } = body

    // Insert study plan
    const { data: studyPlan, error: planError } = await supabase
      .from("study_plans")
      .insert({
        user_id: user.id,
        title: plan.title,
        subject: plan.subject,
        start_date: plan.startDate,
        end_date: plan.endDate,
        duration: plan.duration,
        goals_text: plan.goals,
        tips: plan.tips,
      })
      .select()
      .single()

    if (planError) throw planError

    // Insert goals
    if (goals && goals.length > 0) {
      const goalsToInsert = goals.map((goal: any) => ({
        plan_id: studyPlan.id,
        title: goal.title,
        description: goal.description,
        priority: goal.priority,
        due_date: goal.dueDate,
        estimated_hours: goal.estimatedHours,
      }))

      const { error: goalsError } = await supabase.from("study_plan_goals").insert(goalsToInsert)

      if (goalsError) throw goalsError
    }

    return NextResponse.json({ success: true, planId: studyPlan.id })
  } catch (error: any) {
    console.error("[v0] Error saving study plan:", error)
    return NextResponse.json({ error: error.message || "Failed to save study plan" }, { status: 500 })
  }
}

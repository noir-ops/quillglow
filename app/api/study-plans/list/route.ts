import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const filter = searchParams.get("filter") || "upcoming"

    // Fetch study plans with goals
    const { data: plans, error } = await supabase
      .from("study_plans")
      .select(`
        *,
        goals:study_plan_goals(*)
      `)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })

    if (error) throw error

    // Calculate progress for each plan
    const plansWithProgress = plans.map((plan: any) => {
      const totalGoals = plan.goals?.length || 0
      const completedGoals = plan.goals?.filter((g: any) => g.completed).length || 0
      const progress = totalGoals > 0 ? Math.round((completedGoals / totalGoals) * 100) : 0

      return {
        ...plan,
        progress,
      }
    })

    // Filter plans based on status
    const today = new Date().toISOString().split("T")[0]
    let filteredPlans = plansWithProgress

    if (filter === "upcoming") {
      filteredPlans = plansWithProgress.filter((p: any) => p.end_date >= today && p.progress < 100)
    } else if (filter === "past_due") {
      filteredPlans = plansWithProgress.filter((p: any) => p.end_date < today && p.progress < 100)
    } else if (filter === "completed") {
      filteredPlans = plansWithProgress.filter((p: any) => p.progress === 100)
    }

    return NextResponse.json({ plans: filteredPlans })
  } catch (error: any) {
    console.error("[v0] Error fetching study plans:", error)
    return NextResponse.json({ error: error.message || "Failed to fetch study plans" }, { status: 500 })
  }
}

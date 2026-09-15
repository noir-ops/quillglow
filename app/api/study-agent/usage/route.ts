import { createServerClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function GET() {
  try {
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { data: subscription } = await supabase
      .from("subscriptions")
      .select("status, plan_type")
      .eq("user_id", user.id)
      .eq("plan_type", "genius")
      .in("status", ["active", "trialing"])
      .limit(1)
      .maybeSingle()

    const isGenius = !!subscription
    if (isGenius) return NextResponse.json({ isGenius: true, unlimited: true, used: 0, remaining: null, limit: null })

    const FREE_MONTHLY_LIMIT = 3
    const monthStart = new Date()
    monthStart.setDate(1)
    monthStart.setHours(0, 0, 0, 0)
    const { count } = await supabase
      .from("study_agent_sessions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .gte("created_at", monthStart.toISOString())

    const used = count ?? 0
    const remaining = Math.max(0, FREE_MONTHLY_LIMIT - used)
    return NextResponse.json({ isGenius: false, unlimited: false, used, remaining, limit: FREE_MONTHLY_LIMIT })
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

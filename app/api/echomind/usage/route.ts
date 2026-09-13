import { createServerClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

const FREE_LIMIT = 3

export async function GET() {
  try {
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    // Check for active Genius subscription — MUST be plan_type = 'genius'
    const { data: subscription } = await supabase
      .from("subscriptions")
      .select("status, plan_type, current_period_end")
      .eq("user_id", user.id)
      .eq("plan_type", "genius")
      .in("status", ["active", "trialing"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    const isGenius = !!subscription

    if (isGenius) {
      return NextResponse.json({ isGenius: true, unlimited: true, used: 0, limit: null, remaining: null, resetDate: null })
    }

    // Count echomind_logs in the last 30 days
    const since = new Date()
    since.setDate(since.getDate() - 30)

    const { count } = await supabase
      .from("echomind_logs")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .gte("created_at", since.toISOString())

    const used = count ?? 0
    const remaining = Math.max(0, FREE_LIMIT - used)

    // Find the oldest log in the window to estimate reset date
    const { data: oldest } = await supabase
      .from("echomind_logs")
      .select("created_at")
      .eq("user_id", user.id)
      .gte("created_at", since.toISOString())
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle()

    let resetDate: string | null = null
    if (oldest) {
      const reset = new Date(oldest.created_at)
      reset.setDate(reset.getDate() + 30)
      resetDate = reset.toISOString()
    }

    return NextResponse.json({ isGenius: false, unlimited: false, used, limit: FREE_LIMIT, remaining, resetDate })
  } catch (error) {
    console.error("[echomind/usage]", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

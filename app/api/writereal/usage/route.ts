import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

const FREE_MONTHLY_LIMIT = 3

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { data: subscription } = await supabase
      .from("subscriptions")
      .select("plan_type, status")
      .eq("user_id", user.id)
      .eq("status", "active")
      .maybeSingle()
    const isGenius = subscription?.plan_type === "genius"

    if (isGenius) {
      return NextResponse.json({ isGenius: true, unlimited: true, used: 0, remaining: null, limit: null })
    }

    const monthStart = new Date()
    monthStart.setDate(1)
    monthStart.setHours(0, 0, 0, 0)
    const { count } = await supabase
      .from("writing_improver_logs")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("mode", "humanize")
      .gte("created_at", monthStart.toISOString())

    const used = count ?? 0
    const remaining = Math.max(0, FREE_MONTHLY_LIMIT - used)
    return NextResponse.json({ isGenius: false, unlimited: false, used, remaining, limit: FREE_MONTHLY_LIMIT })
  } catch {
    return NextResponse.json({ error: "Failed to fetch usage" }, { status: 500 })
  }
}

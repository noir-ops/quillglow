import { createServerClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { getFeatureUsage } from "@/lib/billing/usage"

/** EchoMind allowance for the page header — the plan_limits row the route enforces. */
export async function GET() {
  try {
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const usage = await getFeatureUsage(supabase, user.id, "echomind")
    // Calendar-month reset, same as every other feature.
    const now = new Date()
    const resetDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)).toISOString()
    return NextResponse.json({ ...usage, resetDate })
  } catch (error) {
    console.error("[echomind/usage]", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

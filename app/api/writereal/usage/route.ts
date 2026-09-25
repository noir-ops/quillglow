import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

const FREE_MONTHLY_LIMIT = 3
const GENERATIVE_MODES = ["humanize", "grammar", "paraphrase"]

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    // Each generative mode (humanize/grammar/paraphrase) tracks its own
    // independent 3/month allowance — see app/api/writereal/route.ts.
    // Defaults to "humanize" so any old caller with no query param still
    // gets the same response shape as before.
    const rawMode = req.nextUrl.searchParams.get("mode") || "humanize"
    const mode = GENERATIVE_MODES.includes(rawMode) ? rawMode : "humanize"

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
      .eq("mode", mode)
      .gte("created_at", monthStart.toISOString())

    const used = count ?? 0
    const remaining = Math.max(0, FREE_MONTHLY_LIMIT - used)
    return NextResponse.json({ isGenius: false, unlimited: false, used, remaining, limit: FREE_MONTHLY_LIMIT })
  } catch {
    return NextResponse.json({ error: "Failed to fetch usage" }, { status: 500 })
  }
}

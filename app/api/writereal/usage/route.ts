import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getFeatureUsage } from "@/lib/billing/usage"
import type { AIFeature } from "@/lib/services/quota"

export const dynamic = "force-dynamic"

const MODES = ["detect", "grammar", "humanize", "paraphrase"]

/**
 * WriteReal allowance for one mode — the same plan_limits row the route
 * enforces (writereal_<mode>), so the banner always shows what's applied.
 */
export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const raw = req.nextUrl.searchParams.get("mode") || "humanize"
    const mode = MODES.includes(raw) ? raw : "humanize"
    return NextResponse.json(await getFeatureUsage(supabase, user.id, `writereal_${mode}` as AIFeature))
  } catch {
    return NextResponse.json({ error: "Failed to fetch usage" }, { status: 500 })
  }
}

import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { FEATURE_INFO, getAllUsage } from "@/lib/billing/usage"

export const dynamic = "force-dynamic"

/**
 * This month's usage for every metered feature, with learner-facing labels.
 * Read from the same plan_limits rows the server enforces.
 */
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const rows = await getAllUsage(supabase, user.id)
  const order = Object.keys(FEATURE_INFO)
  const usage = rows
    .filter((r) => r.feature in FEATURE_INFO)
    .map((r) => ({ ...r, ...FEATURE_INFO[r.feature as keyof typeof FEATURE_INFO]! }))
    .sort((a, b) => order.indexOf(a.feature) - order.indexOf(b.feature))
  return NextResponse.json({ plan: rows[0]?.plan ?? "scholar", usage })
}

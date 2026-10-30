import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { FEATURE_INFO } from "@/lib/billing/usage"

export const dynamic = "force-dynamic"

/** Public plan facts only. Never exposes a customer's subscription or usage. */
export async function GET() {
  try {
    const { data, error } = await createAdminClient().from("plan_limits")
      .select("plan_type, feature, monthly_limit").in("plan_type", ["scholar", "genius"])
    if (error || !data?.length) throw new Error("Plan limits unavailable")
    const limits = data.filter((r: any) => r.feature in FEATURE_INFO)
    if (limits.some((r: any) => !Number.isInteger(r.monthly_limit) || r.monthly_limit < -1)) {
      throw new Error("Invalid plan limits")
    }
    return NextResponse.json({ limits }, { headers: { "Cache-Control": "no-store" } })
  } catch (err) {
    console.error("[plan-limits] read failed", err)
    return NextResponse.json({ error: "Plan allowances are temporarily unavailable" }, { status: 503 })
  }
}

import { createServerClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { getFeatureUsage } from "@/lib/billing/usage"

/**
 * StudyPilot allowance for the page header. Reads the same plan_limits row
 * the route enforces (study_agent), so the number shown is the number
 * applied. It used to report "3 free runs a month" while the route allowed
 * Scholars none at all.
 */
export async function GET() {
  try {
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    return NextResponse.json(await getFeatureUsage(supabase, user.id, "study_agent"))
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

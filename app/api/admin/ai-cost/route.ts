import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { requirePermission } from "@/lib/services/access"

export const dynamic = "force-dynamic"

/** AI Cost / MAU and daily breakdown — spec §26. Admin only. */
export async function GET(req: Request) {
  const guard = await requirePermission("platform.administer")
  if ("error" in guard) return guard.error

  const days = Number(new URL(req.url).searchParams.get("days") ?? 30)
  const admin = createAdminClient()

  const [summary, daily] = await Promise.all([
    admin.rpc("ai_cost_per_active_user", { p_days: Math.min(days, 365) }),
    admin.from("ai_cost_daily").select("*").order("day", { ascending: false }).limit(90),
  ])

  return NextResponse.json({
    summary: Array.isArray(summary.data) ? summary.data[0] : summary.data,
    daily: daily.data ?? [],
  })
}

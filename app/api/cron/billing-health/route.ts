import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { isCronAuthorized } from "@/lib/billing/cron-auth"
import { getGeniusProductIds } from "@/lib/billing/polar-sync"
export const dynamic = "force-dynamic"
/** Operational evidence only; this endpoint never changes prices or products. */
export async function GET(req: Request) {
  if (!isCronAuthorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const admin = createAdminClient()
  let configured = false
  try { configured = !!process.env.POLAR_ACCESS_TOKEN && !!process.env.POLAR_WEBHOOK_SECRET && (await getGeniusProductIds(admin)).length > 0 }
  catch { return NextResponse.json({ ready: false, error: "Billing product configuration unavailable" }, { status: 503 }) }
  const { data, error } = await admin.from("billing_job_state")
    .select("job_name, last_started_at, last_completed_at, last_error, last_summary")
  if (error) return NextResponse.json({ ready: false, error: "Billing migration or job history unavailable" }, { status: 503 })
  const jobs = ["polar-local", "polar-discovery", "expiry"].map(name => {
    const row = data?.find(item => item.job_name === name)
    const fresh = !!row?.last_completed_at && Date.now() - new Date(row.last_completed_at).getTime() < 36 * 3600000
    return { name, fresh, lastCompletedAt: row?.last_completed_at ?? null, summary: row?.last_summary ?? null,
      ok: fresh && !row?.last_error && !row?.last_summary?.errors && !row?.last_summary?.unmatched }
  })
  return NextResponse.json({ configured, jobs, ready: configured && jobs.every(job => job.ok),
    note: "Also verify actual Polar sandbox delivery and scheduled execution before launching new prices." })
}

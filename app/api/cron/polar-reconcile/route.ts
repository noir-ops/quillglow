import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { isCronAuthorized } from "@/lib/billing/cron-auth"
import { reconcilePolar } from "@/lib/billing/reconcile"
export const dynamic = "force-dynamic"
export const maxDuration = 300
export async function GET(req: Request) {
  if (!isCronAuthorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  try {
    const result = await reconcilePolar(createAdminClient(), { dryRun: new URL(req.url).searchParams.get("dryRun") === "1" })
    return NextResponse.json(result, { status: result.counts.errors ? 503 : result.complete ? 200 : 202 })
  } catch (error) {
    console.error("[polar-reconcile]", error)
    return NextResponse.json({ error: "Reconciliation failed" }, { status: 503 })
  }
}
export const POST = GET

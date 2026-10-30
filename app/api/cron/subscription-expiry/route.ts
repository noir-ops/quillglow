import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { isCronAuthorized } from "@/lib/billing/cron-auth"
export const dynamic = "force-dynamic"
export async function GET(req: Request) {
  if (!isCronAuthorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { data, error } = await createAdminClient().rpc("expire_genius_subscriptions")
  if (error) return NextResponse.json({ error: "Expiry processing failed" }, { status: 503 })
  return NextResponse.json({ processed: data })
}
export const POST = GET

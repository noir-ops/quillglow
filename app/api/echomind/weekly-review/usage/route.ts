import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getFeatureUsage } from "@/lib/billing/usage"
export const dynamic = "force-dynamic"
export async function GET() {
  const client = await createClient(), { data: { user } } = await client.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  try { return NextResponse.json(await getFeatureUsage(client, user.id, "weekly_review"), { headers: { "Cache-Control": "private, no-store" } }) }
  catch { return NextResponse.json({ error: "Weekly review allowance unavailable" }, { status: 503 }) }
}

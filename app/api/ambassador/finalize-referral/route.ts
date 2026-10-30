import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { finalizeConfirmedReferral } from "@/lib/billing/referral"
export async function POST() {
  const client = await createClient()
  const { data: { user } } = await client.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!user.email_confirmed_at) return NextResponse.json({ error: "Email confirmation required" }, { status: 403 })
  await finalizeConfirmedReferral(client)
  return NextResponse.json({ ok: true })
}

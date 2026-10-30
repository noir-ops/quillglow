import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { FEATURE_INFO } from "@/lib/billing/usage"
export async function POST(req: Request) {
  const client = await createClient(), { data: { user } } = await client.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const body = await req.json().catch(() => null)
  if (!["offer_view", "upgrade_click"].includes(body?.kind) ||
    !(typeof body?.feature === "string" && (Object.hasOwn(FEATURE_INFO, body.feature) || ["pricing", "upgrade", "dashboard"].includes(body.feature)))) return NextResponse.json({ error: "Invalid event" }, { status: 400 })
  const { error } = await createAdminClient().rpc("record_billing_funnel_event", { p_user: user.id, p_kind: body.kind, p_feature: body.feature, p_reference: null })
  if (error) return NextResponse.json({ error: "Event unavailable" }, { status: 503 })
  return NextResponse.json({ ok: true })
}

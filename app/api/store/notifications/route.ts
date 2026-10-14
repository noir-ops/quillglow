import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
export const dynamic = "force-dynamic"

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { data, error } = await supabase.from("store_launch_subscriptions").select("subscribed").eq("user_id", user.id).maybeSingle()
  if (error) return NextResponse.json({ error: "Could not load Store notifications" }, { status: 500 })
  return NextResponse.json({ email: user.email || "", verified: !!user.email_confirmed_at, subscribed: data?.subscribed === true })
}
export async function PUT(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const body = await request.json().catch(() => null)
  if (typeof body?.subscribed !== "boolean") return NextResponse.json({ error: "Choose whether to subscribe" }, { status: 400 })
  if (body.subscribed && (!user.email || !user.email_confirmed_at)) return NextResponse.json({ error: "Verify your account email first" }, { status: 400 })
  const admin = createAdminClient()
  const { data, error } = await admin.rpc("set_store_launch_subscription", { p_user_id: user.id, p_subscribed: body.subscribed })
  if (error) return NextResponse.json({ error: "Could not save Store notifications" }, { status: 500 })
  return NextResponse.json({ email: user.email || "", verified: !!user.email_confirmed_at, subscribed: data === true })
}

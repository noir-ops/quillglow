import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
export const dynamic = "force-dynamic"
export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const body = await req.json().catch(() => null)
  if (typeof body?.familyWalletId !== "string") return NextResponse.json({ error: "familyWalletId is required" }, { status: 400 })
  // Verify this is the learner's wallet before invoking the same atomic
  // purchase function used by the guardian app.
  const { data: wallet, error: walletError } = await supabase.from("family_wallets").select("id")
    .eq("id", body.familyWalletId).eq("student_user_id", user.id).maybeSingle()
  if (walletError || !wallet) return NextResponse.json({ error: "Family wallet not found" }, { status: 404 })
  if (!Number.isInteger(body.expectedAmountCents)) return NextResponse.json({ error: "Refresh the offer before paying" }, { status: 409 })
  const { data, error } = await supabase.rpc("purchase_genius_plan_quoted", { p_family_wallet_id: wallet.id, p_expected_cents: body.expectedAmountCents })
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  const row = Array.isArray(data) ? data[0] : data
  const { data: subscription, error: readError } = await supabase.from("subscriptions").select("*").eq("user_id", user.id).single()
  if (readError) return NextResponse.json({ error: "Purchase completed; could not refresh subscription. Please reload." }, { status: 503 })
  return NextResponse.json({ subscription, balance: row?.out_balance })
}

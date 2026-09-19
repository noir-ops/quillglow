import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

// Matches PLAN_DETAILS.genius.price in lib/types/subscription.ts. Fixed
// here, not read from the request body — a client-supplied amount would
// let a student charge whatever they wanted against a parent's balance.
const GENIUS_MONTHLY_PRICE = 4.99

/**
 * Genius plan, paid from a family wallet instead of Polar. Fulfillment
 * mirrors /api/subscription/verify-payment exactly (same subscriptions
 * upsert shape) — the only thing that differs is the payment rail behind
 * it. charge_family_wallet (050) is the actual money movement; this route
 * only calls it and then does the same activation Polar's flow does.
 */
export async function POST(req: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json().catch(() => null)
  const familyWalletId = body?.familyWalletId as string | undefined
  if (!familyWalletId) return NextResponse.json({ error: "familyWalletId is required" }, { status: 400 })

  const idempotencyKey = `genius:${user.id}:${new Date().toISOString().slice(0, 7)}` // one charge per user per calendar month

  const { data: chargeData, error: chargeError } = await supabase.rpc("charge_family_wallet", {
    p_family_wallet_id: familyWalletId,
    p_amount: GENIUS_MONTHLY_PRICE,
    p_description: "QuillGlow Genius plan",
    p_reference_type: "subscription",
    p_reference_id: user.id,
    p_idempotency_key: idempotencyKey,
  })

  if (chargeError) {
    const message = chargeError.message?.includes("Insufficient")
      ? "Not enough balance in this family wallet. Ask them to add funds."
      : chargeError.message
    return NextResponse.json({ error: message }, { status: 400 })
  }

  const chargeRow = Array.isArray(chargeData) ? chargeData[0] : chargeData

  // Same activation shape as the Polar path — plan_type/status/period,
  // just no polar_* fields since no Polar checkout happened.
  const updateData = {
    plan_type: "genius",
    status: "active",
    current_period_start: new Date().toISOString(),
    current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date().toISOString(),
  }

  const { data: existingSub } = await supabase.from("subscriptions").select("id").eq("user_id", user.id).maybeSingle()

  const result = existingSub
    ? await supabase.from("subscriptions").update(updateData).eq("user_id", user.id).select().single()
    : await supabase
        .from("subscriptions")
        .insert({ user_id: user.id, ...updateData })
        .select()
        .single()

  if (result.error) {
    // Same fix as the shop route — surface the real reason, not just a
    // generic support-ticket message.
    console.error("[subscription/pay-with-family-wallet] activation failed after charge:", result.error.message)
    return NextResponse.json(
      {
        error: `Payment succeeded but activation failed: ${result.error.message}. Reference: ${idempotencyKey}`,
      },
      { status: 500 },
    )
  }

  return NextResponse.json({ subscription: result.data, balance: chargeRow?.out_balance })
}

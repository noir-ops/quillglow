import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { PRODUCTS } from "@/lib/products"

export const dynamic = "force-dynamic"

/**
 * Study Tracker, paid from a family wallet instead of Polar. Same
 * study_tracker_orders insert shape as /api/shop/verify-payment — only
 * the payment_provider value and price source differ (PRODUCTS constant,
 * not a client-supplied amount, for the same reason as the subscription
 * route: the price must be server-determined).
 */
export async function POST(req: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json().catch(() => null)
  const familyWalletId = body?.familyWalletId as string | undefined
  const productId = (body?.productId as string | undefined) ?? PRODUCTS[0]?.id

  if (!familyWalletId) return NextResponse.json({ error: "familyWalletId is required" }, { status: 400 })

  const product = PRODUCTS.find((p) => p.id === productId)
  if (!product) return NextResponse.json({ error: "Product not found" }, { status: 404 })

  const price = product.priceInCents / 100
  const idempotencyKey = `shop:${product.id}:${user.id}:${Date.now()}`

  const { data: chargeData, error: chargeError } = await supabase.rpc("charge_family_wallet", {
    p_family_wallet_id: familyWalletId,
    p_amount: price,
    p_description: product.name,
    p_reference_type: "shop_order",
    p_reference_id: product.id,
    p_idempotency_key: idempotencyKey,
  })

  if (chargeError) {
    const message = chargeError.message?.includes("Insufficient")
      ? "Not enough balance in this family wallet. Ask them to add funds."
      : chargeError.message
    return NextResponse.json({ error: message }, { status: 400 })
  }

  const chargeRow = Array.isArray(chargeData) ? chargeData[0] : chargeData

  const { data: order, error: insertError } = await supabase
    .from("study_tracker_orders")
    .insert({
      user_id: user.id,
      email: user.email,
      product_name: product.name,
      price,
      payment_provider: "family_wallet",
      payment_status: "completed",
      currency: "usd",
    })
    .select("id")
    .single()

  if (insertError) {
    // Was returning only a generic "contact support" message here,
    // discarding insertError.message — the exact pattern that made this
    // bug (a payment_provider check constraint that didn't know about
    // 'family_wallet') invisible from the screenshot alone. Now shows
    // the real reason; the idempotency key is still included so a
    // genuinely unresolvable case is still traceable.
    console.error("[shop/pay-with-family-wallet] order insert failed after charge:", insertError.message)
    return NextResponse.json(
      {
        error: `Payment succeeded but order creation failed: ${insertError.message}. Reference: ${idempotencyKey}`,
      },
      { status: 500 },
    )
  }

  return NextResponse.json({ orderId: order.id, balance: chargeRow?.out_balance })
}

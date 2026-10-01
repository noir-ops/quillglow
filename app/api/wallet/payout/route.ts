import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { executePayout } from "@/lib/payouts/execute"

export const dynamic = "force-dynamic"

/**
 * Rail 1 — Controlled Student Benefits (gift cards, prepaid cards).
 * See /institutional and /recipient for Rails 2 and 3 — same
 * executePayout() helper, different rail + delivery_method.
 */
export async function POST(req: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json().catch(() => null)
  const amount = Number(body?.amount)
  const deliveryMethod = body?.deliveryMethod as string // 'reward' | 'gift_card'
  const productId = body?.productId as string | undefined
  const recipientEmail = (body?.recipientEmail as string) || user.email
  const recipientName = body?.recipientName as string | undefined
  const idempotencyKey = body?.idempotencyKey as string | undefined

  if (!amount || amount <= 0) {
    return NextResponse.json({ error: "A positive amount is required" }, { status: 400 })
  }
  if (!["reward", "gift_card"].includes(deliveryMethod)) {
    return NextResponse.json({ error: "deliveryMethod must be 'reward' or 'gift_card'" }, { status: 400 })
  }
  if (!recipientEmail) {
    return NextResponse.json({ error: "recipientEmail is required" }, { status: 400 })
  }

  const result = await executePayout({
    userId: user.id,
    amount,
    currency: "USD",
    rail: 1,
    deliveryMethod: deliveryMethod as "reward" | "gift_card",
    recipientEmail,
    recipientName,
    productId,
    idempotencyKey,
  })

  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status })
  return NextResponse.json({ payoutOrder: result.payoutOrder, balance: result.balance })
}

/** List the student's own payout history, across all rails. */
export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data, error } = await supabase
    .from("payout_orders")
    .select("*, institutions(name)")
    .order("created_at", { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ payoutOrders: data ?? [] })
}

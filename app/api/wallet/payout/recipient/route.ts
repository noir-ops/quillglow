import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { executePayout } from "@/lib/payouts/execute"

export const dynamic = "force-dynamic"

/**
 * Rail 3 — Recipient/Guardian Payout. Real cash — bank transfer or PayPal —
 * to the student or a named guardian, for stipends and living expenses.
 * Unlike Rail 1, the provider (Stripe Connect) will
 * typically require the recipient to complete identity verification on
 * their side before funds can be claimed — that KYC lives entirely in the
 * provider's hosted flow, never in this codebase.
 */
export async function POST(req: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json().catch(() => null)
  const amount = Number(body?.amount)
  const recipientEmail = body?.recipientEmail as string | undefined
  const recipientName = body?.recipientName as string | undefined
  const idempotencyKey = body?.idempotencyKey as string | undefined

  if (!amount || amount <= 0) {
    return NextResponse.json({ error: "A positive amount is required" }, { status: 400 })
  }
  if (!recipientEmail) {
    return NextResponse.json({ error: "recipientEmail is required (yours, or your guardian's)" }, { status: 400 })
  }

  const result = await executePayout({
    userId: user.id,
    amount,
    currency: "USD",
    rail: 3,
    deliveryMethod: "bank_transfer",
    recipientEmail,
    recipientName,
    idempotencyKey,
  })

  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status })
  return NextResponse.json({ payoutOrder: result.payoutOrder, balance: result.balance })
}

import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { executePayout } from "@/lib/payouts/execute"

export const dynamic = "force-dynamic"

/**
 * Rail 2 — Institutional Funding. Money goes straight to the school's
 * account, never the student's — for tuition, fees, books. Fulfilled by
 * whichever provider is active for rail 2 in disbursement_providers
 * (Stripe Connect per the "Stripe moves the money" architecture decision; Tremendous doesn't
 * do this — no institutional payout capability, gift cards only).
 */
export async function POST(req: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json().catch(() => null)
  const amount = Number(body?.amount)
  const institutionId = body?.institutionId as string | undefined
  const idempotencyKey = body?.idempotencyKey as string | undefined

  if (!amount || amount <= 0) {
    return NextResponse.json({ error: "A positive amount is required" }, { status: 400 })
  }
  if (!institutionId) {
    return NextResponse.json({ error: "institutionId is required" }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data: institution, error: instError } = await admin
    .from("institutions")
    .select("*")
    .eq("id", institutionId)
    .eq("is_active", true)
    .maybeSingle()

  if (instError || !institution) {
    return NextResponse.json({ error: "Institution not found or inactive" }, { status: 404 })
  }

  const result = await executePayout({
    userId: user.id,
    amount,
    currency: "USD",
    rail: 2,
    deliveryMethod: "institutional_payment",
    recipientEmail: institution.contact_email,
    recipientName: institution.name,
    institutionId,
    idempotencyKey,
  })

  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status })
  return NextResponse.json({ payoutOrder: result.payoutOrder, balance: result.balance })
}

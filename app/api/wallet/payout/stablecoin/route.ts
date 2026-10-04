import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { executePayout } from "@/lib/payouts/execute"

export const dynamic = "force-dynamic"

/**
 * Rail 4 — Blockchain/Stablecoin Payout. Sends USDC directly to a wallet
 * address the student provides, instead of an email-based redemption.
 *
 * This route completes the plumbing that was missing — 053 added the
 * database columns and delivery_method value, execute.ts now carries the
 * wallet address through — but the ACTIVE provider on this rail (Circle)
 * is still registered without real production credentials
 * (CIRCLE_API_KEY, CIRCLE_SOURCE_WALLET_ID, CIRCLE_TOKEN_ID,
 * CIRCLE_ENTITY_SECRET). Submitting here will correctly fail with a clear
 * "Circle is not yet configured" error and an automatic refund until
 * those are set up — see the deployment guide's Circle section. That's
 * expected, not a bug: same behavior every other unconfigured provider
 * in this codebase has always had.
 */
export async function POST(req: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json().catch(() => null)
  const amount = Number(body?.amount)
  const walletAddress = (body?.walletAddress as string | undefined)?.trim()
  const chain = body?.chain as string | undefined
  const recipientEmail = (body?.recipientEmail as string) || user.email
  const idempotencyKey = body?.idempotencyKey as string | undefined

  if (!amount || amount <= 0) {
    return NextResponse.json({ error: "A positive amount is required" }, { status: 400 })
  }
  if (!walletAddress) {
    return NextResponse.json({ error: "walletAddress is required" }, { status: 400 })
  }
  if (!chain) {
    return NextResponse.json({ error: "chain is required (e.g. ETH, MATIC, BASE, SOL)" }, { status: 400 })
  }
  if (!recipientEmail) {
    return NextResponse.json({ error: "recipientEmail is required" }, { status: 400 })
  }

  const result = await executePayout({
    userId: user.id,
    amount,
    currency: "USD",
    rail: 4,
    deliveryMethod: "stablecoin",
    recipientEmail,
    recipientWalletAddress: walletAddress,
    recipientChain: chain,
    idempotencyKey,
  })

  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status })
  return NextResponse.json({ payoutOrder: result.payoutOrder, balance: result.balance })
}

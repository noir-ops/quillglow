import { createAdminClient } from "@/lib/supabase/admin"
import { getActiveProvider } from "./registry"
import { ProviderNotConfiguredError } from "./types"
import type { DisbursementRail } from "./types"

export interface ExecutePayoutInput {
  userId: string
  amount: number
  currency: string
  rail: DisbursementRail
  deliveryMethod: "reward" | "gift_card" | "institutional_payment" | "bank_transfer" | "stablecoin"
  recipientEmail: string
  recipientName?: string
  productId?: string
  institutionId?: string
  /** Rail 4 only — destination address and chain (e.g. "ETH", "MATIC", "BASE"). */
  recipientWalletAddress?: string
  recipientChain?: string
  idempotencyKey?: string
}

export type ExecutePayoutResult =
  | { ok: true; payoutOrder: unknown; balance: number }
  | { ok: false; error: string; status: number }

/**
 * The two-phase dance every rail follows, in one place: atomic debit +
 * reserved order row (Postgres), then hand off to whatever provider is
 * active for the rail (registry.ts). Refund on failure, never a stranded
 * debit. Rails 1/2/3/4 all call this — the only thing that differs
 * between them is which rail number, delivery_method, and recipient
 * shape they pass in.
 */
export async function executePayout(input: ExecutePayoutInput): Promise<ExecutePayoutResult> {
  const admin = createAdminClient()

  const { data: reqData, error: reqError } = await admin.rpc("request_payout", {
    p_user_id: input.userId,
    p_amount: input.amount,
    p_currency: input.currency,
    p_delivery_method: input.deliveryMethod,
    p_product_id: input.productId ?? null,
    p_recipient_email: input.recipientEmail,
    p_recipient_name: input.recipientName ?? null,
    p_idempotency_key: input.idempotencyKey ?? `payout:${input.userId}:${Date.now()}`,
    p_rail: input.rail,
  })

  if (reqError) {
    return { ok: false, error: reqError.message, status: 400 }
  }

  const row = Array.isArray(reqData) ? reqData[0] : reqData
  const payoutOrderId = row?.payout_order_id as string

  if (input.institutionId) {
    await admin.from("payout_orders").update({ institution_id: input.institutionId }).eq("id", payoutOrderId)
  }
  // request_payout (037/038) has no wallet-address parameters — it
  // predates Rail 4 — so these are recorded with a follow-up update,
  // same pattern as institutionId above. Without this, 053's new columns
  // would exist but nothing would ever populate them.
  if (input.recipientWalletAddress) {
    await admin
      .from("payout_orders")
      .update({ recipient_wallet_address: input.recipientWalletAddress, recipient_chain: input.recipientChain ?? null })
      .eq("id", payoutOrderId)
  }

  if (row?.duplicate) {
    const { data: existing } = await admin.from("payout_orders").select("*").eq("id", payoutOrderId).maybeSingle()
    return { ok: true, payoutOrder: existing, balance: row.balance }
  }

  try {
    const provider = await getActiveProvider(input.rail)

    const result = await provider.createPayout({
      idempotencyKey: payoutOrderId,
      amount: input.amount,
      currency: input.currency,
      recipient: {
        email: input.recipientEmail,
        name: input.recipientName,
        walletAddress: input.recipientWalletAddress,
        chain: input.recipientChain,
      },
      productId: input.productId,
    })

    await admin.rpc("mark_payout_order_fulfilled", {
      p_payout_order_id: payoutOrderId,
      p_provider_key: provider.key,
      p_provider_payout_id: result.providerPayoutId,
      p_provider_secondary_id: result.providerSecondaryId ?? null,
      p_redemption_url: result.redemptionUrl ?? null,
    })

    const { data: finalOrder } = await admin.from("payout_orders").select("*").eq("id", payoutOrderId).maybeSingle()
    return { ok: true, payoutOrder: finalOrder, balance: row.balance }
  } catch (err) {
    const reason =
      err instanceof ProviderNotConfiguredError
        ? err.message
        : err instanceof Error
          ? err.message
          : "Unknown provider error"
    await admin.rpc("fail_payout_order", { p_payout_order_id: payoutOrderId, p_reason: reason })
    return { ok: false, error: `Payout failed and was refunded: ${reason}`, status: 502 }
  }
}

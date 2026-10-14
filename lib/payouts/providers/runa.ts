import { createOrder, getOrder, listProducts as listRunaProducts } from "@/lib/runa"
import type { CreatePayoutInput, PayoutProductOption, PayoutProvider, PayoutResult } from "../types"
import { ProviderNotConfiguredError } from "../types"

/**
 * Second Rail-1 provider, alongside Tremendous. Registered but not active
 * by default (see 042 migration) — Tremendous stays the live option until
 * this is deliberately switched on in the admin panel.
 *
 * input.productId is Runa's product `code` (e.g. "AMZ-US") here, not an
 * opaque id like Tremendous uses — Runa's own API calls it `code`, and
 * listProducts() below returns that field as `id` only to satisfy the
 * shared PayoutProductOption shape every Rail-1 provider returns.
 */
export const runaProvider: PayoutProvider = {
  key: "runa",
  rail: 1,

  async createPayout(input: CreatePayoutInput): Promise<PayoutResult> {
    if (!process.env.RUNA_API_KEY) {
      throw new ProviderNotConfiguredError("runa")
    }
    if (!input.productId) {
      throw new Error("Runa requires a product code (input.productId) — choose one via listProducts() first")
    }

    const order = await createOrder({
      amount: input.amount,
      currency: input.currency,
      recipientEmail: input.recipient.email,
      productCode: input.productId,
      externalId: input.idempotencyKey,
    })

    // Runa delivers by email (distribution_method: EMAIL) — no redemption
    // URL comes back synchronously the way Tremendous's does; the
    // recipient's card/link arrives in their inbox directly from Runa.
    return {
      providerPayoutId: order.id,
      status: order.status === "PROCESSING" ? "pending" : "created",
    }
  },

  async getPayoutStatus(providerPayoutId: string) {
    const order = await getOrder(providerPayoutId)
    return { status: order.status }
  },

  async listProducts(): Promise<PayoutProductOption[]> {
    if (!process.env.RUNA_API_KEY) {
      throw new ProviderNotConfiguredError("runa")
    }
    const catalog = await listRunaProducts()
    // Same four-option curation as Tremendous, for a consistent redeem
    // dialog regardless of which Rail-1 provider is active. Matched
    // against Runa's real `name`/`is_orderable` fields now, not guessed
    // field names.
    const pick = (matcher: RegExp, label: string, category: "reward" | "gift_card") => {
      const match = catalog.find((p) => p.is_orderable && matcher.test(p.name))
      return match ? { id: match.code, name: label, category } : null
    }
    return [
      pick(/visa/i, "Virtual Prepaid Visa", "reward"),
      pick(/amazon/i, "Amazon eGift Card", "gift_card"),
      pick(/google\s*play/i, "Google Play eGift Card", "gift_card"),
      pick(/^apple\b/i, "Apple eGift Card", "gift_card"),
    ].filter((p): p is PayoutProductOption => p !== null)
  },
}

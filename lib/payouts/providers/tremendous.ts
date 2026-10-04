import { createOrder, getOrder, listProducts as listTremendousProducts, type TremendousProduct } from "@/lib/tremendous"
import type { CreatePayoutInput, PayoutProductOption, PayoutProvider, PayoutResult } from "../types"
import { ProviderNotConfiguredError } from "../types"

/**
 * Adapter, not the client. lib/tremendous/index.ts is the raw API wrapper;
 * this file's only job is translating the generic PayoutProvider contract
 * into Tremendous's specific request/response shape. If Tremendous changes
 * their API, only this file and lib/tremendous change — never the route
 * that calls it.
 *
 * listProducts() lives here (not in the API route) precisely because
 * Rail 1 now has more than one possible provider (Tremendous, Runa) — the
 * curation logic for "which of Tremendous's 1000+ regional SKUs count as
 * our four gift-card options" is Tremendous-specific and has no business
 * living in a provider-agnostic route.
 */
interface CategoryDef {
  key: string
  label: string
  category: "reward" | "gift_card"
  isCandidate: (p: TremendousProduct) => boolean
  isPreferred: (p: TremendousProduct) => boolean
}

const CATEGORY_DEFS: CategoryDef[] = [
  {
    key: "visa",
    label: "Virtual Prepaid Visa",
    category: "reward",
    isCandidate: (p) => /visa/i.test(p.name) && !/physical/i.test(p.name),
    isPreferred: (p) => /virtual/i.test(p.name) || /^visa/i.test(p.name.trim()),
  },
  {
    key: "amazon",
    label: "Amazon eGift Card",
    category: "gift_card",
    isCandidate: (p) => /^amazon(\.com)?( gift card)?$/i.test(p.name.trim()) || /amazon.*gift/i.test(p.name),
    isPreferred: (p) => /^amazon\.com$/i.test(p.name.trim()) || /^amazon$/i.test(p.name.trim()),
  },
  {
    key: "google_play",
    label: "Google Play eGift Card",
    category: "gift_card",
    isCandidate: (p) => /google play/i.test(p.name),
    isPreferred: (p) => /^google play$/i.test(p.name.trim()) || /^google play us$/i.test(p.name.trim()),
  },
  {
    key: "apple",
    label: "Apple eGift Card",
    category: "gift_card",
    isCandidate: (p) => /^apple\b/i.test(p.name.trim()) && !/prepaid/i.test(p.name),
    isPreferred: (p) => /^apple$/i.test(p.name.trim()),
  },
]

function pickBest(products: TremendousProduct[], def: CategoryDef): TremendousProduct | null {
  const candidates = products.filter(def.isCandidate)
  if (candidates.length === 0) return null
  const preferred = candidates.filter(def.isPreferred)
  const pool = preferred.length > 0 ? preferred : candidates
  return pool.reduce((best, p) => ((p.countries?.length ?? 0) > (best.countries?.length ?? 0) ? p : best), pool[0])
}

export const tremendousProvider: PayoutProvider = {
  key: "tremendous",
  rail: 1,

  async createPayout(input: CreatePayoutInput): Promise<PayoutResult> {
    if (!process.env.TREMENDOUS_API_KEY) {
      throw new ProviderNotConfiguredError("tremendous")
    }

    const order = await createOrder({
      amount: input.amount,
      currency: input.currency,
      recipientEmail: input.recipient.email,
      recipientName: input.recipient.name,
      productId: input.productId,
      externalId: input.idempotencyKey,
    })

    const reward = order.rewards?.[0]
    // Map Tremendous's real status rather than assuming success. In
    // production an order can legitimately come back PENDING (funding
    // approval, fraud review) rather than EXECUTED — hardcoding "created"
    // would show the student "Sent — check email" for a card that hasn't
    // actually been issued yet. getPayoutStatus() reconciles it later.
    const rawStatus = (order.status ?? "").toUpperCase()
    const status: PayoutResult["status"] =
      rawStatus === "EXECUTED" ? "delivered" : rawStatus === "PENDING" ? "pending" : "created"

    return {
      providerPayoutId: order.id,
      providerSecondaryId: reward?.id,
      redemptionUrl: reward?.delivery?.link,
      status,
    }
  },

  async getPayoutStatus(providerPayoutId: string) {
    const order = await getOrder(providerPayoutId)
    return { status: order.status }
  },

  async listProducts(): Promise<PayoutProductOption[]> {
    if (!process.env.TREMENDOUS_API_KEY) {
      throw new ProviderNotConfiguredError("tremendous")
    }
    const catalog = await listTremendousProducts()
    return CATEGORY_DEFS.map((def) => {
      const match = pickBest(catalog, def)
      if (!match) return null
      return { id: match.id, name: def.label, category: def.category }
    }).filter((p): p is PayoutProductOption => p !== null)
  },
}

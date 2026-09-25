import "server-only"

/**
 * Tremendous API client — the payout/rewards rail. Polar handles money
 * coming IN from benefactors; this handles money going OUT to students as
 * prepaid Visa/Mastercard cards or Apple/Google Play gift cards.
 *
 * No recipient KYC: Tremendous only needs an email + amount. The platform
 * (QuillGlow) does KYB once, outside this codebase, in the Tremendous
 * dashboard, and funds a "funding source" that orders draw from.
 *
 * Uses `import "server-only"` rather than `"use server"` — matching every
 * other provider client here. `"use server"` would mark every export in
 * this file as a Server Action, meaning the browser could invoke
 * createOrder() directly over RPC. For a file that issues real prepaid
 * cards, that's not something to leave to chance; "server-only" instead
 * makes importing this from client code a build error.
 *
 * Sandbox vs production is just a different base URL + API key — same
 * code path. Defaults to PRODUCTION, matching every other provider in
 * this codebase: a missing or misspelled TREMENDOUS_BASE_URL should fail
 * loudly against the real API, not silently issue worthless sandbox
 * cards while the student's wallet shows a real debit. Set
 * TREMENDOUS_BASE_URL to the testflight URL explicitly when testing.
 */

const TREMENDOUS_BASE_URL = process.env.TREMENDOUS_BASE_URL || "https://api.tremendous.com/api/v2"
const TREMENDOUS_API_KEY = process.env.TREMENDOUS_API_KEY
const TREMENDOUS_FUNDING_SOURCE_ID = process.env.TREMENDOUS_FUNDING_SOURCE_ID

async function tremendousFetch(endpoint: string, options: RequestInit = {}) {
  if (!TREMENDOUS_API_KEY) {
    throw new Error("TREMENDOUS_API_KEY is not configured")
  }

  const response = await fetch(`${TREMENDOUS_BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${TREMENDOUS_API_KEY}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  })

  return response
}

export interface TremendousProduct {
  id: string
  name: string
  category: string // e.g. "prepaid_card", "gift_card"
  countries: string[]
  skus?: Array<{ min: number; max: number; currency_code: string }>
}

/** List available reward products (cards). Used to build the redeem-picker UI. */
export async function listProducts(country?: string): Promise<TremendousProduct[]> {
  const qs = country ? `?country_code=${encodeURIComponent(country)}` : ""
  const res = await tremendousFetch(`/products${qs}`)
  if (!res.ok) throw new Error(`Failed to list Tremendous products: ${await res.text()}`)
  const data = await res.json()
  return data.products ?? []
}

export interface CreateOrderInput {
  amount: number
  currency: string
  recipientEmail: string
  recipientName?: string
  /** Specific product (a named prepaid card / gift card brand). Omit to let the recipient choose from a campaign's catalog. */
  productId?: string
  /** External idempotency key — Tremendous dedupes on this. */
  externalId: string
}

export interface TremendousOrder {
  id: string
  status: string
  rewards: Array<{
    id: string
    value: { denomination: number; currency_code: string }
    delivery: { status: string; link?: string }
  }>
}

/**
 * Create a single-reward order. This is the actual money-movement call —
 * everything before it (wallet debit, payout_orders row) is bookkeeping;
 * this is where a real card gets issued and emailed.
 */
export async function createOrder(input: CreateOrderInput): Promise<TremendousOrder> {
  if (!TREMENDOUS_FUNDING_SOURCE_ID) {
    throw new Error("TREMENDOUS_FUNDING_SOURCE_ID is not configured")
  }

  const body: Record<string, unknown> = {
    external_id: input.externalId,
    payment: { funding_source_id: TREMENDOUS_FUNDING_SOURCE_ID },
    reward: {
      value: { denomination: input.amount, currency_code: input.currency },
      recipient: {
        name: input.recipientName || input.recipientEmail,
        email: input.recipientEmail,
      },
      // Required by Tremendous — without this the API 422s with
      // "reward.delivery is missing". EMAIL sends the claim link straight
      // to the recipient's inbox, which is what the wallet UI promises.
      delivery: { method: "EMAIL" },
      ...(input.productId ? { products: [input.productId] } : {}),
    },
  }

  const res = await tremendousFetch("/orders", {
    method: "POST",
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const error = await res.text()
    throw new Error(`Tremendous order creation failed: ${error}`)
  }

  const data = await res.json()
  return data.order
}

/** Fetch order status — used if a webhook is missed or for manual reconciliation. */
export async function getOrder(orderId: string): Promise<TremendousOrder> {
  const res = await tremendousFetch(`/orders/${orderId}`)
  if (!res.ok) throw new Error(`Failed to get Tremendous order: ${await res.text()}`)
  const data = await res.json()
  return data.order
}

import "server-only"

/**
 * Runa — Rail 1, second gift-card provider alongside Tremendous.
 *
 * This is a full rewrite, not the original version. The first draft of
 * this file guessed at a request shape (`value: {amount,currency}`,
 * `recipient: {email,name}`, `product_id`) that turned out to be
 * structurally wrong. Verified this time against Runa's published OpenAPI
 * spec and developer docs (developer.runa.io) rather than inferring from
 * convention — the real shape is meaningfully different:
 *
 *   POST /orders
 *   {
 *     "payment_method": { "type": "ACCOUNT_BALANCE", "currency": "USD" },
 *     "items": [{
 *       "face_value": 25,
 *       "distribution_method": { "type": "EMAIL", "email_address": "..." },
 *       "products": { "type": "SINGLE", "value": "<product code>" }
 *     }]
 *   }
 *   → { "id": "O-ABC123", "status": "PROCESSING" }
 *
 * Confirmed from the spec directly: auth is X-Api-Key, idempotency is
 * X-Idempotency-Key on order creation, synchronous processing is
 * requested via the x-execution-mode: sync header, and orders are an
 * array of "items" (each with its own face value / delivery / product),
 * not a single flat amount+product — this API is built around baskets,
 * even though we only ever send one item.
 */

const RUNA_BASE_URL = process.env.RUNA_BASE_URL || "https://api.runa.io/v2"
const RUNA_API_KEY = process.env.RUNA_API_KEY

async function runaFetch(endpoint: string, options: RequestInit & { idempotencyKey?: string; sync?: boolean } = {}) {
  if (!RUNA_API_KEY) {
    throw new Error("RUNA_API_KEY is not configured")
  }
  const { idempotencyKey, sync, ...rest } = options
  const response = await fetch(`${RUNA_BASE_URL}${endpoint}`, {
    ...rest,
    headers: {
      "X-Api-Key": RUNA_API_KEY,
      "Content-Type": "application/json",
      ...(idempotencyKey ? { "X-Idempotency-Key": idempotencyKey } : {}),
      ...(sync ? { "x-execution-mode": "sync" } : {}),
      ...rest.headers,
    },
  })
  return response
}

export interface RunaProduct {
  code: string // Runa's product identifier — used as products.value on order creation, not "id"
  name: string
  currency: string
  state: string // e.g. "LIVE"
  is_orderable: boolean
  categories: string[]
  countries_redeemable_in: string[]
}

/** GET /products — catalog browsing, filterable by country. Real response is `{ catalog: [...] }`, paginated. */
export async function listProducts(country?: string): Promise<RunaProduct[]> {
  const qs = country ? `?countries_redeemable_in=${encodeURIComponent(country)}` : ""
  const res = await runaFetch(`/products${qs}`)
  if (!res.ok) throw new Error(`Failed to list Runa products: ${await res.text()}`)
  const data = await res.json()
  return data.catalog ?? []
}

export interface RunaOrderInput {
  amount: number
  currency: string
  recipientEmail: string
  /** Runa's product `code` (e.g. "AMZ-US"), not an arbitrary id — from listProducts(). */
  productCode: string
  externalId: string
}

export interface RunaOrder {
  id: string
  status: string
}

/**
 * Creates a one-item order, synchronously (x-execution-mode: sync), paid
 * from the platform's Runa account balance, delivered by email. Runa's
 * "items" array supports multiple products per order — QuillGlow only
 * ever sends one, matching how every other Rail-1 provider in this
 * codebase issues a single reward per redemption.
 */
export async function createOrder(input: RunaOrderInput): Promise<RunaOrder> {
  const res = await runaFetch("/orders", {
    method: "POST",
    idempotencyKey: input.externalId,
    sync: true,
    body: JSON.stringify({
      payment_method: { type: "ACCOUNT_BALANCE", currency: input.currency },
      items: [
        {
          face_value: input.amount,
          distribution_method: { type: "EMAIL", email_address: input.recipientEmail },
          products: { type: "SINGLE", value: input.productCode },
        },
      ],
    }),
  })
  if (!res.ok) throw new Error(`Runa order creation failed: ${await res.text()}`)
  const data = await res.json()
  return { id: data.id, status: data.status }
}

/** GET /orders/{id} — status polling, used for reconciliation and for async-mode orders. */
export async function getOrder(orderId: string): Promise<RunaOrder> {
  const res = await runaFetch(`/orders/${orderId}`)
  if (!res.ok) throw new Error(`Failed to get Runa order: ${await res.text()}`)
  const data = await res.json()
  return { id: data.id, status: data.status }
}

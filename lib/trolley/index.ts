import "server-only"
import { createHmac } from "node:crypto"

/**
 * Trolley API client — raw HTTP layer, mirrors lib/tremendous/index.ts.
 * Verified against https://developers.trolley.com/api/ — matches
 * Trolley's documented scheme exactly:
 *
 *   Authorization: prsign ACCESS_KEY:SIGNATURE
 *   X-PR-Timestamp: <unix seconds, must be within 30s of request>
 *   SIGNATURE = HMAC-SHA256(secret, `${timestamp}\n${METHOD}\n${requestPath}\n${body}\n`)
 *
 * Sandbox vs production is the SAME base URL (api.trolley.com) — sandbox is
 * a separate merchant account with its own key pair, not a separate
 * domain. Switch environments by generating sandbox keys in the Trolley
 * dashboard's sandbox mode, not by changing TROLLEY_BASE_URL.
 *
 * Registered again as a Rail 2/3 option alongside Stripe Connect and
 * Airwallex — this file's logic previously ran in production and is
 * restored as-is; only its registration status (active vs. inactive) has
 * changed across migrations.
 */

const TROLLEY_BASE_URL = process.env.TROLLEY_BASE_URL || "https://api.trolley.com"
const TROLLEY_API_KEY = process.env.TROLLEY_API_KEY
const TROLLEY_API_SECRET = process.env.TROLLEY_API_SECRET

function signRequest(method: string, requestPath: string, body: string) {
  if (!TROLLEY_API_KEY || !TROLLEY_API_SECRET) {
    throw new Error("TROLLEY_API_KEY / TROLLEY_API_SECRET are not configured")
  }
  const timestamp = Math.floor(Date.now() / 1000).toString()
  const message = `${timestamp}\n${method.toUpperCase()}\n${requestPath}\n${body}\n`
  const signature = createHmac("sha256", TROLLEY_API_SECRET).update(message).digest("hex")
  return {
    Authorization: `prsign ${TROLLEY_API_KEY}:${signature}`,
    "X-PR-Timestamp": timestamp,
    "Content-Type": "application/json",
  }
}

async function trolleyFetch(method: "GET" | "POST" | "PATCH" | "DELETE", requestPath: string, body?: unknown) {
  const bodyStr = body ? JSON.stringify(body) : ""
  const headers = signRequest(method, requestPath, bodyStr)

  const res = await fetch(`${TROLLEY_BASE_URL}${requestPath}`, {
    method,
    headers,
    body: bodyStr || undefined,
  })

  const data = await res.json().catch(() => null)
  if (!res.ok || data?.ok === false) {
    const message =
      data?.errors?.map((e: any) => `${e.field ? e.field + ": " : ""}${e.message}`).join("; ") ?? res.statusText
    throw new Error(`Trolley API error (${res.status}): ${message}`)
  }
  return data
}

export interface TrolleyRecipient {
  id: string
  status: string
}

/**
 * Recipients must exist before a payment can be sent. Searched by
 * referenceId (our internal student user_id or institution id) so a repeat
 * redemption always maps to the same Trolley recipient instead of
 * duplicating one every time.
 */
export async function findOrCreateRecipient(input: {
  email: string
  name?: string
  referenceId: string
  recipientType: "individual" | "business"
}): Promise<TrolleyRecipient> {
  const search = await trolleyFetch(
    "GET",
    `/v1/recipients?referenceId=${encodeURIComponent(input.referenceId)}`,
  )
  const existing = search?.recipients?.[0]
  if (existing) return { id: existing.id, status: existing.status }

  const [firstName, ...rest] = (input.name || input.email).trim().split(/\s+/)
  const created = await trolleyFetch("POST", "/v1/recipients/", {
    referenceId: input.referenceId,
    type: input.recipientType,
    email: input.email,
    ...(input.recipientType === "business"
      ? { name: input.name || input.email }
      : { firstName: firstName || input.email, lastName: rest.join(" ") || "Recipient" }),
  })
  return { id: created.recipient.id, status: created.recipient.status }
}

export interface TrolleyPaymentResult {
  batchId: string
  paymentId: string
  status: string
}

/**
 * Creates a batch with one embedded payment and immediately starts
 * processing it — Trolley's API creates the batch and its payments in a
 * single POST (payments is an array on the batch creation body), then a
 * separate call moves it from draft to processing.
 */
export async function sendPayment(input: {
  recipientId: string
  amount: number
  currency: string
  externalId: string
  memo?: string
}): Promise<TrolleyPaymentResult> {
  const batch = await trolleyFetch("POST", "/v1/batches", {
    description: input.memo ?? `QuillGlow payout ${input.externalId}`,
    payments: [
      {
        recipient: { id: input.recipientId },
        sourceAmount: input.amount.toFixed(2),
        sourceCurrency: input.currency,
        memo: input.memo,
        externalId: input.externalId,
      },
    ],
  })

  const batchId = batch.batch.id
  const paymentId = batch.batch.payments?.[0]?.id

  await trolleyFetch("POST", `/v1/batches/${batchId}/start-processing`, {})

  return { batchId, paymentId, status: "pending" }
}

/** Fetch payment status — for reconciliation if a webhook is missed. */
export async function getPayment(paymentId: string): Promise<{ status: string }> {
  const data = await trolleyFetch("GET", `/v1/payments/${paymentId}`)
  return { status: data.payment.status }
}

/**
 * Builds a signed link to Trolley's hosted onboarding form (the "Widget").
 * A recipient created via the API has only an email — no bank account, no
 * payout method — so they can't be paid until they complete this form
 * themselves. Different auth scheme than the REST API: the query string
 * itself is signed (not method+path+body), and it's served from a
 * different host (widget.trolley.com, not api.trolley.com).
 * Signature is only valid for 30 seconds, so this must be generated fresh
 * on every request — never cache or store the resulting URL.
 */
export function buildRecipientOnboardingUrl(input: { email: string; referenceId: string }): string {
  if (!TROLLEY_API_KEY || !TROLLEY_API_SECRET) {
    throw new Error("TROLLEY_API_KEY / TROLLEY_API_SECRET are not configured")
  }
  const params = new URLSearchParams({
    ts: Math.floor(Date.now() / 1000).toString(),
    key: TROLLEY_API_KEY,
    email: input.email,
    refid: input.referenceId,
    products: "pay", // only the payout-method onboarding module — not tax/trust
  })
  const queryString = params.toString().replace(/\+/g, "%20")
  const signature = createHmac("sha256", TROLLEY_API_SECRET).update(queryString).digest("hex")
  return `https://widget.trolley.com?${queryString}&sign=${signature}`
}

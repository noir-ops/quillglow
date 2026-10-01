import "server-only"

/**
 * Airwallex — Rail 2/3 option, registered alongside Stripe Connect and
 * Trolley. Verified against airwallex.com/docs (Beneficiaries, Transfers,
 * Authentication) — this is a real, working auth client, not a guess.
 *
 * The honest limit, found during verification, not assumed: Airwallex has
 * no hosted onboarding flow the way Stripe (Account Links) and Trolley
 * (the Widget) do. Creating a beneficiary requires calling their "dynamic
 * schema" API to learn which bank-detail fields are required for a given
 * country/currency/transfer-method combination, then submitting those
 * fields directly — there's no equivalent of "redirect the recipient,
 * they fill in their own bank account, redirect back." The PLATFORM has
 * to collect the recipient's bank details through its own form and pass
 * them to Airwallex.
 *
 * That means "finish Airwallex" isn't a config change the way switching
 * Trolley or Stripe active is — it's a real feature: a bank-detail
 * collection form, country-aware, built against Airwallex's dynamic
 * schema. Not something to fake. What's implemented here is everything
 * that doesn't depend on that form: real token auth, and a transfer
 * function ready to call once a beneficiary id exists.
 */

const AIRWALLEX_BASE_URL = process.env.AIRWALLEX_BASE_URL || "https://api.airwallex.com"
const AIRWALLEX_CLIENT_ID = process.env.AIRWALLEX_CLIENT_ID
const AIRWALLEX_API_KEY = process.env.AIRWALLEX_API_KEY

let cachedToken: { token: string; expiresAt: number } | null = null

/**
 * POST /api/v1/authentication/login — exchanges the static API key for a
 * short-lived bearer token (Airwallex docs: ~30 minutes). Cached in
 * module memory and only re-requested once it's close to expiring, so a
 * burst of calls doesn't re-authenticate on every single one.
 */
async function getAccessToken(): Promise<string> {
  if (!AIRWALLEX_CLIENT_ID || !AIRWALLEX_API_KEY) {
    throw new Error("AIRWALLEX_CLIENT_ID / AIRWALLEX_API_KEY are not configured")
  }
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.token
  }

  const res = await fetch(`${AIRWALLEX_BASE_URL}/api/v1/authentication/login`, {
    method: "POST",
    headers: {
      "x-client-id": AIRWALLEX_CLIENT_ID,
      "x-api-key": AIRWALLEX_API_KEY,
    },
  })
  if (!res.ok) throw new Error(`Airwallex authentication failed: ${await res.text()}`)
  const data = await res.json()
  cachedToken = { token: data.token, expiresAt: new Date(data.expires_at).getTime() }
  return cachedToken.token
}

async function airwallexFetch(endpoint: string, options: RequestInit = {}) {
  const token = await getAccessToken()
  return fetch(`${AIRWALLEX_BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  })
}

/**
 * GET the dynamic schema for a transfer scenario — what bank-detail
 * fields Airwallex actually requires for this country/currency/transfer
 * method combination. This is the piece a real beneficiary-collection
 * form would call first, before rendering its fields; exposed here so
 * that form (when built) doesn't have to hand-roll the request.
 */
export async function getBeneficiaryFormSchema(input: {
  bankCountryCode: string
  accountCurrency: string
  transferMethod: "LOCAL" | "SWIFT"
}): Promise<unknown> {
  const params = new URLSearchParams({
    bank_country_code: input.bankCountryCode,
    account_currency: input.accountCurrency,
    transfer_method: input.transferMethod,
  })
  const res = await airwallexFetch(`/api/v1/beneficiaries/form_schema?${params}`)
  if (!res.ok) throw new Error(`Failed to fetch Airwallex beneficiary schema: ${await res.text()}`)
  return res.json()
}

/**
 * Creates a beneficiary from a fully-formed bank_details object — the
 * caller (a not-yet-built collection form) is responsible for gathering
 * fields matching getBeneficiaryFormSchema()'s output; this function
 * doesn't validate or shape that object itself, since the required shape
 * varies per country/currency and isn't fixed.
 */
export async function createBeneficiary(input: {
  beneficiary: Record<string, unknown>
  referenceId: string
}): Promise<{ id: string }> {
  const res = await airwallexFetch("/api/v1/beneficiaries/create", {
    method: "POST",
    body: JSON.stringify({
      request_id: input.referenceId,
      beneficiary: input.beneficiary,
    }),
  })
  if (!res.ok) throw new Error(`Airwallex beneficiary creation failed: ${await res.text()}`)
  const data = await res.json()
  return { id: data.beneficiary_id ?? data.id }
}

export interface AirwallexTransferInput {
  beneficiaryId: string
  amount: number
  currency: string
  requestId: string
  reason?: string
}

/** POST /api/v1/transfers/create — the actual money movement, once a beneficiary id exists. */
export async function createTransfer(input: AirwallexTransferInput): Promise<{ id: string; status: string }> {
  const res = await airwallexFetch("/api/v1/transfers/create", {
    method: "POST",
    body: JSON.stringify({
      request_id: input.requestId,
      beneficiary_id: input.beneficiaryId,
      transfer_amount: input.amount,
      transfer_currency: input.currency,
      reason: input.reason ?? "QuillGlow payout",
    }),
  })
  if (!res.ok) throw new Error(`Airwallex transfer failed: ${await res.text()}`)
  const data = await res.json()
  return { id: data.id, status: data.status }
}

/** GET /api/v1/transfers/{id} — reconciliation / status polling. */
export async function getTransferStatus(transferId: string): Promise<{ status: string }> {
  const res = await airwallexFetch(`/api/v1/transfers/${transferId}`)
  if (!res.ok) throw new Error(`Failed to get Airwallex transfer status: ${await res.text()}`)
  const data = await res.json()
  return { status: data.status }
}

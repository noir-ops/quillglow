/**
 * The contract every disbursement provider implements. This is the ONLY
 * thing scholarship/wallet business logic is allowed to know about — never
 * "Tremendous", never "Runa", never "Stripe". Swapping the provider behind
 * a rail is a config change (disbursement_providers table), not a code
 * change here.
 *
 * Four rails, four purposes (see 038/042 migrations):
 *   Rail 1 — Controlled Student Benefits (gift cards, prepaid cards)
 *   Rail 2 — Institutional Funding (tuition paid direct to a school)
 *   Rail 3 — Recipient/Guardian Payout (real cash — bank/PayPal)
 *   Rail 4 — Blockchain/Stablecoin Payout (USDC to a wallet address) —
 *            future-use scaffolding, not yet exposed in any student/admin
 *            flow; integration surface only.
 * Rail 0 isn't a provider at all — it's the ledger itself (Postgres).
 *
 * A rail can have MORE THAN ONE registered provider (e.g. Rail 1 has both
 * Tremendous and Runa) — only one is ever "active" at a time per
 * disbursement_providers, and the registry resolves to that one. Having a
 * second registered-but-inactive provider is how a rail stays swappable
 * without deploying new code the day you actually want to switch.
 */

export type DisbursementRail = 1 | 2 | 3 | 4

export interface PayoutRecipient {
  email: string
  name?: string
  /** Only rails 2/3 need this; rail 1 (gift cards) doesn't. */
  country?: string
  /** Rail 4 only — the destination wallet address for a stablecoin payout. */
  walletAddress?: string
  /** Rail 4 only — which chain walletAddress lives on, e.g. "ETH", "MATIC", "SOL", "BASE". */
  chain?: string
}

export interface CreatePayoutInput {
  /** Our internal payout_orders.id — every provider's external_id/reference must be set to this for idempotent retries. */
  idempotencyKey: string
  amount: number
  currency: string
  recipient: PayoutRecipient
  /** Rail 1 only: a specific card/gift-card product. Other rails ignore this. */
  productId?: string
}

export interface PayoutResult {
  /** The provider's own id for this payout — stored generically, never in a provider-named column. */
  providerPayoutId: string
  /** A secondary id if the provider splits order/reward, transfer/leg, etc. Optional. */
  providerSecondaryId?: string
  /** Where the recipient claims/receives the money, if the provider returns one synchronously. */
  redemptionUrl?: string
  status: "created" | "pending" | "delivered"
}

export interface PayoutProductOption {
  id: string
  name: string
  category: string
}

export interface OnboardingLinkInput {
  email: string
  name?: string
}

export interface PayoutProvider {
  /** Machine key stored in disbursement_providers.provider_key — e.g. "tremendous", "runa", "stripe_connect", "trolley", "airwallex", "circle". */
  readonly key: string
  readonly rail: DisbursementRail
  createPayout(input: CreatePayoutInput): Promise<PayoutResult>
  getPayoutStatus(providerPayoutId: string): Promise<{ status: string }>
  /**
   * Rail 1 only (gift card / prepaid card catalog). Optional because rails
   * 2–4 don't have a "pick a product" step — omit entirely on those
   * adapters rather than implementing a no-op.
   */
  listProducts?(): Promise<PayoutProductOption[]>
  /**
   * Rails 2/3 only, and only for providers whose recipients need to
   * complete hosted onboarding (bank details, KYC) before they can be
   * paid — Stripe Connect and Trolley both need this; Tremendous doesn't
   * (email is enough). Optional so email-only providers don't need a
   * no-op implementation. Callers that need an onboarding link (the
   * internal cross-app endpoint, and createPayout's own pre-flight
   * readiness check) go through this instead of importing a specific
   * provider's client — this is what keeps the onboarding-link endpoint
   * provider-agnostic even with two live onboarding-requiring providers
   * registered on the same rail.
   */
  getOnboardingUrl?(input: OnboardingLinkInput): Promise<string>
}

/** Thrown by stub adapters until real credentials are configured — a clean, expected failure mode, not a bug. */
export class ProviderNotConfiguredError extends Error {
  constructor(providerKey: string) {
    super(`Provider "${providerKey}" is not yet configured — add its API credentials to enable this rail.`)
    this.name = "ProviderNotConfiguredError"
  }
}

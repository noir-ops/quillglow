import { findOrCreateConnectedAccount, createOnboardingLink, createTransfer, getTransfer } from "@/lib/stripe-connect"
import type { CreatePayoutInput, DisbursementRail, OnboardingLinkInput, PayoutProvider } from "../types"
import { ProviderNotConfiguredError } from "../types"

/**
 * Adapter, not the client — lib/stripe-connect/index.ts is the raw Stripe
 * wrapper; this translates the generic PayoutProvider contract into
 * Stripe's connected-account + transfer shape. Serves both Rail 2
 * (institutions) and Rail 3 (students/guardians). Registered alongside
 * Trolley and Airwallex on both rails — Stripe is the active default on
 * both; the others are there as switchable options.
 */
function makeStripeConnectProvider(rail: DisbursementRail): PayoutProvider {
  const provider: PayoutProvider = {
    key: "stripe_connect",
    rail,

    async createPayout(input: CreatePayoutInput) {
      if (!process.env.STRIPE_SECRET_KEY) {
        throw new ProviderNotConfiguredError("stripe_connect")
      }

      // Cached by email (040) — a repeat redemption/institutional payment
      // always resolves to the same connected account.
      const account = await findOrCreateConnectedAccount({
        email: input.recipient.email,
        name: input.recipient.name,
        rail,
        country: input.recipient.country,
      })

      // A freshly created (or still-incomplete) connected account can't
      // receive transfers yet — Stripe requires onboarding (KYC, bank
      // details) first. Check readiness ourselves and fail with an
      // actionable onboarding link, rather than letting Stripe's transfer
      // call reject with a less useful error.
      if (!account.payoutsEnabled) {
        const onboardingUrl = await provider.getOnboardingUrl!({
          email: input.recipient.email,
          name: input.recipient.name,
        })
        throw new Error(
          `${input.recipient.name ?? input.recipient.email} hasn't finished payout setup yet. ` +
            `They need to complete onboarding first: ${onboardingUrl}`,
        )
      }

      const transfer = await createTransfer({
        stripeAccountId: account.id,
        amount: input.amount,
        currency: input.currency,
        idempotencyKey: input.idempotencyKey,
        description: rail === 2 ? "QuillGlow institutional payment" : "QuillGlow scholarship payout",
      })

      return {
        providerPayoutId: transfer.id,
        status: "pending" as const,
      }
    },

    async getPayoutStatus(providerPayoutId: string) {
      const transfer = await getTransfer(providerPayoutId)
      return { status: transfer.status }
    },

    async getOnboardingUrl(input: OnboardingLinkInput): Promise<string> {
      if (!process.env.STRIPE_SECRET_KEY) {
        throw new ProviderNotConfiguredError("stripe_connect")
      }
      const account = await findOrCreateConnectedAccount({ email: input.email, name: input.name, rail })
      const appUrl = process.env.QUILLGLOW_APP_URL ?? ""
      return createOnboardingLink(account.id, `${appUrl}/wallet?onboarding=refresh`, `${appUrl}/wallet?onboarding=complete`)
    },
  }

  return provider
}

export const stripeConnectInstitutionalProvider = makeStripeConnectProvider(2)
export const stripeConnectRecipientProvider = makeStripeConnectProvider(3)

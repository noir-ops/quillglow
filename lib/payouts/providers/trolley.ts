import { findOrCreateRecipient, sendPayment, getPayment, buildRecipientOnboardingUrl } from "@/lib/trolley"
import type { CreatePayoutInput, DisbursementRail, OnboardingLinkInput, PayoutProvider } from "../types"
import { ProviderNotConfiguredError } from "../types"

/**
 * Registered as a Rail 2/3 option alongside Stripe Connect and Airwallex —
 * inactive by default (Stripe Connect is the active provider on both
 * rails), switchable from /admin/disbursements with zero deploy.
 *
 * Institutions (rail 2) are onboarded as "business" recipients,
 * students/guardians (rail 3) as "individual" — the only real difference
 * between the two rail instances.
 */
function makeTrolleyProvider(rail: DisbursementRail): PayoutProvider {
  const recipientType = rail === 2 ? "business" : "individual"

  const provider: PayoutProvider = {
    key: "trolley",
    rail,

    async createPayout(input: CreatePayoutInput) {
      if (!process.env.TROLLEY_API_KEY || !process.env.TROLLEY_API_SECRET) {
        throw new ProviderNotConfiguredError("trolley")
      }

      // referenceId must be stable per person/institution, not per payout —
      // email is the closest thing we have, so a repeat redemption always
      // resolves to the same Trolley recipient instead of duplicating one.
      const recipient = await findOrCreateRecipient({
        email: input.recipient.email,
        name: input.recipient.name,
        referenceId: input.recipient.email,
        recipientType,
      })

      // A recipient created via the API has no payout method yet — Trolley
      // rejects a payment attempt with a raw validation error in that case.
      // Check readiness ourselves first and fail with an actionable
      // onboarding link instead of surfacing Trolley's internal field names.
      if (recipient.status !== "active") {
        const onboardingUrl = await provider.getOnboardingUrl!({
          email: input.recipient.email,
          name: input.recipient.name,
        })
        throw new Error(
          `${input.recipient.name ?? input.recipient.email} hasn't added a payout method yet. ` +
            `They need to complete onboarding first: ${onboardingUrl}`,
        )
      }

      const payment = await sendPayment({
        recipientId: recipient.id,
        amount: input.amount,
        currency: input.currency,
        externalId: input.idempotencyKey,
        memo: rail === 2 ? "QuillGlow institutional payment" : "QuillGlow scholarship payout",
      })

      return {
        providerPayoutId: payment.paymentId,
        providerSecondaryId: payment.batchId,
        status: "pending" as const,
      }
    },

    async getPayoutStatus(providerPayoutId: string) {
      const payment = await getPayment(providerPayoutId)
      return { status: payment.status }
    },

    async getOnboardingUrl(input: OnboardingLinkInput): Promise<string> {
      if (!process.env.TROLLEY_API_KEY || !process.env.TROLLEY_API_SECRET) {
        throw new ProviderNotConfiguredError("trolley")
      }
      return buildRecipientOnboardingUrl({ email: input.email, referenceId: input.email })
    },
  }

  return provider
}

export const trolleyInstitutionalProvider = makeTrolleyProvider(2)
export const trolleyRecipientProvider = makeTrolleyProvider(3)

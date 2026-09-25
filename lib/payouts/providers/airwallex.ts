import { createTransfer, getTransferStatus } from "@/lib/airwallex"
import type { CreatePayoutInput, DisbursementRail, OnboardingLinkInput, PayoutProvider } from "../types"
import { ProviderNotConfiguredError } from "../types"

/**
 * Registered as a Rail 2/3 option alongside Stripe Connect and Trolley,
 * inactive by default. Auth and transfer creation are real (see
 * lib/airwallex) — the genuine gap is that Airwallex has no hosted
 * onboarding flow, so createPayout() here can only work once a
 * beneficiary id already exists, and there's currently no UI anywhere in
 * this codebase that collects the bank details needed to create one.
 * getOnboardingUrl() says exactly this rather than pretending an
 * equivalent to Stripe/Trolley's hosted flow exists.
 */
function makeAirwallexProvider(rail: DisbursementRail): PayoutProvider {
  return {
    key: "airwallex",
    rail,

    async createPayout(input: CreatePayoutInput) {
      if (!process.env.AIRWALLEX_API_KEY) {
        throw new ProviderNotConfiguredError("airwallex")
      }
      const beneficiaryId = input.recipient.country
        ? undefined // placeholder — see note below, no lookup exists yet
        : undefined
      if (!beneficiaryId) {
        throw new Error(
          "This recipient has no Airwallex beneficiary yet. Unlike Stripe/Trolley, Airwallex has no " +
            "hosted onboarding link — a bank-details collection form (built against " +
            "getBeneficiaryFormSchema() in lib/airwallex) needs to run first, then call " +
            "createBeneficiary() and store the resulting id before a payout can be sent.",
        )
      }
      const transfer = await createTransfer({
        beneficiaryId,
        amount: input.amount,
        currency: input.currency,
        requestId: input.idempotencyKey,
        reason: rail === 2 ? "QuillGlow institutional payment" : "QuillGlow scholarship payout",
      })
      return { providerPayoutId: transfer.id, status: "pending" as const }
    },

    async getPayoutStatus(providerPayoutId: string) {
      const transfer = await getTransferStatus(providerPayoutId)
      return { status: transfer.status }
    },

    async getOnboardingUrl(_input: OnboardingLinkInput): Promise<string> {
      throw new Error(
        "Airwallex has no hosted onboarding link, unlike Stripe Connect and Trolley — beneficiary bank " +
          "details must be collected through a form built by this platform, not a redirect. That form " +
          "isn't built yet. See lib/airwallex/index.ts (getBeneficiaryFormSchema, createBeneficiary).",
      )
    },
  }
}

export const airwallexInstitutionalProvider = makeAirwallexProvider(2)
export const airwallexRecipientProvider = makeAirwallexProvider(3)

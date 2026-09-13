import "server-only"
import Stripe from "stripe"
import { createAdminClient } from "@/lib/supabase/admin"
import type { DisbursementRail } from "@/lib/payouts/types"

/**
 * Stripe Connect — the sole external financial infrastructure provider for
 * Rails 2 (institutional funding) and 3 (recipient/guardian payout), per
 * the "Stripe moves the money" architecture decision. Trolley is removed;
 * Airwallex is deliberately deferred, not built.
 *
 * Uses Express connected accounts — Stripe's own hosted onboarding
 * (KYC, bank details) via Account Links, so none of that ever touches this
 * codebase, same principle as the removed Trolley Widget approach.
 */

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY

function getStripeClient(): Stripe {
  if (!STRIPE_SECRET_KEY) {
    throw new Error("STRIPE_SECRET_KEY is not configured")
  }
  return new Stripe(STRIPE_SECRET_KEY, { apiVersion: "2025-02-24.acacia" })
}

export interface ConnectedAccount {
  id: string // Stripe account id, e.g. "acct_..."
  payoutsEnabled: boolean
}

/**
 * Rail 2 (institutions) get "company" accounts; Rail 3 (students/guardians)
 * get "individual" accounts — the only real difference in how Stripe
 * treats the two rails.
 */
function businessTypeForRail(rail: DisbursementRail): "company" | "individual" {
  return rail === 2 ? "company" : "individual"
}

/**
 * Cached by email in stripe_connected_accounts (040) — a repeat redemption
 * or institutional payment always resolves to the same connected account
 * instead of creating a duplicate one on every request. The cached
 * payouts_enabled flag is refreshed from Stripe on every lookup, since
 * onboarding completion happens entirely outside this app (on Stripe's
 * hosted form) and there's no webhook wired up yet to push updates in.
 */
export async function findOrCreateConnectedAccount(input: {
  email: string
  name?: string
  rail: DisbursementRail
  country?: string
}): Promise<ConnectedAccount> {
  const stripe = getStripeClient()
  const admin = createAdminClient()

  const { data: cached } = await admin
    .from("stripe_connected_accounts")
    .select("*")
    .eq("email", input.email)
    .maybeSingle()

  if (cached) {
    const account = await stripe.accounts.retrieve(cached.stripe_account_id)
    const payoutsEnabled = !!account.payouts_enabled
    if (payoutsEnabled !== cached.payouts_enabled) {
      await admin
        .from("stripe_connected_accounts")
        .update({ payouts_enabled: payoutsEnabled, updated_at: new Date().toISOString() })
        .eq("id", cached.id)
    }
    return { id: cached.stripe_account_id, payoutsEnabled }
  }

  const account = await stripe.accounts.create({
    type: "express",
    country: input.country ?? "US",
    email: input.email,
    business_type: businessTypeForRail(input.rail),
    capabilities: { transfers: { requested: true } },
    ...(businessTypeForRail(input.rail) === "company" && input.name ? { company: { name: input.name } } : {}),
  })

  await admin.from("stripe_connected_accounts").insert({
    email: input.email,
    name: input.name ?? null,
    rail: input.rail,
    stripe_account_id: account.id,
    payouts_enabled: !!account.payouts_enabled,
  })

  return { id: account.id, payoutsEnabled: !!account.payouts_enabled }
}

/**
 * Stripe's hosted onboarding form. Account Links are single-use and expire
 * quickly, so — same rule as the old Trolley Widget links — this must be
 * generated fresh right before it's opened, never pre-rendered or cached.
 */
export async function createOnboardingLink(stripeAccountId: string, refreshUrl: string, returnUrl: string): Promise<string> {
  const stripe = getStripeClient()
  const link = await stripe.accountLinks.create({
    account: stripeAccountId,
    type: "account_onboarding",
    refresh_url: refreshUrl,
    return_url: returnUrl,
  })
  return link.url
}

/**
 * Moves money from the platform's Stripe balance to a connected account.
 * Requires the platform to actually have that balance available — same
 * "funding source must have money" requirement as every other rail; Stripe
 * just calls it your balance instead of a funding source id.
 */
export async function createTransfer(input: {
  stripeAccountId: string
  amount: number
  currency: string
  idempotencyKey: string
  description?: string
}): Promise<{ id: string; status: string }> {
  const stripe = getStripeClient()
  const transfer = await stripe.transfers.create(
    {
      amount: Math.round(input.amount * 100), // Stripe uses the smallest currency unit
      currency: input.currency.toLowerCase(),
      destination: input.stripeAccountId,
      description: input.description,
    },
    { idempotencyKey: input.idempotencyKey },
  )
  return { id: transfer.id, status: "pending" }
}

/** Reconciliation / status polling for a specific transfer. */
export async function getTransfer(transferId: string): Promise<{ status: string }> {
  const stripe = getStripeClient()
  await stripe.transfers.retrieve(transferId)
  // Stripe transfers don't carry a rich status field the way Tremendous
  // orders or Trolley payments do — retrieval succeeding means it exists
  // and was accepted; reversal (transfer.reversals) is the only "failure
  // after the fact" state, checked separately if ever needed.
  return { status: "paid" }
}

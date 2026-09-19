import { createAdminClient } from "@/lib/supabase/admin"
import { tremendousProvider } from "./providers/tremendous"
import { runaProvider } from "./providers/runa"
import { stripeConnectInstitutionalProvider, stripeConnectRecipientProvider } from "./providers/stripe-connect"
import { trolleyInstitutionalProvider, trolleyRecipientProvider } from "./providers/trolley"
import { airwallexInstitutionalProvider, airwallexRecipientProvider } from "./providers/airwallex"
import { circleProvider } from "./providers/circle"
import type { DisbursementRail, PayoutProvider } from "./types"

/**
 * This is the ONLY file in the codebase that maps a provider_key string to
 * an actual adapter class — pure wiring, not business logic. Everything
 * that moves money (the wallet route, institutional/recipient payout
 * routes, and the internal onboarding-link endpoint) calls
 * getActiveProvider(rail) and never imports an adapter directly.
 *
 * WHICH provider is active per rail lives in the disbursement_providers
 * table, not here — so a provider swap on any rail is a database update
 * (or an admin-panel toggle), never a deploy.
 *
 * Current roster (see 038/040/042/043 migrations):
 *   Rail 1 — Tremendous (active), Runa (registered, inactive)
 *   Rail 2 — Stripe Connect (active), Trolley (registered, inactive), Airwallex (registered, inactive)
 *   Rail 3 — Stripe Connect (active), Trolley (registered, inactive), Airwallex (registered, inactive)
 *   Rail 4 — Circle (registered, future-use — no route calls this rail yet)
 *
 * Rails 2/3 deliberately carry three registered options each: real choice
 * between providers is the point of this architecture (negotiating
 * leverage, geographic coverage, a fallback if one has an outage) — Stripe
 * being active today doesn't mean Trolley or Airwallex code goes away.
 */
const ADAPTERS: Record<string, PayoutProvider> = {
  tremendous: tremendousProvider,
  runa: runaProvider,
  "stripe_connect:2": stripeConnectInstitutionalProvider,
  "stripe_connect:3": stripeConnectRecipientProvider,
  "trolley:2": trolleyInstitutionalProvider,
  "trolley:3": trolleyRecipientProvider,
  "airwallex:2": airwallexInstitutionalProvider,
  "airwallex:3": airwallexRecipientProvider,
  circle: circleProvider,
}

function resolveAdapter(providerKey: string, rail: DisbursementRail): PayoutProvider | undefined {
  // Stripe Connect, Trolley, and Airwallex each serve two rails with
  // different semantics (company vs. individual accounts/recipients), so
  // they're keyed by rail too. Tremendous, Runa, and Circle each only
  // ever serve one rail.
  return ADAPTERS[providerKey] ?? ADAPTERS[`${providerKey}:${rail}`]
}

/**
 * Looks up the active provider for a rail from disbursement_providers.
 * Falls back to a seed default only if the table is empty/unreachable —
 * that fallback lives here as one named constant, not scattered through
 * business logic, and is only ever a bootstrapping safety net.
 */
export async function getActiveProvider(rail: DisbursementRail): Promise<PayoutProvider> {
  const admin = createAdminClient()
  const { data } = await admin
    .from("disbursement_providers")
    .select("provider_key")
    .eq("rail", rail)
    .eq("is_active", true)
    .maybeSingle()

  const providerKey = data?.provider_key ?? DEFAULT_PROVIDER_BY_RAIL[rail]
  const adapter = resolveAdapter(providerKey, rail)

  if (!adapter) {
    throw new Error(`No provider adapter registered for rail ${rail} (resolved key: "${providerKey}")`)
  }
  return adapter
}

const DEFAULT_PROVIDER_BY_RAIL: Record<DisbursementRail, string> = {
  1: "tremendous",
  2: "stripe_connect",
  3: "stripe_connect",
  4: "circle",
}

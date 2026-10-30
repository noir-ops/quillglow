import { createAdminClient } from "@/lib/supabase/admin"

export interface BillingRollout {
  id: boolean; revision: number; legacy_monthly_cents: number; monthly_cents: number; annual_cents: number
  currency: string; legacy_product_id: string | null; monthly_product_id: string | null; annual_product_id: string | null
  launch_at: string | null; authorized_at: string | null; phase3_enabled: boolean; phase3_started_at: string | null
  environment?: "sandbox" | "production"
}
/** Bootstrap compatibility only. After migration, the single DB row supplies every amount. */
export const LEGACY_ROLLOUT: BillingRollout = { id: true, revision: 0, legacy_monthly_cents: 499, monthly_cents: 599,
  annual_cents: 5999, currency: "usd", legacy_product_id: null, monthly_product_id: null, annual_product_id: null,
  launch_at: null, authorized_at: null, phase3_enabled: false, phase3_started_at: null }

export async function readBillingRollout(admin: any = createAdminClient()): Promise<BillingRollout> {
  const { data, error } = await admin.from("billing_rollout").select("*").eq("id", true).maybeSingle()
  if (error) {
    if (error.code === "42P01" || error.code === "PGRST205") return { ...LEGACY_ROLLOUT }
    throw new Error("Pricing is temporarily unavailable")
  }
  if (!data || Array.isArray(data)) throw new Error("Pricing configuration is missing")
  const environment = (process.env.POLAR_BASE_URL ?? "").includes("sandbox-api.polar.sh") ? "sandbox" : "production"
  if (data.authorized_at && data.environment !== environment) throw new Error("Pricing and Polar environments do not match")
  if (![data.legacy_monthly_cents, data.monthly_cents, data.annual_cents].every((n) => Number.isInteger(n) && n > 0) || data.currency !== "usd") {
    throw new Error("Invalid pricing configuration")
  }
  return data as BillingRollout
}
export function publicPricing(r: BillingRollout, now = Date.now()) {
  const launch = r.launch_at ? Date.parse(r.launch_at) : NaN
  const authorized = !!r.authorized_at && Number.isFinite(launch)
  const live = authorized && now >= launch
  return { revision: r.revision, currency: r.currency, monthlyCents: live ? r.monthly_cents : r.legacy_monthly_cents,
    annualCents: live ? r.annual_cents : null, annualAvailable: live,
    launchAt: authorized ? r.launch_at : null, scheduled: authorized && !live, live,
    upcomingMonthlyCents: authorized ? r.monthly_cents : null, upcomingAnnualCents: authorized ? r.annual_cents : null,
    phase3Enabled: live && r.phase3_enabled, legacySubscribersKeepRate: true,
    serverNow: new Date(now).toISOString() }
}
export type PublicPricing = ReturnType<typeof publicPricing>

export interface PublicPricing {
  revision: number; currency: string; monthlyCents: number; annualCents: number | null; annualAvailable: boolean
  launchAt: string | null; scheduled: boolean; live: boolean; upcomingMonthlyCents: number | null
  upcomingAnnualCents: number | null; phase3Enabled: boolean; legacySubscribersKeepRate: boolean; serverNow: string
}
export function formatPrice(cents: number, currency = "usd") {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cents / 100)
}

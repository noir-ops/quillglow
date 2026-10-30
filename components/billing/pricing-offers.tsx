"use client"
import { useEffect, useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { usePricing } from "@/lib/billing/use-pricing"
import { formatPrice } from "@/lib/billing/pricing-view"
import { PayWithFamilyWallet } from "@/components/family-wallet/pay-with-family-wallet"

export function GeniusPrice({ prefix = "", suffix = "" }: { prefix?: string; suffix?: string }) {
  const { pricing } = usePricing()
  return <span>{pricing ? `${prefix}${formatPrice(pricing.monthlyCents)}${suffix}` : "View Genius pricing"}</span>
}
export function PricingCampaign() {
  const { pricing, refresh } = usePricing(), [expired, setExpired] = useState(false)
  useEffect(() => {
    setExpired(false)
    if (!pricing?.scheduled || !pricing.launchAt) return
    const delay = Date.parse(pricing.launchAt) - Date.parse(pricing.serverNow)
    const timer = window.setTimeout(() => { setExpired(true); refresh() }, Math.min(Math.max(0, delay), 2147483647))
    return () => window.clearTimeout(timer)
  }, [pricing, refresh])
  if (!pricing?.scheduled || !pricing.launchAt || expired) return null
  return <aside className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-950 dark:bg-amber-950/30 dark:text-amber-100">
    <p className="font-bold">Last chance at the current monthly rate</p>
    <p className="mt-1 text-sm">New subscriptions change to {formatPrice(pricing.upcomingMonthlyCents!)} monthly or {formatPrice(pricing.upcomingAnnualCents!)} annually on {new Date(pricing.launchAt).toLocaleString("en-US", { timeZone: "UTC", dateStyle: "medium", timeStyle: "short" })} UTC. Existing subscriptions keep their current rate while they continue.</p>
    <Link className="mt-2 inline-block font-semibold underline" href="/upgrade">See plans</Link>
  </aside>
}
export function CheckoutOptions({ wallet = false, onSuccess }: { wallet?: boolean; onSuccess?: () => void }) {
  const { pricing, error: priceError, refresh } = usePricing(), [interval, setInterval] = useState<"month" | "year">("month")
  const [busy, setBusy] = useState(false), [error, setError] = useState("")
  useEffect(() => { if (new URLSearchParams(window.location.search).get("interval") === "year") setInterval("year") }, [])
  useEffect(() => { if (pricing && !pricing.annualAvailable) setInterval("month") }, [pricing])
  const checkout = async () => {
    if (!pricing) return
    setBusy(true); setError("")
    if (pricing.phase3Enabled) fetch("/api/billing/events", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind: "upgrade_click", feature: "upgrade" }) }).catch(() => {})
    try {
      const res = await fetch("/api/subscription/create-checkout", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planName: "genius", interval, expectedAmountCents: interval === "year" ? pricing.annualCents : pricing.monthlyCents }) })
      if (res.status === 401) { window.location.assign(`/auth/login?next=${encodeURIComponent(`/upgrade?interval=${interval}`)}`); return }
      const d = await res.json()
      if (!res.ok) { if (res.status === 409) await refresh(); throw new Error(d.error || "Could not start checkout") }
      window.location.assign(d.url || d.checkoutUrl)
    } catch (e) { setError(e instanceof Error ? e.message : "Could not start checkout"); setBusy(false) }
  }
  return <div className="w-full space-y-3">
    {priceError && <p role="alert" className="text-sm text-destructive">{priceError} <button className="underline" onClick={refresh}>Retry</button></p>}
    {pricing && <>
      <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Billing interval">
        <button role="radio" aria-checked={interval === "month"} disabled={busy} onClick={() => setInterval("month")} className={`rounded-xl border p-3 text-left ${interval === "month" ? "border-primary bg-primary/5" : "border-border"}`}><strong>{formatPrice(pricing.monthlyCents)} / month</strong><span className="block text-xs text-muted-foreground">Billed monthly</span></button>
        {pricing.annualAvailable && <button role="radio" aria-checked={interval === "year"} disabled={busy} onClick={() => setInterval("year")} className={`rounded-xl border p-3 text-left ${interval === "year" ? "border-primary bg-primary/5" : "border-border"}`}><strong>{formatPrice(pricing.annualCents!)} / year</strong><span className="block text-xs text-muted-foreground">Save {formatPrice(pricing.monthlyCents * 12 - pricing.annualCents!)} compared with 12 monthly payments</span></button>}
      </div>
      <p className="text-xs text-muted-foreground">Existing subscriptions keep their current rate. Discount codes can be entered at Polar checkout; eligibility and the final total are shown there.</p>
    </>}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    <Button className="w-full" size="lg" disabled={!pricing || busy || !!priceError} onClick={checkout}>{busy ? "Opening checkout…" : "Choose Genius"}</Button>
    {wallet && pricing && !priceError && interval === "month" && <PayWithFamilyWallet chargeEndpoint="/api/subscription/pay-with-family-wallet"
      chargeBody={{ expectedAmountCents: pricing.monthlyCents }} label={`Pay ${formatPrice(pricing.monthlyCents)} from family balance for 30-day access`} onSuccess={() => onSuccess?.()} />}
  </div>
}

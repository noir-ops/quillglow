"use client"
import { useCallback, useEffect, useState } from "react"
import type { PublicPricing } from "@/lib/billing/pricing-view"
let cached: PublicPricing | null = null, expires = 0, pending: Promise<PublicPricing> | null = null
async function fetchPricing(force = false): Promise<PublicPricing> {
  if (!force && cached && Date.now() < expires) return cached
  if (pending) return pending
  pending = fetch("/api/billing/pricing", { cache: "no-store" }).then(async (r) => {
    if (!r.ok) throw new Error("Current pricing is unavailable")
    const d = await r.json(); cached = d; expires = Date.now() + 15000; return d
  }).finally(() => { pending = null })
  return pending
}
export function usePricing() {
  const [pricing, setPricing] = useState<PublicPricing | null>(null), [error, setError] = useState("")
  const refresh = useCallback(async () => {
    try { setPricing(await fetchPricing(true)); setError("") } catch { setError("Could not load current pricing. Please retry.") }
  }, [])
  useEffect(() => {
    let active = true
    fetchPricing().then((d) => { if (active) setPricing(d) }).catch(() => { if (active) setError("Could not load current pricing. Please retry.") })
    const reload = () => { if (active) refresh() }
    window.addEventListener("focus", reload)
    const timer = window.setInterval(reload, 60000)
    return () => { active = false; window.clearInterval(timer); window.removeEventListener("focus", reload) }
  }, [refresh])
  useEffect(() => {
    if (!pricing?.scheduled || !pricing.launchAt) return
    const delay = Date.parse(pricing.launchAt) - Date.parse(pricing.serverNow)
    if (delay < 0) return
    const timer = window.setTimeout(refresh, Math.min(delay + 50, 2147483647))
    return () => window.clearTimeout(timer)
  }, [pricing, refresh])
  return { pricing, error, refresh }
}

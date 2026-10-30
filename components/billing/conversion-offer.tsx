"use client"
import { useEffect } from "react"
import Link from "next/link"
import { usePricing } from "@/lib/billing/use-pricing"
import type { FeatureUsage } from "@/lib/billing/usage"
const event = (kind: string, feature: string) => fetch("/api/billing/events", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind, feature }) }).catch(() => {})
export function OfferExposure({ feature }: { feature: string }) {
  const { pricing } = usePricing()
  useEffect(() => { if (pricing?.phase3Enabled) event("offer_view", feature) }, [pricing?.phase3Enabled, feature])
  return null
}
export function ConversionOffer({ feature = "upgrade" }: { feature?: string }) {
  const { pricing } = usePricing()
  useEffect(() => { if (pricing?.phase3Enabled) event("offer_view", feature) }, [pricing?.phase3Enabled, feature])
  if (!pricing?.phase3Enabled) return null
  return <Link className="text-sm font-semibold underline" href="/upgrade" onClick={() => event("upgrade_click", feature)}>Explore Genius for deeper study support</Link>
}
export function StudyPilotTaste({ usage }: { usage: FeatureUsage | null }) {
  const { pricing } = usePricing()
  if (!pricing?.phase3Enabled || !usage || usage.isGenius) return null
  return <aside className="rounded-xl border bg-primary/5 p-4 space-y-2"><p className="font-semibold">Try a complete StudyPilot system</p><p className="text-sm">{usage.unlimited ? "Your plan has no monthly run cap." : `${usage.remaining} of ${usage.limit} runs left this month.`} Weekly review tests have their own allowance in Settings → Plan &amp; usage.</p><ConversionOffer feature="study_agent" /></aside>
}

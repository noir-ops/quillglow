"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { PlanFeatures } from "@/components/billing/plan-features"
import { Check, Loader2, Sparkles } from "lucide-react"
import { PLAN_DETAILS, type Subscription, type UsageTracking } from "@/lib/types/subscription"
import { GeniusPrice, CheckoutOptions, PricingCampaign } from "@/components/billing/pricing-offers"
import { OfferExposure } from "@/components/billing/conversion-offer"
import { PlanUsage } from "@/components/billing/plan-usage"
import { useRouter } from "next/navigation"

export default function UpgradePage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [subscription, setSubscription] = useState<Subscription | null>(null)
  const [usage, setUsage] = useState<UsageTracking | null>(null)
  const [counts, setCounts] = useState({ flashcards: 0, notes: 0 })
  const [effectivePlan, setEffectivePlan] = useState<"scholar" | "genius" | null>(null)
  const [statusError, setStatusError] = useState("")

  useEffect(() => {
    fetchSubscriptionStatus()
  }, [])

  const fetchSubscriptionStatus = async () => {
    setStatusError("")
    try {
      const response = await fetch("/api/subscription/status")
      const data = await response.json()
      if (!response.ok || !["scholar", "genius"].includes(data.effectivePlan)) throw new Error("Could not verify your current plan")

      setSubscription(data.subscription)
      setUsage(data.usage)
      setCounts(data.counts)
      setEffectivePlan(data.effectivePlan ?? null)
    } catch (error) {
      console.error("[v0] Error fetching subscription:", error)
      setStatusError("Could not load your current plan. Please retry.")
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  if (statusError) return <div className="mx-auto max-w-xl space-y-4 p-8"><p role="alert">{statusError}</p><Button onClick={fetchSubscriptionStatus}>Retry</Button></div>

  // The one Genius rule (scripts/066) — not just the row's plan name.
  const isGenius = effectivePlan === "genius"


  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <PricingCampaign />
        <OfferExposure feature="upgrade" />

        {/* Current Plan */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-2xl">
                  {PLAN_DETAILS[isGenius ? "genius" : "scholar"].name} Plan
                </CardTitle>
                <CardDescription>
                  {isGenius ? "You&apos;re on Genius — higher limits on every AI tool" : "Your current usage and limits"}
                </CardDescription>
              </div>
              {isGenius && (
                <div className="flex items-center gap-2 text-primary">
                  <Sparkles className="h-5 w-5" />
                  <span className="font-semibold">Active</span>
                </div>
              )}
            </div>
          </CardHeader>
        </Card>

        {/* Live allowance — the numbers the server enforces (replaces the
            old hand-written limit bars, which didn't match). */}
        <PlanUsage />

        {/* Upgrade Card */}
        {!isGenius && (
          <Card className="border-primary">
            <CardHeader>
              <CardTitle className="text-2xl">Upgrade to Genius</CardTitle>
              <CardDescription>
                Higher limits on every AI tool, plus deeper personalisation, for <GeniusPrice suffix="/month" />
              </CardDescription>
            </CardHeader>
            <CardContent>
              <PlanFeatures plan="genius" />
            </CardContent>
            <CardFooter className="flex-col gap-3">
              <CheckoutOptions wallet onSuccess={() => { fetchSubscriptionStatus(); router.refresh() }} />
            </CardFooter>
          </Card>
        )}

        {/* Back to Dashboard */}
        <div className="text-center">
          <Button variant="ghost" onClick={() => router.push("/dashboard")}>
            Back to Dashboard
          </Button>
        </div>
      </div>
    </div>
  )
}

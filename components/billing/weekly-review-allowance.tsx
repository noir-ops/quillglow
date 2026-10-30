"use client"
import { useEffect } from "react"
import { usePricing } from "@/lib/billing/use-pricing"
import { useFeatureUsage } from "@/lib/billing/use-feature-usage"
function Meter() {
  const { usage, refreshUsage, usageError } = useFeatureUsage("/api/echomind/weekly-review/usage")
  useEffect(() => { window.addEventListener("quillglow:weekly-review-usage", refreshUsage); return () => window.removeEventListener("quillglow:weekly-review-usage", refreshUsage) }, [refreshUsage])
  return <p className="rounded-lg border p-3 text-sm">{usageError ? <>{usageError} <button className="underline" onClick={refreshUsage}>Retry</button></> : usage ? <>Weekly review pool: {usage.unlimited ? "no monthly limit" : `${usage.remaining} of ${usage.limit} tests left this month`}. This allowance is separate from EchoMind sessions.</> : "Loading weekly review allowance…"}</p>
}
export function WeeklyReviewAllowance() { const { pricing } = usePricing(); return pricing?.phase3Enabled ? <Meter /> : null }

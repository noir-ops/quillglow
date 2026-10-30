"use client"

import { useEffect, useState } from "react"
import { Check } from "lucide-react"
import { FEATURE_INFO } from "@/lib/billing/usage"
import { PLAN_DETAILS, type PlanType } from "@/lib/types/subscription"

/** Numbers come only from plan_limits, including on the public pricing page. */
export function PlanFeatures({ plan }: { plan: PlanType }) {
  const [limits, setLimits] = useState<Record<string, number> | null>(null)
  useEffect(() => {
    const controller = new AbortController()
    const load = () => fetch("/api/plans/limits", { cache: "no-store", signal: controller.signal })
      .then((r) => { if (!r.ok) throw new Error(); return r.json() })
      .then((d) => setLimits(Object.fromEntries(d.limits.filter((r: any) => r.plan_type === plan)
        .map((r: any) => [r.feature, r.monthly_limit]))))
      .catch(() => {})
    load()
    window.addEventListener("focus", load)
    return () => { controller.abort(); window.removeEventListener("focus", load) }
  }, [plan])
  const features = [...PLAN_DETAILS[plan].features]
  if (limits) {
    for (const [feature, info] of Object.entries(FEATURE_INFO)) {
      const cap = limits[feature]
      if (!info || cap === undefined || cap === 0 || (feature === "ai_total" && cap < 0)) continue
      features.push(`${info.label}: ${cap < 0 ? "no monthly limit" : `${cap.toLocaleString()} ${info.unit} per month`}`)
    }
  }
  return <ul className="space-y-3">
    {features.map((text) => <li key={text} className="flex items-start gap-2">
      <Check className="mt-0.5 h-5 w-5 shrink-0 text-primary" /><span className="text-sm">{text}</span>
    </li>)}
    {!limits && <li className="text-sm text-muted-foreground">AI allowances are shown in Settings → Plan &amp; usage.</li>}
  </ul>
}

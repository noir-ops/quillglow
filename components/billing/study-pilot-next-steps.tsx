"use client"
import { useEffect, useState } from "react"
import Link from "next/link"
import { usePricing } from "@/lib/billing/use-pricing"
import { ConversionOffer } from "@/components/billing/conversion-offer"
export function StudyPilotNextSteps({ sessionId }: { sessionId?: string }) {
  const { pricing } = usePricing(), [result, setResult] = useState<any>(null), [error, setError] = useState(""), [retry, setRetry] = useState(0)
  useEffect(() => {
    if (!pricing?.phase3Enabled || !sessionId) return
    const controller = new AbortController(); setResult(null); setError("")
    fetch(`/api/study-agent/next-steps?sessionId=${encodeURIComponent(sessionId)}`, { cache: "no-store", signal: controller.signal }).then(async (r) => {
      const d = await r.json(); if (r.status === 403) { setResult({ locked: true }); return } if (!r.ok) throw new Error(); setResult(d)
    }).catch((e) => { if (e.name !== "AbortError") setError("Could not load next steps.") })
    return () => controller.abort()
  }, [pricing?.phase3Enabled, sessionId, retry])
  if (!pricing?.phase3Enabled || !sessionId) return null
  return <section className="rounded-xl border bg-primary/5 p-4 space-y-3"><h3 className="font-semibold">Your next steps</h3>
    {error ? <p className="text-sm">{error} <button className="underline" onClick={() => setRetry((n) => n + 1)}>Retry</button></p> : result?.locked ? <><p className="text-sm">Your generated study system is saved. Genius adds personalized links for what to do next.</p><ConversionOffer feature="study_agent" /></> : result?.steps?.map((step: any) => <Link key={step.href} className="block rounded-lg border bg-background p-3" href={step.href}><strong className="text-sm">{step.title}</strong><p className="text-xs text-muted-foreground">{step.description}</p></Link>)}</section>
}

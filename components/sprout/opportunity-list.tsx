"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import { OpportunityCard } from "@/components/sprout/opportunity-card"
import type { OpportunityCardData } from "@/lib/opportunities/presentation"

export function OpportunityList({ type }: { type?: string } = {}) {
  const [matches, setMatches] = useState<OpportunityCardData[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [starting, setStarting] = useState<string | null>(null)
  const router = useRouter()

  const startApplication = async (opportunityId: string) => {
    setStarting(opportunityId)
    try {
      const res = await fetch("/api/opportunities/applications/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ opportunityId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Could not start application")
      router.push(`/applications/${data.applicationId}`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not start application")
      setStarting(null)
    }
  }

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError(null)
    fetch(`/api/opportunities/match${type ? `?type=${encodeURIComponent(type)}` : ""}`, { signal: controller.signal, cache: "no-store" })
      .then(async (r) => {
        const body = await r.json()
        // A non-2xx response used to be swallowed identically to a genuine
        // zero-match result — "eligible for nothing yet" and "the matching
        // engine broke" rendered as the exact same message. Now they don't.
        if (!r.ok) throw new Error(body.error ?? "Failed to load opportunities")
        if (!controller.signal.aborted) setMatches(body.matches ?? [])
      })
      .catch((err) => { if (!controller.signal.aborted) setError(err instanceof Error ? err.message : "Failed to load opportunities") })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [type])

  const save = async (id: string) => {
    setSaving(id)
    try {
      const res = await fetch("/api/opportunities/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ opportunityId: id, status: "saved" }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Could not save opportunity")
      setMatches(items => items.map(item => item.opportunity_id === id ? { ...item, application: data.application } : item))
      toast.success("Saved for later")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save opportunity")
    } finally {
      setSaving(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Finding opportunities…
      </div>
    )
  }

  if (error) {
    return (
      <Card className="border-destructive/40 bg-destructive/5">
        <CardContent className="p-6 text-sm">
          <p className="font-medium text-destructive">Couldn't load opportunities</p>
          <p className="mt-1 text-muted-foreground">{error}</p>
        </CardContent>
      </Card>
    )
  }

  if (matches.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-muted-foreground">
          No matches yet. Completing your profile is the fastest way to surface opportunities — it&apos;s
          the largest single factor in matching.
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="grid items-stretch gap-6 lg:grid-cols-2">
      {matches.map((m) => (
        <OpportunityCard key={m.opportunity_id} opportunity={m}
          saving={saving === m.opportunity_id} starting={starting === m.opportunity_id}
          onSave={() => save(m.opportunity_id)} onApply={() => startApplication(m.opportunity_id)} />
      ))}
    </div>
  )
}

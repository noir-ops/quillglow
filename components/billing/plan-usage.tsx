"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Gauge, Loader2, Sparkles } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface Row {
  feature: string
  label: string
  unit: string
  group: string
  used: number
  limit: number
  remaining: number
}

/**
 * Plan & usage: every AI feature's allowance this month, straight from the
 * limits the server enforces. Resets on the 1st (UTC).
 */
export function PlanUsage() {
  const [plan, setPlan] = useState<"scholar" | "genius" | null>(null)
  const [rows, setRows] = useState<Row[]>([])
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    fetch("/api/usage/quota", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => {
        setPlan(d.plan)
        setRows(d.usage ?? [])
      })
      .catch(() => setFailed(true))
  }, [])

  const groups = ["Learn", "Prepare", "AI Hub"]
  const now = new Date()
  const reset = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)).toLocaleDateString(undefined, {
    day: "numeric",
    month: "long",
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Gauge className="h-5 w-5" />
          Plan &amp; usage
        </CardTitle>
        <CardDescription>
          {plan === "genius"
            ? `Genius plan — generous fair-use limits. Resets ${reset}.`
            : `Scholar (free) plan — your monthly AI allowance. Resets ${reset}.`}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {failed ? (
          <p className="text-sm text-muted-foreground">Couldn&apos;t load your usage right now.</p>
        ) : plan === null ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading your usage…
          </p>
        ) : (
          groups.map((g) => {
            const items = rows.filter((r) => r.group === g)
            if (items.length === 0) return null
            return (
              <div key={g} className="space-y-2.5">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{g}</p>
                {items.map((r) => {
                  const unlimited = r.limit < 0
                  const none = r.limit === 0
                  const pct = unlimited || none ? 0 : Math.min(100, Math.round((r.used / r.limit) * 100))
                  return (
                    <div key={r.feature}>
                      <div className="flex items-baseline justify-between gap-3 text-sm">
                        <span>{r.label}</span>
                        <span className={cn("shrink-0 tabular-nums", !unlimited && !none && r.remaining === 0 ? "font-semibold text-destructive" : "text-muted-foreground")}>
                          {unlimited ? "No limit" : none ? "Genius only" : `${r.used} of ${r.limit} ${r.unit}`}
                        </span>
                      </div>
                      {!unlimited && !none && (
                        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                          <div
                            className={cn("h-full rounded-full", pct >= 100 ? "bg-destructive" : pct >= 80 ? "bg-amber-500" : "bg-primary")}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )
          })
        )}
        {plan === "scholar" && (
          <Button asChild className="w-full gap-2">
            <Link href="/upgrade">
              <Sparkles className="h-4 w-4" /> Upgrade to Genius for higher limits
            </Link>
          </Button>
        )}
      </CardContent>
    </Card>
  )
}

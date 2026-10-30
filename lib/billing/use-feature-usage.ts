"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import type { FeatureUsage } from "@/lib/billing/usage"

/** Reject stale responses when switching tools; refresh when returning to a tab. */
export function useFeatureUsage(endpoint: string) {
  const [snapshot, setSnapshot] = useState<{ endpoint: string; usage: FeatureUsage } | null>(null)
  const [usageError, setUsageError] = useState<string | null>(null)
  const sequence = useRef(0)
  const refreshUsage = useCallback(async () => {
    const requestId = ++sequence.current
    try {
      const res = await fetch(endpoint, { cache: "no-store" })
      const data = await res.json()
      if (!res.ok || data.error) throw new Error("Could not load your allowance. Please try again.")
      if (requestId !== sequence.current) return
      setSnapshot({ endpoint, usage: data })
      setUsageError(null)
    } catch {
      if (requestId !== sequence.current) return
      setUsageError("Could not load your allowance. Please try again.")
    }
  }, [endpoint])
  useEffect(() => {
    refreshUsage()
    window.addEventListener("focus", refreshUsage)
    return () => { sequence.current++; window.removeEventListener("focus", refreshUsage) }
  }, [refreshUsage])
  return { usage: snapshot?.endpoint === endpoint ? snapshot.usage : null, refreshUsage, usageError }
}

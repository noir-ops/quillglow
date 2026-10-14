"use client"

import { useEffect } from "react"
import { toast } from "sonner"

/** Features with their own on-page limit screen — no second prompt for these. */
const HANDLED_IN_PAGE = new Set([
  "study_agent",
  "echomind",
  "weekly_review",
  "writereal_detect",
  "writereal_grammar",
  "writereal_humanize",
  "writereal_paraphrase",
])

/**
 * App-wide upgrade prompt. Any API response that is a monthly-limit refusal
 * (status 429 with `upgradeUrl`, from lib/services/quota deniedBody) becomes a
 * clear toast naming the feature and its limit, with a "See plans" button —
 * instead of each tool showing its own generic "something went wrong".
 *
 * Reads a CLONE of the response, so the calling code still gets the original
 * untouched. Mounted once in app/layout.tsx.
 */
export function QuotaListener() {
  useEffect(() => {
    const original = window.fetch
    let lastShown = 0
    const patched: typeof window.fetch = async (...args) => {
      const res = await original(...args)
      if (res.status === 429) {
        res
          .clone()
          .json()
          .then((body) => {
            if (!body?.upgradeUrl || HANDLED_IN_PAGE.has(body.feature)) return
            if (Date.now() - lastShown < 1500) return // one prompt per burst
            lastShown = Date.now()
            toast.error(body.message ?? "You've reached this month's limit for this feature.", {
              duration: 10000,
              action: body.plan === "genius" ? undefined : { label: "See plans", onClick: () => window.location.assign(body.upgradeUrl) },
            })
          })
          .catch(() => {})
      }
      return res
    }
    window.fetch = patched
    return () => {
      if (window.fetch === patched) window.fetch = original
    }
  }, [])
  return null
}

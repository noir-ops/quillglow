"use client"

import { Suspense, useState } from "react"
import { useSearchParams } from "next/navigation"
import { FocusTimer } from "@/components/focus/focus-timer"
import { StressReliefPanel } from "@/components/focus/stress-relief-panel"
import { Timer, Heart } from "lucide-react"

/**
 * Focus — the Pomodoro timer and Stress Relief combined into one destination.
 *
 * Both panels render their own full-viewport background (min-h-screen +
 * absolute inset-0 art) — they were built as standalone pages, not as content
 * meant to sit inside a padded container. The tab switcher is therefore
 * rendered as a floating overlay ON TOP of whichever panel is active, rather
 * than in a normal document-flow header above it. A regular flex/max-width
 * wrapper here would push the background down and box it in — which is
 * exactly what happened in the first version of this merge.
 *
 * `/stress-relief` redirects here with ?tab=calm so existing links still work.
 */
function FocusTabs() {
  const searchParams = useSearchParams()
  const [tab, setTab] = useState(searchParams.get("tab") === "calm" ? "calm" : "timer")

  return (
    <div className="relative min-h-screen">
      {/* Floating glass switcher, overlaid on the active panel's background.
          Positioned top-right, clear of each panel's own header row (date/
          clock on the timer, "Back to App" on calm) which both live top-left
          to top-center. */}
      <div className="fixed right-4 top-4 z-50 sm:right-6">
        <div className="flex gap-1 rounded-full border border-white/30 bg-white/20 p-1 shadow-lg backdrop-blur-xl">
          <button
            onClick={() => setTab("timer")}
            className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-all duration-200 ${
              tab === "timer"
                ? "bg-white/90 text-foreground shadow-md"
                : "text-white/90 hover:bg-white/10"
            }`}
          >
            <Timer className="h-4 w-4" />
            Timer
          </button>
          <button
            onClick={() => setTab("calm")}
            className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-all duration-200 ${
              tab === "calm"
                ? "bg-white/90 text-foreground shadow-md"
                : "text-white/90 hover:bg-white/10"
            }`}
          >
            <Heart className="h-4 w-4" />
            Calm
          </button>
        </div>
      </div>

      {/* Both panels stay mounted: unmounting the timer tab would reset a
          running Pomodoro session the moment a student checks the Calm tab. */}
      <div className={tab === "timer" ? "block" : "hidden"}>
        <FocusTimer />
      </div>
      <div className={tab === "calm" ? "block" : "hidden"}>
        <StressReliefPanel />
      </div>
    </div>
  )
}

/**
 * useSearchParams() requires a Suspense boundary in the App Router, or the
 * whole route opts out of static rendering and Next warns at build time.
 */
export default function FocusPage() {
  return (
    <Suspense fallback={null}>
      <FocusTabs />
    </Suspense>
  )
}

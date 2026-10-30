"use client"

import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import { Flame, TrendingUp } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { useStudyStore } from "@/lib/store/study-store"
import { createBrowserClient } from "@/lib/supabase/client"
import { ChristmasLights } from "@/components/christmas-lights"
import { DASHBOARD_FLAGS } from "@/lib/config/dashboard-flags"
import { STUDY_ACTIVITY_EVENT, learnerTimeZone } from "@/lib/events/study-activity"

interface TodaysFocusProps {
  userId: string
}

export function TodaysFocus({ userId }: TodaysFocusProps) {
  const { dailyQuote } = useStudyStore()
  const [completedToday, setCompletedToday] = useState(0)
  // The real streak, from study activity in the database (scripts/068) — the
  // same number the profile page and leaderboard show. It used to live in
  // this browser's storage and go up just for opening this page.
  const [streak, setStreak] = useState<{ current: number; longest: number; studied_today: boolean } | null>(null)
  const supabase = createBrowserClient()

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      const today = new Date()
      today.setHours(0, 0, 0, 0) // the learner's own midnight
      const [{ count }, { data }] = await Promise.all([
        supabase
          .from("tasks")
          .select("*", { count: "exact", head: true })
          .eq("user_id", userId)
          .eq("completed", true)
          .gte("completed_at", today.toISOString()),
        supabase.rpc("my_study_streak", { p_tz: learnerTimeZone() }),
      ])
      if (cancelled) return
      setCompletedToday(count || 0)
      if (data) setStreak(data as any)
    }
    load()
    window.addEventListener(STUDY_ACTIVITY_EVENT, load)
    return () => {
      cancelled = true
      window.removeEventListener(STUDY_ACTIVITY_EVENT, load)
    }
  }, [userId, supabase])

  return (
    <div className="space-y-6">
      {/* Hero Section with Streak */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
        <Card className="relative bg-gradient-to-br from-primary/10 via-purple-500/10 to-pink-500/10 border-primary/20 overflow-hidden">
          {/* Seasonal — switched off in lib/config/dashboard-flags.ts */}
          {DASHBOARD_FLAGS.seasonalLights && <ChristmasLights />}

          {/* The extra top padding only exists to make room for the lights. */}
          <CardContent className={DASHBOARD_FLAGS.seasonalLights ? "pt-14 pb-6" : "pt-6 pb-6"}>
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <h1 className="text-3xl font-bold text-foreground mb-2">Welcome back! 👋</h1>
                <p className="text-muted-foreground">{dailyQuote}</p>
              </div>
              <div className="flex gap-4">
                <motion.div
                  whileHover={{ scale: 1.05 }}
                  className="flex items-center gap-2 bg-orange-500/20 px-4 py-3 rounded-lg border border-orange-500/30"
                >
                  <Flame className="h-6 w-6 text-orange-500" />
                  <div>
                    <p className="text-2xl font-bold text-orange-500">{streak?.current ?? "–"}</p>
                    <p className="text-xs text-muted-foreground">Day Streak</p>
                    {streak && streak.current > 0 && !streak.studied_today && (
                      <p className="text-[11px] font-medium text-orange-600 dark:text-orange-400">Study today to keep it</p>
                    )}
                    {streak && streak.longest > streak.current && (
                      <p className="text-[11px] text-muted-foreground">Best: {streak.longest}</p>
                    )}
                  </div>
                </motion.div>
                <motion.div
                  whileHover={{ scale: 1.05 }}
                  className="flex items-center gap-2 bg-green-500/20 px-4 py-3 rounded-lg border border-green-500/30"
                >
                  <TrendingUp className="h-6 w-6 text-green-500" />
                  <div>
                    <p className="text-2xl font-bold text-green-500">{completedToday}</p>
                    <p className="text-xs text-muted-foreground">Done Today</p>
                  </div>
                </motion.div>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}

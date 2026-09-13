"use client"

import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import { Flame, TrendingUp } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { useStudyStore } from "@/lib/store/study-store"
import { createBrowserClient } from "@/lib/supabase/client"
import { ChristmasLights } from "@/components/christmas-lights"

interface TodaysFocusProps {
  userId: string
}

export function TodaysFocus({ userId }: TodaysFocusProps) {
  const { streakDays, dailyQuote, updateStreak } = useStudyStore()
  const [completedToday, setCompletedToday] = useState(0)
  const supabase = createBrowserClient()

  useEffect(() => {
    updateStreak()

    // Fetch completed tasks today
    const fetchCompletedToday = async () => {
      const today = new Date()
      today.setHours(0, 0, 0, 0)

      const { count } = await supabase
        .from("tasks")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("completed", true)
        .gte("completed_at", today.toISOString())

      setCompletedToday(count || 0)
    }

    fetchCompletedToday()
  }, [userId, updateStreak, supabase])

  return (
    <div className="space-y-6">
      {/* Hero Section with Streak */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
        <Card className="relative bg-gradient-to-br from-primary/10 via-purple-500/10 to-pink-500/10 border-primary/20 overflow-hidden">
          <ChristmasLights />

          <CardContent className="pt-14 pb-6">
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
                    <p className="text-2xl font-bold text-orange-500">{streakDays}</p>
                    <p className="text-xs text-muted-foreground">Day Streak</p>
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

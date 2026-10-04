"use client"

import { motion } from "framer-motion"
import { Card, CardContent } from "@/components/ui/card"
import { Trophy, Zap, Target, Flame } from "lucide-react"

interface StatsOverviewProps {
  profile: {
    xp: number
    level: number
    streak_days: number
  } | null
}

export function StatsOverview({ profile }: StatsOverviewProps) {
  const stats = [
    {
      icon: Zap,
      label: "Total XP",
      value: profile?.xp || 0,
      color: "from-yellow-400 to-orange-500",
    },
    {
      icon: Trophy,
      label: "Level",
      value: profile?.level || 1,
      color: "from-purple-500 to-pink-500",
    },
    {
      icon: Target,
      label: "Next Level",
      value: `${(profile?.xp || 0) % 100}%`,
      color: "from-blue-500 to-cyan-500",
    },
    {
      icon: Flame,
      label: "Streak",
      value: `${profile?.streak_days || 0} days`,
      color: "from-red-500 to-orange-500",
    },
  ]

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {stats.map((stat, index) => (
        <motion.div
          key={stat.label}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.1 }}
        >
          <Card className="border-2 bg-white/80 backdrop-blur">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div
                  className={`flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${stat.color}`}
                >
                  <stat.icon className="h-6 w-6 text-white" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                  <p className="text-2xl font-bold">{stat.value}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      ))}
    </div>
  )
}

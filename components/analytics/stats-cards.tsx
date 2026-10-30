"use client"

import { motion } from "framer-motion"
import { Clock, CheckCircle2, TrendingUp, AlertTriangle } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import type { PomodoroSession, Task, MoodLog } from "@/lib/types/study"

interface StatsCardsProps {
  sessions: PomodoroSession[]
  tasks: Task[]
  moodLogs: MoodLog[]
}

export function StatsCards({ sessions, tasks, moodLogs }: StatsCardsProps) {
  const totalHours = sessions.reduce((acc, s) => acc + s.duration_minutes, 0) / 60
  const completedTasks = tasks.filter((t) => t.completed).length
  const completionRate = tasks.length > 0 ? Math.round((completedTasks / tasks.length) * 100) : 0

  const avgMood = moodLogs.length > 0 ? moodLogs.reduce((acc, m) => acc + m.mood_score, 0) / moodLogs.length : 0

  const burnoutRisk =
    avgMood < 4 || (sessions.length > 0 && totalHours / 4 > 8) ? "high" : avgMood < 6 ? "medium" : "low"

  const estimatedGPA = completionRate >= 90 ? 4.0 : completionRate >= 80 ? 3.5 : completionRate >= 70 ? 3.0 : 2.5

  const stats = [
    {
      label: "Study Hours",
      value: totalHours.toFixed(1),
      icon: Clock,
      color: "text-blue-500",
      bgColor: "bg-blue-500/10",
    },
    {
      label: "Completion Rate",
      value: `${completionRate}%`,
      icon: CheckCircle2,
      color: "text-green-500",
      bgColor: "bg-green-500/10",
    },
    {
      label: "Est. GPA",
      value: estimatedGPA.toFixed(1),
      icon: TrendingUp,
      color: "text-purple-500",
      bgColor: "bg-purple-500/10",
    },
    {
      label: "Burnout Risk",
      value: burnoutRisk.charAt(0).toUpperCase() + burnoutRisk.slice(1),
      icon: AlertTriangle,
      color: burnoutRisk === "high" ? "text-red-500" : burnoutRisk === "medium" ? "text-yellow-500" : "text-green-500",
      bgColor:
        burnoutRisk === "high" ? "bg-red-500/10" : burnoutRisk === "medium" ? "bg-yellow-500/10" : "bg-green-500/10",
    },
  ]

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {stats.map((stat, index) => (
        <motion.div
          key={stat.label}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.1 }}
        >
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                  <p className="text-3xl font-bold mt-2">{stat.value}</p>
                </div>
                <div className={`p-3 rounded-lg ${stat.bgColor}`}>
                  <stat.icon className={`h-6 w-6 ${stat.color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      ))}
    </div>
  )
}

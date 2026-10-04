"use client"

import { motion } from "framer-motion"
import { Lightbulb, TrendingUp, AlertCircle } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { PomodoroSession, Task, MoodLog } from "@/lib/types/study"

interface InsightsPanelProps {
  sessions: PomodoroSession[]
  tasks: Task[]
  moodLogs: MoodLog[]
  flashcards: any[]
}

export function InsightsPanel({ sessions, tasks, moodLogs, flashcards }: InsightsPanelProps) {
  const insights: { type: "success" | "warning" | "info"; message: string }[] = []

  // Study hours insight
  const totalHours = sessions.reduce((acc, s) => acc + s.duration_minutes, 0) / 60
  const weeklyHours = totalHours / 4

  if (weeklyHours < 5) {
    insights.push({
      type: "warning",
      message: "Your study time is below 5 hours per week. Try setting a daily 10-minute streak to build consistency.",
    })
  } else if (weeklyHours > 8) {
    insights.push({
      type: "success",
      message: "Excellent study habits! You're averaging over 8 hours per week.",
    })
  }

  // Task completion insight
  const completedTasks = tasks.filter((t) => t.completed).length
  const completionRate = tasks.length > 0 ? (completedTasks / tasks.length) * 100 : 0

  if (completionRate >= 80) {
    insights.push({
      type: "success",
      message: "You're crushing it with an 80%+ task completion rate!",
    })
  } else if (completionRate < 50) {
    insights.push({
      type: "warning",
      message: "Your task completion rate is below 50%. Try breaking tasks into smaller, manageable chunks.",
    })
  }

  // Mood insight
  const avgMood = moodLogs.length > 0 ? moodLogs.reduce((acc, m) => acc + m.mood_score, 0) / moodLogs.length : 0

  if (avgMood < 4) {
    insights.push({
      type: "warning",
      message: "Your mood scores are low. Consider taking more breaks and practicing self-care.",
    })
  } else if (avgMood >= 7) {
    insights.push({
      type: "success",
      message: "Your mood is great! Keep up the positive mindset.",
    })
  }

  // Subject focus insight
  const subjectTasks: Record<string, number> = {}
  tasks.forEach((task) => {
    const subject = task.subject || "Other"
    subjectTasks[subject] = (subjectTasks[subject] || 0) + 1
  })

  const topSubject = Object.entries(subjectTasks).sort((a, b) => b[1] - a[1])[0]
  if (topSubject) {
    insights.push({
      type: "info",
      message: `You're focusing most on ${topSubject[0]}. Consider balancing your study time across subjects.`,
    })
  }

  // Flashcard insight
  const reviewedCards = flashcards.filter((c) => c.times_reviewed > 0).length
  if (reviewedCards > 20) {
    insights.push({
      type: "success",
      message: `You've reviewed ${reviewedCards} flashcards! Spaced repetition is working.`,
    })
  }

  // Default insight if none
  if (insights.length === 0) {
    insights.push({
      type: "info",
      message: "Keep logging your study sessions to get personalized insights!",
    })
  }

  const getIcon = (type: string) => {
    switch (type) {
      case "success":
        return <TrendingUp className="h-5 w-5 text-green-500" />
      case "warning":
        return <AlertCircle className="h-5 w-5 text-yellow-500" />
      default:
        return <Lightbulb className="h-5 w-5 text-blue-500" />
    }
  }

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5" />
            Insights & Recommendations
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {insights.map((insight, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                className="flex items-start gap-3 p-3 rounded-lg bg-card border border-border"
              >
                {getIcon(insight.type)}
                <p className="text-sm flex-1">{insight.message}</p>
              </motion.div>
            ))}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}

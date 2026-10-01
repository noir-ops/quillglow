"use client"

import { motion } from "framer-motion"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Trophy, Lock } from "lucide-react"
import { formatDistanceToNow } from "date-fns"

interface Achievement {
  id: string
  name: string
  description: string
  icon: string
  requirement_type: string
  requirement_value: number
  unlocked: boolean
  unlocked_at?: string
}

interface AchievementsGridProps {
  achievements: Achievement[]
}

export function AchievementsGrid({ achievements }: AchievementsGridProps) {
  const unlockedCount = achievements.filter((a) => a.unlocked).length

  return (
    <Card className="border-2 bg-white/80 backdrop-blur">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-6 w-6 text-primary" />
              Achievements
            </CardTitle>
            <CardDescription>
              {unlockedCount} of {achievements.length} unlocked
            </CardDescription>
          </div>
          <Badge variant="secondary" className="text-lg">
            {Math.round((unlockedCount / achievements.length) * 100)}%
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 sm:grid-cols-2">
          {achievements.map((achievement, index) => (
            <motion.div
              key={achievement.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className={`rounded-lg border-2 p-4 transition-all ${
                achievement.unlocked
                  ? "border-primary bg-gradient-to-br from-primary/5 to-primary/10"
                  : "border-border bg-white opacity-60"
              }`}
            >
              <div className="flex items-start gap-4">
                <div
                  className={`flex h-12 w-12 items-center justify-center rounded-full text-2xl ${
                    achievement.unlocked ? "bg-primary/20" : "bg-gray-200"
                  }`}
                >
                  {achievement.unlocked ? achievement.icon : <Lock className="h-6 w-6 text-gray-400" />}
                </div>
                <div className="flex-1">
                  <h4 className="font-semibold">{achievement.name}</h4>
                  <p className="text-sm text-muted-foreground">{achievement.description}</p>
                  {achievement.unlocked && achievement.unlocked_at && (
                    <p className="mt-2 text-xs text-primary">
                      Unlocked {formatDistanceToNow(new Date(achievement.unlocked_at), { addSuffix: true })}
                    </p>
                  )}
                  {!achievement.unlocked && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Requirement: {achievement.requirement_type.replace("_", " ")} {achievement.requirement_value}
                    </p>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {achievements.length === 0 && (
          <div className="py-12 text-center text-muted-foreground">
            No achievements available yet. Complete quests to unlock achievements!
          </div>
        )}
      </CardContent>
    </Card>
  )
}

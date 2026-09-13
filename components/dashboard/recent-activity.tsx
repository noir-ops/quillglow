"use client"

import { motion } from "framer-motion"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Clock, CheckCircle2, XCircle } from "lucide-react"
import { formatDistanceToNow } from "date-fns"

interface RecentActivityProps {
  userQuests: any[] | null
}

export function RecentActivity({ userQuests }: RecentActivityProps) {
  if (!userQuests || userQuests.length === 0) {
    return (
      <Card className="border-2 bg-white/80 backdrop-blur">
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
          <CardDescription>Your quest history will appear here</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="py-8 text-center text-muted-foreground">
            No activity yet. Start a quest to begin your journey!
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-2 bg-white/80 backdrop-blur">
      <CardHeader>
        <CardTitle>Recent Activity</CardTitle>
        <CardDescription>Your latest quest attempts</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {userQuests.map((userQuest, index) => (
            <motion.div
              key={userQuest.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
              className="flex items-center justify-between rounded-lg border p-4"
            >
              <div className="flex items-center gap-4">
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-full ${
                    userQuest.status === "completed"
                      ? "bg-green-100 text-green-600"
                      : userQuest.status === "failed"
                        ? "bg-red-100 text-red-600"
                        : "bg-blue-100 text-blue-600"
                  }`}
                >
                  {userQuest.status === "completed" ? (
                    <CheckCircle2 className="h-5 w-5" />
                  ) : userQuest.status === "failed" ? (
                    <XCircle className="h-5 w-5" />
                  ) : (
                    <Clock className="h-5 w-5" />
                  )}
                </div>
                <div>
                  <p className="font-semibold">{userQuest.quests?.title}</p>
                  <p className="text-sm text-muted-foreground">
                    {formatDistanceToNow(new Date(userQuest.started_at), { addSuffix: true })}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {userQuest.status === "completed" && <Badge variant="secondary">{userQuest.score}%</Badge>}
                <Badge
                  className={
                    userQuest.status === "completed"
                      ? "bg-green-500"
                      : userQuest.status === "failed"
                        ? "bg-red-500"
                        : "bg-blue-500"
                  }
                >
                  {userQuest.status}
                </Badge>
              </div>
            </motion.div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

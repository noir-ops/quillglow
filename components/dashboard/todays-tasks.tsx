"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { CheckCircle2, Circle, Clock, UserCheck } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { createBrowserClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { useStudyStore } from "@/lib/store/study-store"
import type { Task } from "@/lib/types/study"

interface TodaysTasksProps {
  tasks: Task[]
}

export function TodaysTasks({ tasks: initialTasks }: TodaysTasksProps) {
  const [tasks, setTasks] = useState(initialTasks)
  const router = useRouter()
  const supabase = createBrowserClient()
  const { updateStreak } = useStudyStore()

  const handleToggleTask = async (taskId: string, completed: boolean) => {
    const { error } = await supabase
      .from("tasks")
      .update({
        completed: !completed,
        completed_at: !completed ? new Date().toISOString() : null,
      })
      .eq("id", taskId)

    if (error) {
      toast.error("Failed to update task")
    } else {
      if (!completed) {
        toast.success("Task completed! 🎉")
        updateStreak()
      }
      setTasks(tasks.map((t) => (t.id === taskId ? { ...t, completed: !completed } : t)))
      router.refresh()
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high":
        return "text-red-500 border-red-500/30 bg-red-500/10"
      case "medium":
        return "text-yellow-500 border-yellow-500/30 bg-yellow-500/10"
      case "low":
        return "text-green-500 border-green-500/30 bg-green-500/10"
      default:
        return "text-muted-foreground"
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.2 }}
    >
      <Card className="h-full hover:shadow-lg transition-shadow">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" />
            Today's Tasks
          </CardTitle>
        </CardHeader>
        <CardContent>
          {tasks.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No tasks due today</p>
              <p className="text-sm text-muted-foreground mt-2">You're all caught up! 🎉</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-[300px] overflow-y-auto">
              {tasks.map((task, index) => (
                <motion.div
                  key={task.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className={`flex items-start gap-3 p-3 rounded-lg border ${getPriorityColor(task.priority)}`}
                >
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 mt-0.5"
                    onClick={() => handleToggleTask(task.id, task.completed)}
                  >
                    {task.completed ? (
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                    ) : (
                      <Circle className="h-5 w-5" />
                    )}
                  </Button>
                  <div className="flex-1 min-w-0">
                    <p className={`font-medium ${task.completed ? "line-through text-muted-foreground" : ""}`}>
                      {task.title}
                      {(task as any).source_mentor_note_id && (
                        <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-violet-500/15 px-2 py-0.5 text-[10px] font-medium text-violet-700 dark:text-violet-300">
                          <UserCheck className="h-3 w-3" />
                          {(task as any).source_link_type === "family" ? "From family" : "From mentor"}
                        </span>
                      )}
                    </p>
                    {task.subject && <p className="text-xs text-muted-foreground mt-1">{task.subject}</p>}
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  )
}

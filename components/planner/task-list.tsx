"use client"

import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { Filter, Trash2, Play, Loader2, UserCheck, ClipboardCheck, Pencil, Check, X } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { createBrowserClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { format } from "date-fns"
import { useStudyStore } from "@/lib/store/study-store"
import type { Task } from "@/lib/types/study"

interface TaskListProps {
  tasks: Task[]
}

export function TaskList({ tasks: initialTasks }: TaskListProps) {
  const [tasks, setTasks] = useState(initialTasks)
  const [filter, setFilter] = useState<"all" | "week" | "month">("week")
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDate, setEditDate] = useState("")
  const [editHours, setEditHours] = useState("")
  const router = useRouter()
  const supabase = createBrowserClient()
  const { startPomodoro, optimisticTasks } = useStudyStore()

  useEffect(() => {
    setTasks(initialTasks)
  }, [initialTasks])

  const allTasks = [...optimisticTasks.filter((ot) => !tasks.some((t) => t.id === ot.id)), ...tasks]

  const filteredTasks = allTasks.filter((task) => {
    if (!task.due_date) return filter === "all"
    const dueDate = new Date(task.due_date)
    const now = new Date()

    if (filter === "week") {
      const weekFromNow = new Date()
      weekFromNow.setDate(weekFromNow.getDate() + 7)
      return dueDate <= weekFromNow
    } else if (filter === "month") {
      const monthFromNow = new Date()
      monthFromNow.setMonth(monthFromNow.getMonth() + 1)
      return dueDate <= monthFromNow
    }
    return true
  })

  const handleToggleComplete = async (task: Task) => {
    const nextCompleted = !task.completed
    setUpdatingId(task.id)
    // Optimistic — flip it locally first, revert on failure.
    setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, completed: nextCompleted } : t)))
    try {
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completed: nextCompleted }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to update")

      if (nextCompleted && task.is_review) {
        toast.success("Week reviewed! Generating feedback on what to focus on next...")
        router.refresh()
      } else {
        toast.success(nextCompleted ? "Marked complete" : "Marked incomplete")
      }
    } catch {
      setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, completed: !nextCompleted } : t)))
      toast.error("Could not update task")
    } finally {
      setUpdatingId(null)
    }
  }

  const startEdit = (task: Task) => {
    setEditingId(task.id)
    setEditDate(task.due_date ? task.due_date.slice(0, 10) : "")
    setEditHours(task.estimated_hours != null ? String(task.estimated_hours) : "")
  }

  const saveEdit = async (taskId: string) => {
    const hours = editHours.trim() ? Number.parseInt(editHours, 10) : null
    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          due_date: editDate || null,
          estimated_hours: Number.isFinite(hours) ? hours : null,
        }),
      })
      if (!res.ok) throw new Error()
      setEditingId(null)
      toast.success("Task updated")
      router.refresh()
    } catch {
      toast.error("Could not save changes")
    }
  }

  const handleDelete = async (taskId: string) => {
    const taskToDelete = tasks.find((t) => t.id === taskId)
    setTasks(tasks.filter((t) => t.id !== taskId))
    toast.success("Task deleted")

    const { error } = await supabase.from("tasks").delete().eq("id", taskId)

    if (error) {
      if (taskToDelete) {
        setTasks((prev) => [...prev, taskToDelete])
      }
      toast.error("Failed to delete task")
    } else {
      router.refresh()
    }
  }

  const handleStartPomodoro = (taskId: string, taskTitle: string) => {
    startPomodoro(taskId)
    toast.success(`Started Pomodoro for: ${taskTitle}`)
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high":
        return "border-l-red-500"
      case "medium":
        return "border-l-yellow-500"
      case "low":
        return "border-l-green-500"
      default:
        return "border-l-gray-500"
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.1 }}
    >
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Task List
            </CardTitle>
            <Select value={filter} onValueChange={(v) => setFilter(v as any)}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="week">This Week</SelectItem>
                <SelectItem value="month">This Month</SelectItem>
                <SelectItem value="all">All Tasks</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {filteredTasks.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No tasks found for this period</div>
          ) : (
            <div className="space-y-3">
              {filteredTasks.map((task, index) => (
                <motion.div
                  key={task.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className={`p-4 rounded-lg border-l-4 bg-card hover:bg-primary/10 dark:hover:bg-primary/15 transition-colors ${getPriorityColor(task.priority)} ${
                    (task as any).isOptimistic ? "opacity-70" : ""
                  } ${task.completed ? "opacity-60" : ""} ${task.is_review ? "ring-1 ring-primary/40" : ""}`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <Checkbox
                        checked={task.completed}
                        onCheckedChange={() => handleToggleComplete(task)}
                        disabled={updatingId === task.id || (task as any).isOptimistic}
                        className="mt-1 shrink-0"
                        aria-label={task.completed ? "Mark incomplete" : "Mark complete"}
                      />
                      <div className="flex-1 min-w-0">
                        <h4 className={`font-medium text-foreground hover:text-foreground ${task.completed ? "line-through" : ""}`}>
                          {task.is_review && (
                            <span className="mr-1.5 inline-flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold text-primary align-middle">
                              <ClipboardCheck className="h-3 w-3" /> Weekly Review
                            </span>
                          )}
                          {task.title}
                          {task.source_mentor_note_id && (
                            <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-violet-500/15 px-2 py-0.5 text-[10px] font-medium text-violet-700 dark:text-violet-300">
                              <UserCheck className="h-3 w-3" />
                              {task.source_link_type === "family" ? "From family" : "From mentor"}
                            </span>
                          )}
                          {(task as any).isOptimistic && (
                            <span className="ml-2 inline-flex items-center gap-1 text-xs text-foreground/70">
                              <Loader2 className="h-3 w-3 animate-spin" />
                              saving...
                            </span>
                          )}
                        </h4>
                        {task.description && <p className="text-sm text-foreground/80 mt-1">{task.description}</p>}

                        {editingId === task.id ? (
                          <div className="flex flex-wrap items-center gap-2 mt-2">
                            <Input
                              type="date"
                              value={editDate}
                              onChange={(e) => setEditDate(e.target.value)}
                              className="h-8 w-auto text-xs"
                            />
                            <Input
                              type="number"
                              min={0}
                              value={editHours}
                              onChange={(e) => setEditHours(e.target.value)}
                              placeholder="Hours"
                              className="h-8 w-20 text-xs"
                            />
                            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => saveEdit(task.id)}>
                              <Check className="h-4 w-4 text-green-600" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setEditingId(null)}>
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-4 mt-2 text-xs text-foreground/70">
                            {task.due_date && <span>Due: {format(new Date(task.due_date), "MMM d, yyyy")}</span>}
                            {task.estimated_hours != null && <span>{task.estimated_hours}h</span>}
                            {task.subject && (
                              <span className="rounded-full bg-muted px-2 py-0.5 font-medium">{task.subject}</span>
                            )}
                            <span className="capitalize">{task.priority} priority</span>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {editingId !== task.id && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => startEdit(task)}
                          title="Edit date/hours"
                          disabled={(task as any).isOptimistic}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleStartPomodoro(task.id, task.title)}
                        title="Start Pomodoro"
                        disabled={(task as any).isOptimistic}
                      >
                        <Play className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(task.id)}
                        title="Delete task"
                        disabled={(task as any).isOptimistic}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
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

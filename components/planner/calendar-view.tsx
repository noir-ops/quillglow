"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { ChevronLeft, ChevronRight, Layers, Plus, ClipboardCheck } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  isToday,
  startOfWeek,
  endOfWeek,
} from "date-fns"
import type { Task } from "@/lib/types/study"

interface CalendarViewProps {
  tasks: Task[]
}

export function CalendarView({ tasks: initialTasks }: CalendarViewProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [tasks, setTasks] = useState(initialTasks)
  const [selectedDay, setSelectedDay] = useState<Date | null>(null)
  const [addingTask, setAddingTask] = useState(false)
  const [newTitle, setNewTitle] = useState("")
  const [newSubject, setNewSubject] = useState("")
  const [savingNew, setSavingNew] = useState(false)
  const router = useRouter()

  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(currentMonth)
  const calendarStart = startOfWeek(monthStart)
  const calendarEnd = endOfWeek(monthEnd)

  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd })

  const getTasksForDay = (day: Date) => {
    return tasks.filter((task) => {
      if (!task.due_date) return false
      return isSameDay(new Date(task.due_date), day)
    })
  }

  // How many DISTINCT subjects fall on this day — the thing this component
  // previously had no way to show. Multiple same-subject tasks on one day
  // don't count as "multiple subjects"; only a genuine mix does.
  const distinctSubjects = (dayTasks: Task[]) => {
    const set = new Set(dayTasks.map((t) => t.subject).filter(Boolean) as string[])
    return Array.from(set)
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high":
        return "bg-red-500"
      case "medium":
        return "bg-yellow-500"
      case "low":
        return "bg-green-500"
      default:
        return "bg-gray-500"
    }
  }

  const previousMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))
  }

  const nextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))
  }

  const toggleTaskComplete = async (task: Task) => {
    const nextCompleted = !task.completed
    setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, completed: nextCompleted } : t)))
    try {
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completed: nextCompleted }),
      })
      if (!res.ok) throw new Error()
      if (nextCompleted && task.is_review) {
        toast.success("Week reviewed! Check back shortly for feedback on next week.")
        router.refresh()
      }
    } catch {
      setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, completed: !nextCompleted } : t)))
      toast.error("Could not update task")
    }
  }

  const addTaskForSelectedDay = async () => {
    if (!selectedDay || !newTitle.trim()) return
    setSavingNew(true)
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newTitle.trim(),
          subject: newSubject.trim() || null,
          due_date: format(selectedDay, "yyyy-MM-dd"),
          priority: "medium",
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed")
      setTasks((prev) => [...prev, data.task])
      setNewTitle("")
      setNewSubject("")
      setAddingTask(false)
      toast.success("Task added")
    } catch {
      toast.error("Could not add task")
    } finally {
      setSavingNew(false)
    }
  }

  const selectedDayTasks = selectedDay ? getTasksForDay(selectedDay) : []
  const selectedDaySubjects = distinctSubjects(selectedDayTasks)

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>{format(currentMonth, "MMMM yyyy")}</CardTitle>
            <div className="flex gap-2">
              <Button variant="outline" size="icon" onClick={previousMonth}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" onClick={nextMonth}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-7 gap-2">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
              <div key={day} className="text-center text-sm font-medium text-muted-foreground p-2">
                {day}
              </div>
            ))}
            {days.map((day, index) => {
              const dayTasks = getTasksForDay(day)
              const subjects = distinctSubjects(dayTasks)
              const isCurrentMonth = isSameMonth(day, currentMonth)
              const isCurrentDay = isToday(day)
              const hasReview = dayTasks.some((t) => t.is_review)

              return (
                <motion.button
                  key={day.toISOString()}
                  type="button"
                  onClick={() => setSelectedDay(day)}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: index * 0.01 }}
                  className={`min-h-[80px] p-2 rounded-lg border text-left transition-colors ${
                    isCurrentDay
                      ? "bg-primary/10 border-primary"
                      : isCurrentMonth
                        ? "bg-card border-border hover:bg-accent"
                        : "bg-muted/50 border-transparent"
                  }`}
                >
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <span
                      className={`text-sm font-medium ${
                        isCurrentDay ? "text-primary" : isCurrentMonth ? "text-foreground" : "text-muted-foreground"
                      }`}
                    >
                      {format(day, "d")}
                    </span>
                    {/* The actual "multiple subjects today" indicator —
                        previously nothing distinguished this from a day with
                        several tasks in the SAME subject. */}
                    {subjects.length > 1 && (
                      <span
                        title={subjects.join(", ")}
                        className="flex items-center gap-0.5 rounded-full bg-primary/15 text-primary text-[10px] font-semibold px-1.5 py-0.5"
                      >
                        <Layers className="h-2.5 w-2.5" />
                        {subjects.length}
                      </span>
                    )}
                    {hasReview && <ClipboardCheck className="h-3 w-3 text-primary shrink-0" />}
                  </div>
                  <div className="space-y-1">
                    {dayTasks.slice(0, 2).map((task) => (
                      <div
                        key={task.id}
                        className={`text-xs px-1.5 py-0.5 rounded truncate ${getPriorityColor(task.priority)} text-white ${
                          task.completed ? "opacity-50 line-through" : ""
                        }`}
                        title={task.subject ? `${task.title} — ${task.subject}` : task.title}
                      >
                        {task.title}
                      </div>
                    ))}
                    {dayTasks.length > 2 && (
                      <div className="text-xs text-muted-foreground">+{dayTasks.length - 2} more</div>
                    )}
                  </div>
                </motion.button>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Day detail — clicking a day previously did nothing at all. */}
      <Dialog
        open={!!selectedDay}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedDay(null)
            setAddingTask(false)
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between gap-2">
              <span>{selectedDay && format(selectedDay, "EEEE, MMMM d")}</span>
              {selectedDaySubjects.length > 1 && (
                <span className="flex items-center gap-1 rounded-full bg-primary/15 text-primary text-xs font-semibold px-2 py-0.5">
                  <Layers className="h-3 w-3" />
                  {selectedDaySubjects.length} subjects
                </span>
              )}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-2 max-h-80 overflow-y-auto">
            {selectedDayTasks.length === 0 && !addingTask && (
              <p className="text-sm text-muted-foreground py-4 text-center">Nothing planned for this day yet.</p>
            )}
            {selectedDayTasks.map((task) => (
              <div
                key={task.id}
                className={`flex items-start gap-2 rounded-lg border p-2.5 ${task.is_review ? "ring-1 ring-primary/40" : ""}`}
              >
                <Checkbox
                  checked={task.completed}
                  onCheckedChange={() => toggleTaskComplete(task)}
                  className="mt-0.5 shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <p className={`text-sm font-medium ${task.completed ? "line-through text-muted-foreground" : ""}`}>
                    {task.is_review && <ClipboardCheck className="h-3 w-3 inline mr-1 text-primary" />}
                    {task.title}
                  </p>
                  <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-muted-foreground">
                    {task.subject && <span className="rounded-full bg-muted px-1.5 py-0.5">{task.subject}</span>}
                    {task.estimated_hours != null && <span>{task.estimated_hours}h</span>}
                    <span className="capitalize">{task.priority}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {addingTask ? (
            <div className="space-y-2 border-t pt-3">
              <Input placeholder="What do you want to study?" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} />
              <Input placeholder="Subject (optional)" value={newSubject} onChange={(e) => setNewSubject(e.target.value)} />
              <div className="flex gap-2">
                <Button onClick={addTaskForSelectedDay} disabled={savingNew || !newTitle.trim()} className="flex-1">
                  {savingNew ? "Adding..." : "Add"}
                </Button>
                <Button variant="outline" onClick={() => setAddingTask(false)}>Cancel</Button>
              </div>
            </div>
          ) : (
            <Button variant="outline" onClick={() => setAddingTask(true)} className="gap-2">
              <Plus className="h-4 w-4" /> Add task to this day
            </Button>
          )}
        </DialogContent>
      </Dialog>
    </motion.div>
  )
}

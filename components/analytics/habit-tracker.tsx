"use client"

import { useState, useEffect, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Plus,
  Trash2,
  Flame,
  CheckCircle2,
  Circle,
  Loader2,
  Sparkles,
} from "lucide-react"
import { toast } from "sonner"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

interface HabitCompletion {
  completed_date: string
}

interface Habit {
  id: string
  habit_name: string
  color: string
  icon: string
  habit_completions: HabitCompletion[]
}

const PRESET_COLORS = [
  "#6366f1", "#8b5cf6", "#ec4899", "#f43f5e",
  "#f97316", "#eab308", "#22c55e", "#14b8a6",
  "#3b82f6", "#06b6d4", "#84cc16", "#a855f7",
]

function getStreak(completions: HabitCompletion[]): number {
  if (!completions.length) return 0
  const today = new Date().toISOString().split("T")[0]
  const dates = completions.map((c) => c.completed_date).sort().reverse()
  let streak = 0
  let check = today

  for (const date of dates) {
    if (date === check) {
      streak++
      const d = new Date(check)
      d.setDate(d.getDate() - 1)
      check = d.toISOString().split("T")[0]
    } else if (date < check) {
      break
    }
  }
  return streak
}

function isCompletedToday(completions: HabitCompletion[]): boolean {
  const today = new Date().toISOString().split("T")[0]
  return completions.some((c) => c.completed_date === today)
}

export function HabitTracker() {
  const [habits, setHabits] = useState<Habit[]>([])
  const [loading, setLoading] = useState(true)
  const [toggling, setToggling] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [newName, setNewName] = useState("")
  const [newColor, setNewColor] = useState(PRESET_COLORS[0])
  const [addOpen, setAddOpen] = useState(false)
  const [adding, setAdding] = useState(false)

  const fetchHabits = useCallback(async () => {
    try {
      const res = await fetch("/api/habits")
      const data = await res.json()
      setHabits(Array.isArray(data) ? data : [])
    } catch {
      toast.error("Failed to load habits")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchHabits() }, [fetchHabits])

  const handleToggle = async (habitId: string) => {
    setToggling(habitId)
    try {
      const res = await fetch("/api/habits/toggle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ habit_id: habitId }),
      })
      const data = await res.json()

      setHabits((prev) =>
        prev.map((h) => {
          if (h.id !== habitId) return h
          const today = new Date().toISOString().split("T")[0]
          if (data.completed) {
            return { ...h, habit_completions: [...h.habit_completions, { completed_date: today }] }
          } else {
            return { ...h, habit_completions: h.habit_completions.filter((c) => c.completed_date !== today) }
          }
        })
      )
    } catch {
      toast.error("Failed to update habit")
    } finally {
      setToggling(null)
    }
  }

  const handleAdd = async () => {
    if (!newName.trim()) return
    setAdding(true)
    try {
      const res = await fetch("/api/habits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ habit_name: newName.trim(), color: newColor }),
      })
      const data = await res.json()
      setHabits((prev) => [...prev, { ...data, habit_completions: [] }])
      setNewName("")
      setNewColor(PRESET_COLORS[0])
      setAddOpen(false)
      toast.success("Habit created!")
    } catch {
      toast.error("Failed to create habit")
    } finally {
      setAdding(false)
    }
  }

  const handleDelete = async (habitId: string) => {
    setDeleting(habitId)
    try {
      await fetch("/api/habits", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: habitId }),
      })
      setHabits((prev) => prev.filter((h) => h.id !== habitId))
      toast.success("Habit removed")
    } catch {
      toast.error("Failed to remove habit")
    } finally {
      setDeleting(null)
    }
  }

  const completedToday = habits.filter((h) => isCompletedToday(h.habit_completions)).length
  const completionPct = habits.length > 0 ? Math.round((completedToday / habits.length) * 100) : 0

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-violet-500" />
              Daily Habits
            </CardTitle>
            {habits.length > 0 && (
              <p className="text-sm text-muted-foreground mt-0.5">
                {completedToday} of {habits.length} done today
              </p>
            )}
          </div>

          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1.5">
                <Plus className="h-4 w-4" />
                Add Habit
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-sm">
              <DialogHeader>
                <DialogTitle>Create a Daily Habit</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <Input
                  placeholder="e.g. Read for 20 mins"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                  autoFocus
                />
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2">Color</p>
                  <div className="flex flex-wrap gap-2">
                    {PRESET_COLORS.map((color) => (
                      <button
                        key={color}
                        onClick={() => setNewColor(color)}
                        className={`w-7 h-7 rounded-full transition-all ${newColor === color ? "ring-2 ring-offset-2 ring-foreground scale-110" : "hover:scale-105"}`}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </div>
                <Button onClick={handleAdd} disabled={!newName.trim() || adding} className="w-full">
                  {adding ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Create Habit
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Daily progress bar */}
        {habits.length > 0 && (
          <div className="mt-3">
            <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-violet-500 to-purple-500"
                initial={{ width: 0 }}
                animate={{ width: `${completionPct}%` }}
                transition={{ duration: 0.6, ease: "easeOut" }}
              />
            </div>
            <p className="text-xs text-muted-foreground mt-1 text-right">{completionPct}% complete</p>
          </div>
        )}
      </CardHeader>

      <CardContent>
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-14 rounded-xl bg-muted/50 animate-pulse" />
            ))}
          </div>
        ) : habits.length === 0 ? (
          <div className="py-10 text-center space-y-2">
            <div className="w-12 h-12 rounded-full bg-muted mx-auto flex items-center justify-center">
              <Sparkles className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="font-medium text-muted-foreground">No habits yet</p>
            <p className="text-sm text-muted-foreground/70">Create your first daily habit to start tracking.</p>
          </div>
        ) : (
          <AnimatePresence initial={false}>
            <div className="space-y-2">
              {habits.map((habit) => {
                const done = isCompletedToday(habit.habit_completions)
                const streak = getStreak(habit.habit_completions)
                const isToggling = toggling === habit.id
                const isDeleting = deleting === habit.id

                return (
                  <motion.div
                    key={habit.id}
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className={`group flex items-center gap-3 p-3 rounded-xl border transition-all ${
                      done
                        ? "bg-muted/40 border-border/50"
                        : "bg-card hover:bg-muted/30 border-border"
                    }`}
                  >
                    {/* Color indicator */}
                    <div
                      className="w-1.5 h-8 rounded-full flex-shrink-0"
                      style={{ backgroundColor: habit.color }}
                    />

                    {/* Check button */}
                    <button
                      onClick={() => handleToggle(habit.id)}
                      disabled={isToggling}
                      className="flex-shrink-0 transition-transform hover:scale-110 active:scale-95"
                    >
                      {isToggling ? (
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                      ) : done ? (
                        <CheckCircle2 className="h-6 w-6" style={{ color: habit.color }} />
                      ) : (
                        <Circle className="h-6 w-6 text-muted-foreground/50 hover:text-foreground" />
                      )}
                    </button>

                    {/* Name */}
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium truncate ${done ? "line-through text-muted-foreground" : "text-foreground"}`}>
                        {habit.habit_name}
                      </p>
                    </div>

                    {/* Streak */}
                    {streak > 0 && (
                      <Badge
                        variant="secondary"
                        className="gap-1 text-xs px-2 py-0.5 bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 border-orange-200 dark:border-orange-800"
                      >
                        <Flame className="h-3 w-3" />
                        {streak}
                      </Badge>
                    )}

                    {/* Delete */}
                    <button
                      onClick={() => handleDelete(habit.id)}
                      disabled={isDeleting}
                      className="opacity-0 group-hover:opacity-100 transition-opacity ml-1 text-muted-foreground/50 hover:text-destructive"
                    >
                      {isDeleting ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </button>
                  </motion.div>
                )
              })}
            </div>
          </AnimatePresence>
        )}
      </CardContent>
    </Card>
  )
}

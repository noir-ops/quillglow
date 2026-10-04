"use client"

import { useState, useEffect, useCallback } from "react"
import { motion } from "framer-motion"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts"
import { Pencil, Trash2, Plus, Palette } from "lucide-react"
import { createBrowserClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import type { PomodoroSession, Task } from "@/lib/types/study"

const DEFAULT_COLORS = [
  "#6366f1", "#8b5cf6", "#ec4899", "#f59e0b",
  "#10b981", "#3b82f6", "#f97316", "#14b8a6",
]

const COLOR_PRESETS = [
  "#6366f1", "#8b5cf6", "#ec4899", "#f97316",
  "#f59e0b", "#10b981", "#14b8a6", "#3b82f6",
  "#ef4444", "#84cc16", "#06b6d4", "#a855f7",
]

interface SubjectBreakdownProps {
  sessions: PomodoroSession[]
  tasks: Task[]
  flashcards: any[]
  userId: string
}

interface SubjectEntry {
  subject: string
  minutes: number
  tasksCompleted: number
  color: string
}

interface ManualEntryForm {
  subject: string
  hours: string
  priority: string
}

export function SubjectBreakdown({ sessions, tasks: initialTasks, flashcards, userId }: SubjectBreakdownProps) {
  const supabase = createBrowserClient()

  const [tasks, setTasks] = useState<Task[]>(initialTasks)
  const [subjectColors, setSubjectColors] = useState<Record<string, string>>({})
  const [editColorSubject, setEditColorSubject] = useState<string | null>(null)
  const [pickerColor, setPickerColor] = useState("#6366f1")
  const [addEntryOpen, setAddEntryOpen] = useState(false)
  const [manualForm, setManualForm] = useState<ManualEntryForm>({ subject: "", hours: "", priority: "medium" })
  const [addLoading, setAddLoading] = useState(false)

  // Load saved subject colors from DB
  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("subject_colors")
        .select("subject, color")
        .eq("user_id", userId)
      if (data) {
        const map: Record<string, string> = {}
        data.forEach((r: any) => { map[r.subject] = r.color })
        setSubjectColors(map)
      }
    }
    load()
  }, [userId])

  // Build subject entries from tasks + sessions
  const buildEntries = useCallback((): SubjectEntry[] => {
    const subjectTime: Record<string, number> = {}
    const subjectTasks: Record<string, number> = {}

    tasks.forEach((task) => {
      const subject = task.subject || "Other"
      const taskSessions = sessions.filter((s) => s.task_id === task.id)
      const minutes = taskSessions.reduce((acc, s) => acc + s.duration_minutes, 0)
      subjectTime[subject] = (subjectTime[subject] || 0) + minutes
      if (task.completed) {
        subjectTasks[subject] = (subjectTasks[subject] || 0) + 1
      }
    })

    const unlinkedSessions = sessions.filter((s) => !s.task_id)
    if (unlinkedSessions.length > 0) {
      const minutes = unlinkedSessions.reduce((acc, s) => acc + s.duration_minutes, 0)
      subjectTime["General Study"] = (subjectTime["General Study"] || 0) + minutes
    }

    return Object.entries(subjectTime).map(([subject, minutes], idx) => ({
      subject,
      minutes,
      tasksCompleted: subjectTasks[subject] || 0,
      color: subjectColors[subject] || DEFAULT_COLORS[idx % DEFAULT_COLORS.length],
    }))
  }, [tasks, sessions, subjectColors])

  const entries = buildEntries()

  const chartData = entries.map((e) => ({
    name: e.subject,
    value: Number((e.minutes / 60).toFixed(1)),
    color: e.color,
  }))

  // Save color for a subject
  const saveColor = async (subject: string, color: string) => {
    const { error } = await supabase
      .from("subject_colors")
      .upsert({ user_id: userId, subject, color }, { onConflict: "user_id,subject" })

    if (error) {
      toast.error("Failed to save color")
      return
    }
    setSubjectColors((prev) => ({ ...prev, [subject]: color }))
    setEditColorSubject(null)
    toast.success(`Color updated for ${subject}`)
  }

  // Delete a task by id
  const deleteTask = async (taskId: string) => {
    const { error } = await supabase.from("tasks").delete().eq("id", taskId).eq("user_id", userId)
    if (error) {
      toast.error("Failed to delete task")
      return
    }
    setTasks((prev) => prev.filter((t) => t.id !== taskId))
    toast.success("Task deleted")
  }

  // Mark task as incomplete (undo completed)
  const unmarkComplete = async (taskId: string) => {
    const { error } = await supabase
      .from("tasks")
      .update({ completed: false, completed_at: null, updated_at: new Date().toISOString() })
      .eq("id", taskId)
      .eq("user_id", userId)
    if (error) {
      toast.error("Failed to update task")
      return
    }
    setTasks((prev) => prev.map((t) => t.id === taskId ? { ...t, completed: false, completed_at: undefined } : t))
    toast.success("Task marked as incomplete")
  }

  // Edit task subject
  const updateTaskSubject = async (taskId: string, newSubject: string) => {
    const { error } = await supabase
      .from("tasks")
      .update({ subject: newSubject, updated_at: new Date().toISOString() })
      .eq("id", taskId)
      .eq("user_id", userId)
    if (error) {
      toast.error("Failed to update subject")
      return
    }
    setTasks((prev) => prev.map((t) => t.id === taskId ? { ...t, subject: newSubject } : t))
    toast.success("Subject updated")
  }

  // Add manual task entry
  const addManualEntry = async () => {
    if (!manualForm.subject.trim() || !manualForm.hours) {
      toast.error("Subject and hours are required")
      return
    }
    setAddLoading(true)
    const { data, error } = await supabase
      .from("tasks")
      .insert({
        user_id: userId,
        title: `${manualForm.subject} study session`,
        subject: manualForm.subject.trim(),
        priority: manualForm.priority as "low" | "medium" | "high",
        completed: true,
        completed_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (error || !data) {
      toast.error("Failed to add entry")
      setAddLoading(false)
      return
    }
    setTasks((prev) => [...prev, data])
    setManualForm({ subject: "", hours: "", priority: "medium" })
    setAddEntryOpen(false)
    toast.success(`Added entry for ${manualForm.subject}`)
    setAddLoading(false)
  }

  const uniqueSubjects = Array.from(new Set(tasks.map((t) => t.subject).filter(Boolean))) as string[]

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Subject Breakdown</CardTitle>
            {/* Add manual entry */}
            <Dialog open={addEntryOpen} onOpenChange={setAddEntryOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
                  <Plus className="h-3.5 w-3.5" />
                  Add Entry
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-sm">
                <DialogHeader>
                  <DialogTitle>Add Study Entry</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-2">
                  <div className="space-y-1.5">
                    <Label>Subject</Label>
                    <Input
                      placeholder="e.g. Mathematics"
                      value={manualForm.subject}
                      onChange={(e) => setManualForm((f) => ({ ...f, subject: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Hours studied</Label>
                    <Input
                      type="number"
                      min="0.1"
                      step="0.1"
                      placeholder="e.g. 1.5"
                      value={manualForm.hours}
                      onChange={(e) => setManualForm((f) => ({ ...f, hours: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Priority</Label>
                    <Select
                      value={manualForm.priority}
                      onValueChange={(v) => setManualForm((f) => ({ ...f, priority: v }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button className="w-full" onClick={addManualEntry} disabled={addLoading}>
                    {addLoading ? "Adding..." : "Add Entry"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {chartData.length === 0 ? (
            <div className="h-[300px] flex items-center justify-center text-muted-foreground">
              <p>No study data yet. Add an entry to get started.</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  outerRadius={90}
                  dataKey="value"
                >
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number) => [`${value}h`, "Study Time"]}
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                />
                <Legend
                  formatter={(value) => (
                    <span className="text-xs text-foreground">{value}</span>
                  )}
                />
              </PieChart>
            </ResponsiveContainer>
          )}

          {/* Subject rows with color picker + edit/delete */}
          {entries.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Subjects</p>
                <p className="text-xs text-muted-foreground">
                  Total: {(entries.reduce((acc, e) => acc + e.minutes, 0) / 60).toFixed(1)}h studied
                </p>
              </div>
              <div className="space-y-2">
                {entries.map((entry) => {
                  const totalMinutes = entries.reduce((acc, e) => acc + e.minutes, 0)
                  const percentage = totalMinutes > 0 ? (entry.minutes / totalMinutes) * 100 : 0
                  const hours = entry.minutes / 60

                  return (
                    <div
                      key={entry.subject}
                      className="group rounded-lg border bg-card p-3 hover:shadow-sm transition-all"
                    >
                      <div className="flex items-center gap-3">
                        {/* Color swatch — click to edit */}
                        <button
                          onClick={() => {
                            setEditColorSubject(entry.subject)
                            setPickerColor(entry.color)
                          }}
                          className="relative h-8 w-8 rounded-lg flex-shrink-0 ring-1 ring-border hover:ring-2 hover:ring-primary transition-all"
                          style={{ backgroundColor: entry.color }}
                          title="Change color"
                        >
                          <Palette className="absolute inset-0 m-auto h-3.5 w-3.5 text-white opacity-0 group-hover:opacity-80 transition-opacity" />
                        </button>

                        {/* Subject name + time stats */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-semibold truncate">{entry.subject}</span>
                            <span className="text-sm font-bold" style={{ color: entry.color }}>
                              {hours.toFixed(1)}h
                            </span>
                          </div>
                          {/* Progress bar showing proportion of total time */}
                          <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all duration-500"
                              style={{ width: `${percentage}%`, backgroundColor: entry.color }}
                            />
                          </div>
                          <div className="flex items-center justify-between mt-1">
                            <span className="text-xs text-muted-foreground">
                              {entry.tasksCompleted} task{entry.tasksCompleted !== 1 ? "s" : ""} completed
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {percentage.toFixed(0)}% of total
                            </span>
                          </div>
                        </div>

                        {/* Actions — visible on hover */}
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {/* Edit subject tasks inline */}
                      <Dialog>
                        <DialogTrigger asChild>
                          <button
                            className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                            title="Edit tasks"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                        </DialogTrigger>
                        <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
                          <DialogHeader>
                            <DialogTitle>Tasks — {entry.subject}</DialogTitle>
                          </DialogHeader>
                          <div className="space-y-2 pt-2">
                            {tasks
                              .filter((t) => (t.subject || "Other") === entry.subject)
                              .map((task) => (
                                <div
                                  key={task.id}
                                  className="flex items-start gap-3 p-3 rounded-lg border bg-muted/30"
                                >
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium truncate">{task.title}</p>
                                    <p className="text-xs text-muted-foreground mt-0.5">
                                      {task.completed ? "Completed" : "Pending"} · {task.priority} priority
                                    </p>
                                    {/* Edit subject inline */}
                                    <div className="mt-2">
                                      <Input
                                        className="h-7 text-xs"
                                        defaultValue={task.subject || ""}
                                        placeholder="Subject"
                                        onBlur={(e) => {
                                          const val = e.target.value.trim()
                                          if (val && val !== task.subject) {
                                            updateTaskSubject(task.id, val)
                                          }
                                        }}
                                      />
                                    </div>
                                  </div>
                                  <div className="flex flex-col gap-1">
                                    {task.completed && (
                                      <button
                                        onClick={() => unmarkComplete(task.id)}
                                        className="text-xs px-2 py-1 rounded bg-amber-100 text-amber-700 hover:bg-amber-200 transition-colors whitespace-nowrap"
                                        title="Undo completion"
                                      >
                                        Undo
                                      </button>
                                    )}
                                    <AlertDialog>
                                      <AlertDialogTrigger asChild>
                                        <button
                                          className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                                          title="Delete task"
                                        >
                                          <Trash2 className="h-3.5 w-3.5" />
                                        </button>
                                      </AlertDialogTrigger>
                                      <AlertDialogContent>
                                        <AlertDialogHeader>
                                          <AlertDialogTitle>Delete task?</AlertDialogTitle>
                                          <AlertDialogDescription>
                                            This will permanently delete "{task.title}". This cannot be undone.
                                          </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                                          <AlertDialogAction
                                            onClick={() => deleteTask(task.id)}
                                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                          >
                                            Delete
                                          </AlertDialogAction>
                                        </AlertDialogFooter>
                                      </AlertDialogContent>
                                    </AlertDialog>
                                  </div>
                                </div>
                              ))}
                            {tasks.filter((t) => (t.subject || "Other") === entry.subject).length === 0 && (
                              <p className="text-sm text-muted-foreground text-center py-4">No tasks for this subject</p>
                            )}
                          </div>
                        </DialogContent>
                      </Dialog>
                      </div>
                    </div>
                  </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Color picker popover */}
          {editColorSubject && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setEditColorSubject(null)}>
              <div
                className="bg-card border rounded-xl p-4 shadow-xl space-y-3 w-64"
                onClick={(e) => e.stopPropagation()}
              >
                <p className="text-sm font-semibold">Color for "{editColorSubject}"</p>

                {/* Preset swatches */}
                <div className="grid grid-cols-6 gap-2">
                  {COLOR_PRESETS.map((c) => (
                    <button
                      key={c}
                      onClick={() => setPickerColor(c)}
                      className="h-7 w-7 rounded-full ring-1 ring-border hover:scale-110 transition-transform"
                      style={{
                        backgroundColor: c,
                        outline: pickerColor === c ? `2px solid hsl(var(--primary))` : "none",
                        outlineOffset: "2px",
                      }}
                    />
                  ))}
                </div>

                {/* Custom hex input */}
                <div className="flex items-center gap-2">
                  <div
                    className="h-8 w-8 rounded-md ring-1 ring-border flex-shrink-0"
                    style={{ backgroundColor: pickerColor }}
                  />
                  <input
                    type="color"
                    value={pickerColor}
                    onChange={(e) => setPickerColor(e.target.value)}
                    className="h-8 w-full cursor-pointer rounded-md border"
                    title="Custom color"
                  />
                </div>

                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="flex-1" onClick={() => setEditColorSubject(null)}>
                    Cancel
                  </Button>
                  <Button size="sm" className="flex-1" onClick={() => saveColor(editColorSubject, pickerColor)}>
                    Save
                  </Button>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  )
}

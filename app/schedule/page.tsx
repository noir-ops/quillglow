"use client"

import { useState, useEffect, useCallback } from "react"
import { motion } from "framer-motion"
import { Plus, ChevronLeft, ChevronRight, CalendarIcon, GripVertical, X, CheckCircle2, ArrowLeft } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { createBrowserClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { format, addDays, startOfWeek, isSameDay, parseISO, setHours, setMinutes } from "date-fns"
import Link from "next/link"
import { AppLayout } from "@/components/dashboard/app-layout"

interface TimeBlock {
  id: string
  title: string
  start_time: string
  end_time: string
  color: string
  task_id?: string
}

interface Task {
  id: string
  title: string
  priority: string
  completed: boolean
  subject?: string
}

const COLORS = [
  { name: "Emerald", value: "#10b981" },
  { name: "Blue", value: "#3b82f6" },
  { name: "Purple", value: "#8b5cf6" },
  { name: "Pink", value: "#ec4899" },
  { name: "Orange", value: "#f97316" },
  { name: "Red", value: "#ef4444" },
  { name: "Cyan", value: "#06b6d4" },
  { name: "Yellow", value: "#eab308" },
]

const HOURS = Array.from({ length: 24 }, (_, i) => i)

export default function SchedulePage() {
  const [timeBlocks, setTimeBlocks] = useState<TimeBlock[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [weekStart, setWeekStart] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }))
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingBlock, setEditingBlock] = useState<TimeBlock | null>(null)
  const [draggedTask, setDraggedTask] = useState<Task | null>(null)
  const [draggedBlock, setDraggedBlock] = useState<TimeBlock | null>(null)
  const [isDraggingBlock, setIsDraggingBlock] = useState(false)
  const [blockTitle, setBlockTitle] = useState("")
  const [blockStartHour, setBlockStartHour] = useState("9")
  const [blockStartMinute, setBlockStartMinute] = useState("00")
  const [blockEndHour, setBlockEndHour] = useState("10")
  const [blockEndMinute, setBlockEndMinute] = useState("00")
  const [blockColor, setBlockColor] = useState("#10b981")

  const supabase = createBrowserClient()

  const fetchData = useCallback(async () => {
    setLoading(true)
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return

    const weekEnd = addDays(weekStart, 7)
    const { data: blocks } = await supabase
      .from("time_blocks")
      .select("*")
      .eq("user_id", user.id)
      .gte("start_time", weekStart.toISOString())
      .lt("start_time", weekEnd.toISOString())
      .order("start_time")

    const { data: userTasks } = await supabase
      .from("tasks")
      .select("*")
      .eq("user_id", user.id)
      .eq("completed", false)
      .order("due_date")

    setTimeBlocks(blocks || [])
    setTasks(userTasks || [])
    setLoading(false)
  }, [supabase, weekStart])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleCreateBlock = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return

    const startTime = setMinutes(
      setHours(selectedDate, Number.parseInt(blockStartHour)),
      Number.parseInt(blockStartMinute),
    )
    const endTime = setMinutes(setHours(selectedDate, Number.parseInt(blockEndHour)), Number.parseInt(blockEndMinute))

    if (endTime <= startTime) {
      toast.error("End time must be after start time")
      return
    }

    const { data, error } = await supabase
      .from("time_blocks")
      .insert({
        user_id: user.id,
        title: blockTitle,
        start_time: startTime.toISOString(),
        end_time: endTime.toISOString(),
        color: blockColor,
      })
      .select()
      .single()

    if (error) {
      toast.error("Failed to create time block")
    } else {
      toast.success("Time block created!")
      setTimeBlocks([...timeBlocks, data])
      resetForm()
      setDialogOpen(false)
    }
  }

  const handleUpdateBlock = async () => {
    if (!editingBlock) return

    const startTime = setMinutes(
      setHours(selectedDate, Number.parseInt(blockStartHour)),
      Number.parseInt(blockStartMinute),
    )
    const endTime = setMinutes(setHours(selectedDate, Number.parseInt(blockEndHour)), Number.parseInt(blockEndMinute))

    const { error } = await supabase
      .from("time_blocks")
      .update({
        title: blockTitle,
        start_time: startTime.toISOString(),
        end_time: endTime.toISOString(),
        color: blockColor,
      })
      .eq("id", editingBlock.id)

    if (error) {
      toast.error("Failed to update time block")
    } else {
      toast.success("Time block updated!")
      setTimeBlocks(
        timeBlocks.map((b) =>
          b.id === editingBlock.id
            ? {
                ...b,
                title: blockTitle,
                start_time: startTime.toISOString(),
                end_time: endTime.toISOString(),
                color: blockColor,
              }
            : b,
        ),
      )
      resetForm()
      setDialogOpen(false)
    }
  }

  const handleDeleteBlock = async (blockId: string) => {
    const { error } = await supabase.from("time_blocks").delete().eq("id", blockId)

    if (error) {
      toast.error("Failed to delete time block")
    } else {
      toast.success("Time block deleted")
      setTimeBlocks(timeBlocks.filter((b) => b.id !== blockId))
    }
  }

  const handleDropTask = async (task: Task, hour: number) => {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return

    const startTime = setMinutes(setHours(selectedDate, hour), 0)
    const endTime = setMinutes(setHours(selectedDate, hour + 1), 0)

    const { data, error } = await supabase
      .from("time_blocks")
      .insert({
        user_id: user.id,
        title: task.title,
        start_time: startTime.toISOString(),
        end_time: endTime.toISOString(),
        color: task.priority === "high" ? "#ef4444" : task.priority === "medium" ? "#f97316" : "#10b981",
        task_id: task.id,
      })
      .select()
      .single()

    if (error) {
      toast.error("Failed to schedule task")
    } else {
      toast.success("Task scheduled!")
      setTimeBlocks([...timeBlocks, data])
    }
    setDraggedTask(null)
  }

  const handleRepositionBlock = async (block: TimeBlock, newDate: Date, newStartHour: number) => {
    const oldStart = parseISO(block.start_time)
    const oldEnd = parseISO(block.end_time)
    const durationMinutes = (oldEnd.getTime() - oldStart.getTime()) / (1000 * 60)

    const newStartTime = setMinutes(setHours(newDate, newStartHour), 0)
    const newEndTime = new Date(newStartTime.getTime() + durationMinutes * 60 * 1000)

    const updatedBlock = {
      ...block,
      start_time: newStartTime.toISOString(),
      end_time: newEndTime.toISOString(),
    }

    const originalBlock = block

    setTimeBlocks(timeBlocks.map((b) => (b.id === block.id ? updatedBlock : b)))

    const { error } = await supabase
      .from("time_blocks")
      .update({
        start_time: newStartTime.toISOString(),
        end_time: newEndTime.toISOString(),
      })
      .eq("id", block.id)

    if (error) {
      setTimeBlocks(timeBlocks.map((b) => (b.id === block.id ? originalBlock : b)))
      toast.error("Couldn't update time block. Please try again.")
    } else {
      toast.success("Time block moved!")
    }
  }

  const resetForm = () => {
    setBlockTitle("")
    setBlockStartHour("9")
    setBlockStartMinute("00")
    setBlockEndHour("10")
    setBlockEndMinute("00")
    setBlockColor("#10b981")
    setEditingBlock(null)
  }

  const openEditDialog = (block: TimeBlock) => {
    const start = parseISO(block.start_time)
    const end = parseISO(block.end_time)
    setEditingBlock(block)
    setBlockTitle(block.title)
    setBlockStartHour(start.getHours().toString())
    setBlockStartMinute(start.getMinutes().toString().padStart(2, "0"))
    setBlockEndHour(end.getHours().toString())
    setBlockEndMinute(end.getMinutes().toString().padStart(2, "0"))
    setBlockColor(block.color)
    setSelectedDate(start)
    setDialogOpen(true)
  }

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))

  const getBlocksForDay = (date: Date) => {
    return timeBlocks.filter((block) => isSameDay(parseISO(block.start_time), date))
  }

  const getBlockPosition = (block: TimeBlock) => {
    const start = parseISO(block.start_time)
    const end = parseISO(block.end_time)
    const startHour = start.getHours() + start.getMinutes() / 60
    const endHour = end.getHours() + end.getMinutes() / 60
    const top = startHour * 60
    const height = (endHour - startHour) * 60
    return { top, height: Math.max(30, height) }
  }

  return (
    <AppLayout>
      <div className="mx-auto max-w-7xl px-4 py-6 sm:py-8 sm:px-6 lg:px-8 pb-24 sm:pb-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <Link href="/planner">
              <Button variant="ghost" size="icon" className="shrink-0">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Schedule</h1>
              <p className="text-muted-foreground text-sm sm:text-base mb-1">Plan your day with time blocks</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={() => setWeekStart(addDays(weekStart, -7))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              onClick={() => setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))}
              className="text-sm"
            >
              Today
            </Button>
            <Button variant="outline" size="icon" onClick={() => setWeekStart(addDays(weekStart, 7))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-4">
          <div className="lg:col-span-1 order-2 lg:order-1">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                  Tasks
                </CardTitle>
                <p className="text-xs text-muted-foreground">Drag to schedule</p>
              </CardHeader>
              <CardContent className="space-y-2 max-h-[300px] lg:max-h-[600px] overflow-y-auto">
                {tasks.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">No pending tasks</p>
                ) : (
                  tasks.map((task) => (
                    <motion.div
                      key={task.id}
                      draggable
                      onDragStart={() => setDraggedTask(task)}
                      onDragEnd={() => setDraggedTask(null)}
                      className="p-3 rounded-lg border bg-card hover:bg-accent cursor-grab active:cursor-grabbing transition-colors"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <div className="flex items-center gap-2">
                        <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{task.title}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span
                              className={`text-xs px-2 py-0.5 rounded-full ${
                                task.priority === "high"
                                  ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                                  : task.priority === "medium"
                                    ? "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400"
                                    : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                              }`}
                            >
                              {task.priority}
                            </span>
                            {task.subject && (
                              <span className="text-xs text-muted-foreground truncate">{task.subject}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-3 order-1 lg:order-2">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <CalendarIcon className="h-5 w-5 text-emerald-500" />
                    {format(weekStart, "MMMM yyyy")}
                  </CardTitle>
                  <Dialog
                    open={dialogOpen}
                    onOpenChange={(open) => {
                      setDialogOpen(open)
                      if (!open) resetForm()
                    }}
                  >
                    <DialogTrigger asChild>
                      <Button variant="sm" className="bg-emerald-600 hover:bg-emerald-700">
                        <Plus className="h-4 w-4 mr-1" />
                        <span className="hidden sm:inline">Add Block</span>
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-md">
                      <DialogHeader>
                        <DialogTitle>{editingBlock ? "Edit Time Block" : "Add Time Block"}</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4 pt-4">
                        <div className="space-y-2">
                          <Label>Title</Label>
                          <Input
                            value={blockTitle}
                            onChange={(e) => setBlockTitle(e.target.value)}
                            placeholder="e.g., Study Math"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label>Date</Label>
                          <Select
                            value={selectedDate.toISOString()}
                            onValueChange={(val) => setSelectedDate(new Date(val))}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {weekDays.map((day) => (
                                <SelectItem key={day.toISOString()} value={day.toISOString()}>
                                  {format(day, "EEE, MMM d")}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Start Time</Label>
                            <div className="flex gap-2">
                              <Select value={blockStartHour} onValueChange={setBlockStartHour}>
                                <SelectTrigger className="flex-1">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {HOURS.map((h) => (
                                    <SelectItem key={h} value={h.toString()}>
                                      {h.toString().padStart(2, "0")}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <Select value={blockStartMinute} onValueChange={setBlockStartMinute}>
                                <SelectTrigger className="w-20">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {["00", "15", "30", "45"].map((m) => (
                                    <SelectItem key={m} value={m}>
                                      {m}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                          <div className="space-y-2">
                            <Label>End Time</Label>
                            <div className="flex gap-2">
                              <Select value={blockEndHour} onValueChange={setBlockEndHour}>
                                <SelectTrigger className="flex-1">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {HOURS.map((h) => (
                                    <SelectItem key={h} value={h.toString()}>
                                      {h.toString().padStart(2, "0")}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <Select value={blockEndMinute} onValueChange={setBlockEndMinute}>
                                <SelectTrigger className="w-20">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {["00", "15", "30", "45"].map((m) => (
                                    <SelectItem key={m} value={m}>
                                      {m}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label>Color</Label>
                          <div className="flex flex-wrap gap-2">
                            {COLORS.map((color) => (
                              <button
                                key={color.value}
                                type="button"
                                onClick={() => setBlockColor(color.value)}
                                className={`w-8 h-8 rounded-full border-2 transition-all ${
                                  blockColor === color.value
                                    ? "border-foreground scale-110"
                                    : "border-transparent hover:scale-105"
                                }`}
                                style={{ backgroundColor: color.value }}
                                title={color.name}
                              />
                            ))}
                          </div>
                        </div>

                        <Button
                          onClick={editingBlock ? handleUpdateBlock : handleCreateBlock}
                          className="w-full bg-emerald-600 hover:bg-emerald-700"
                          disabled={!blockTitle}
                        >
                          {editingBlock ? "Update Block" : "Create Block"}
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardHeader>
              <CardContent className="p-0 sm:p-6">
                <div className="grid grid-cols-7 border-b">
                  {weekDays.map((day) => (
                    <button
                      key={day.toISOString()}
                      onClick={() => setSelectedDate(day)}
                      className={`p-2 sm:p-3 text-center transition-colors ${
                        isSameDay(day, selectedDate) ? "bg-emerald-100 dark:bg-emerald-900/30" : "hover:bg-accent"
                      } ${isSameDay(day, new Date()) ? "font-bold" : ""}`}
                    >
                      <p className="text-xs text-muted-foreground">{format(day, "EEE")}</p>
                      <p
                        className={`text-lg sm:text-xl ${
                          isSameDay(day, new Date()) ? "text-emerald-600 dark:text-emerald-400" : ""
                        }`}
                      >
                        {format(day, "d")}
                      </p>
                    </button>
                  ))}
                </div>

                <div className="relative overflow-x-auto">
                  <div className="sm:hidden">
                    <div className="min-h-[500px] relative flex">
                      <div className="w-14 shrink-0 relative border-r border-muted">
                        {HOURS.map((hour) => (
                          <div key={hour} className="h-[60px] flex items-start justify-end pr-2 pt-1">
                            <span className="text-xs text-muted-foreground font-medium">
                              {format(setMinutes(setHours(new Date(), hour), 0), "ha")}
                            </span>
                          </div>
                        ))}
                      </div>

                      <div className="flex-1 relative">
                        {HOURS.map((hour) => (
                          <div
                            key={hour}
                            className="h-[60px] border-t border-dashed border-muted hover:bg-accent/30 transition-colors"
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={() => {
                              if (draggedTask) {
                                handleDropTask(draggedTask, hour)
                              } else if (draggedBlock) {
                                handleRepositionBlock(draggedBlock, selectedDate, hour)
                                setDraggedBlock(null)
                                setIsDraggingBlock(false)
                              }
                            }}
                          />
                        ))}

                        {getBlocksForDay(selectedDate).map((block) => {
                          const { top, height } = getBlockPosition(block)
                          const isBeingDragged = draggedBlock?.id === block.id
                          return (
                            <motion.div
                              key={block.id}
                              initial={{ opacity: 0, scale: 0.9 }}
                              animate={{
                                opacity: isBeingDragged ? 0.5 : 1,
                                scale: isBeingDragged ? 1.05 : 1,
                              }}
                              draggable
                              onDragStart={() => {
                                setDraggedBlock(block)
                                setIsDraggingBlock(true)
                              }}
                              onDragEnd={() => {
                                setDraggedBlock(null)
                                setIsDraggingBlock(false)
                              }}
                              className={`absolute left-2 right-2 top-0 p-2 group overflow-hidden transition-shadow ${
                                isBeingDragged ? "cursor-grabbing shadow-2xl" : "cursor-grab"
                              }`}
                              style={{
                                top: `${top}px`,
                                height: `${height}px`,
                                backgroundColor: block.color,
                              }}
                              onClick={() => !isDraggingBlock && openEditDialog(block)}
                            >
                              <div className="flex items-start justify-between h-full">
                                <div className="min-w-0 flex-1">
                                  <p className="text-white font-medium text-sm truncate">{block.title}</p>
                                  <p className="text-white/80 text-xs">
                                    {format(parseISO(block.start_time), "h:mm a")} -{" "}
                                    {format(parseISO(block.end_time), "h:mm a")}
                                  </p>
                                </div>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6 opacity-0 group-hover:opacity-100 text-white hover:bg-white/20 shrink-0"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleDeleteBlock(block.id)
                                  }}
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </div>
                            </motion.div>
                          )
                        })}
                      </div>
                    </div>
                  </div>

                  <div className="hidden sm:block">
                    <div className="flex min-h-[600px]">
                      <div className="w-16 shrink-0 relative border-r border-muted">
                        {HOURS.map((hour) => (
                          <div key={hour} className="h-[60px] flex items-start justify-end pr-3 pt-1">
                            <span className="text-xs text-muted-foreground font-medium">
                              {format(setMinutes(setHours(new Date(), hour), 0), "h:mm a")}
                            </span>
                          </div>
                        ))}
                      </div>

                      <div className="flex-1 grid grid-cols-7">
                        {weekDays.map((day) => (
                          <div key={day.toISOString()} className="relative border-r last:border-r-0">
                            {HOURS.map((hour) => (
                              <div
                                key={hour}
                                className="h-[60px] border-t border-dashed border-muted hover:bg-accent/50 transition-colors"
                                onDragOver={(e) => e.preventDefault()}
                                onDrop={() => {
                                  if (draggedTask) {
                                    setSelectedDate(day)
                                    handleDropTask(draggedTask, hour)
                                  } else if (draggedBlock) {
                                    handleRepositionBlock(draggedBlock, day, hour)
                                    setDraggedBlock(null)
                                    setIsDraggingBlock(false)
                                  }
                                }}
                              />
                            ))}

                            {getBlocksForDay(day).map((block) => {
                              const { top, height } = getBlockPosition(block)
                              const isBeingDragged = draggedBlock?.id === block.id
                              return (
                                <motion.div
                                  key={block.id}
                                  initial={{ opacity: 0, scale: 0.9 }}
                                  animate={{
                                    opacity: isBeingDragged ? 0.5 : 1,
                                    scale: isBeingDragged ? 1.05 : 1,
                                  }}
                                  draggable
                                  onDragStart={() => {
                                    setDraggedBlock(block)
                                    setIsDraggingBlock(true)
                                  }}
                                  onDragEnd={() => {
                                    setDraggedBlock(null)
                                    setIsDraggingBlock(false)
                                  }}
                                  className={`absolute left-1 right-1 rounded-md p-1.5 group overflow-hidden transition-shadow ${
                                    isBeingDragged ? "cursor-grabbing shadow-2xl" : "cursor-grab"
                                  }`}
                                  style={{
                                    top: `${top}px`,
                                    height: `${height}px`,
                                    backgroundColor: block.color,
                                  }}
                                  onClick={() => {
                                    if (!isDraggingBlock) {
                                      setSelectedDate(day)
                                      openEditDialog(block)
                                    }
                                  }}
                                >
                                  <div className="flex items-start justify-between h-full">
                                    <div className="min-w-0 flex-1">
                                      <p className="text-white font-medium text-xs truncate">{block.title}</p>
                                      {height >= 45 && (
                                        <p className="text-white/80 text-[10px]">
                                          {format(parseISO(block.start_time), "h:mm")}
                                        </p>
                                      )}
                                    </div>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-5 w-5 opacity-0 group-hover:opacity-100 text-white hover:bg-white/20 shrink-0"
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        handleDeleteBlock(block.id)
                                      }}
                                    >
                                      <X className="h-3 w-3" />
                                    </Button>
                                  </div>
                                </motion.div>
                              )
                            })}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AppLayout>
  )
}

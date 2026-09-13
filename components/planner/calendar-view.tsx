"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
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

export function CalendarView({ tasks }: CalendarViewProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date())

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
              const isCurrentMonth = isSameMonth(day, currentMonth)
              const isCurrentDay = isToday(day)

              return (
                <motion.div
                  key={day.toISOString()}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: index * 0.01 }}
                  className={`min-h-[80px] p-2 rounded-lg border transition-colors ${
                    isCurrentDay
                      ? "bg-primary/10 border-primary"
                      : isCurrentMonth
                        ? "bg-card border-border hover:bg-accent"
                        : "bg-muted/50 border-transparent"
                  }`}
                >
                  <div
                    className={`text-sm font-medium mb-1 ${
                      isCurrentDay ? "text-primary" : isCurrentMonth ? "text-foreground" : "text-muted-foreground"
                    }`}
                  >
                    {format(day, "d")}
                  </div>
                  <div className="space-y-1">
                    {dayTasks.slice(0, 2).map((task) => (
                      <div
                        key={task.id}
                        className={`text-xs px-1.5 py-0.5 rounded truncate ${getPriorityColor(task.priority)} text-white`}
                        title={task.title}
                      >
                        {task.title}
                      </div>
                    ))}
                    {dayTasks.length > 2 && (
                      <div className="text-xs text-muted-foreground">+{dayTasks.length - 2} more</div>
                    )}
                  </div>
                </motion.div>
              )
            })}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}

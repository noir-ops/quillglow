"use client"

import type React from "react"
import { useEffect, useState, useCallback } from "react"
import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Calendar, Flame, TrendingUp, Target, BookOpen, CheckSquare } from "lucide-react"
import { Button } from "@/components/ui/button"

type HeatmapMode = "study" | "habit"

interface DayActivity {
  date: string
  score: number
  breakdown?: {
    tasks: number
    pomodoros: number
    flashcards: number
    exams: number
  }
  completed?: number
  total?: number
}

interface HeatmapStats {
  currentStreak: number
  longestStreak: number
  totalActiveDays: number
  totalHabits?: number
}

const INTENSITY_STUDY = [
  "bg-muted/30 dark:bg-muted/20 border border-border/30",
  "bg-emerald-200 dark:bg-emerald-900/50",
  "bg-emerald-300 dark:bg-emerald-800/60",
  "bg-emerald-500 dark:bg-emerald-600/80",
  "bg-emerald-700 dark:bg-emerald-400",
]

const INTENSITY_HABIT = [
  "bg-muted/30 dark:bg-muted/20 border border-border/30",
  "bg-violet-200 dark:bg-violet-900/50",
  "bg-violet-300 dark:bg-violet-800/60",
  "bg-violet-500 dark:bg-violet-600/80",
  "bg-violet-700 dark:bg-violet-400",
]

function getIntensityClass(score: number, mode: HeatmapMode) {
  const palette = mode === "study" ? INTENSITY_STUDY : INTENSITY_HABIT
  if (score === 0) return palette[0]
  if (score <= 2) return palette[1]
  if (score <= 5) return palette[2]
  if (score <= 8) return palette[3]
  return palette[4]
}

function getDayOfWeek(dateStr: string) {
  return new Date(dateStr + "T12:00:00").getDay()
}

function getMonthLabel(dateStr: string) {
  return new Date(dateStr + "T12:00:00").toLocaleDateString("en-US", { month: "short" })
}

function formatDate(dateStr: string) {
  return new Date(dateStr + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })
}

export function StudyHeatmap() {
  const [mode, setMode] = useState<HeatmapMode>("study")
  const [data, setData] = useState<DayActivity[]>([])
  const [stats, setStats] = useState<HeatmapStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [days, setDays] = useState(90)
  const [hoveredDay, setHoveredDay] = useState<DayActivity | null>(null)
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const endpoint =
        mode === "study"
          ? `/api/analytics/heatmap?days=${days}`
          : `/api/analytics/habit-heatmap?days=${days}`
      const res = await fetch(endpoint)
      const result = await res.json()
      setData(result.dailyActivity || [])
      setStats(result.stats || null)
    } catch (e) {
      console.error("[v0] Heatmap fetch error:", e)
    } finally {
      setLoading(false)
    }
  }, [mode, days])

  useEffect(() => { fetchData() }, [fetchData])

  // Group data into weeks (columns)
  const weeks: DayActivity[][] = []
  let currentWeek: DayActivity[] = []
  data.forEach((day, i) => {
    const dow = getDayOfWeek(day.date)
    if (dow === 0 && currentWeek.length > 0) {
      weeks.push(currentWeek)
      currentWeek = []
    }
    currentWeek.push(day)
    if (i === data.length - 1) weeks.push(currentWeek)
  })

  const handleHover = (day: DayActivity, e: React.MouseEvent) => {
    setHoveredDay(day)
    const rect = (e.target as HTMLElement).getBoundingClientRect()
    setTooltipPos({ x: rect.left + rect.width / 2, y: rect.top - 8 })
  }

  const accentColor = mode === "study" ? "text-emerald-500" : "text-violet-500"
  const accentBg   = mode === "study"
    ? "from-emerald-50 to-teal-50 dark:from-emerald-950/40 dark:to-teal-950/40 border-emerald-200/50 dark:border-emerald-800/50"
    : "from-violet-50 to-purple-50 dark:from-violet-950/40 dark:to-purple-950/40 border-violet-200/50 dark:border-violet-800/50"

  if (loading) {
    return (
      <Card className="p-6 space-y-4">
        <Skeleton className="h-7 w-56" />
        <Skeleton className="h-4 w-80" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-40 w-full" />
      </Card>
    )
  }

  const hasActivity = stats && stats.totalActiveDays > 0

  return (
    <Card className="p-4 sm:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div className="flex items-center gap-2">
          <Calendar className={`h-5 w-5 ${accentColor}`} />
          <h2 className="text-xl font-bold text-foreground">Activity Heatmap</h2>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Mode toggle */}
          <div className="flex rounded-lg border p-0.5 bg-muted/40">
            <button
              onClick={() => setMode("study")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                mode === "study"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <BookOpen className="h-3.5 w-3.5" />
              Study
            </button>
            <button
              onClick={() => setMode("habit")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                mode === "habit"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <CheckSquare className="h-3.5 w-3.5" />
              Habits
            </button>
          </div>

          {/* Days toggle */}
          <div className="flex gap-1">
            {[30, 90].map((d) => (
              <Button
                key={d}
                size="sm"
                variant={days === d ? "default" : "outline"}
                onClick={() => setDays(d)}
                className="text-xs h-8 px-3"
              >
                {d}d
              </Button>
            ))}
          </div>
        </div>
      </div>

      {!hasActivity ? (
        <div className="py-12 text-center space-y-3">
          <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center">
            {mode === "study" ? <BookOpen className="h-6 w-6 text-muted-foreground" /> : <CheckSquare className="h-6 w-6 text-muted-foreground" />}
          </div>
          <p className="font-semibold text-foreground">
            {mode === "study" ? "No study activity yet" : "No habit completions yet"}
          </p>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto">
            {mode === "study"
              ? "Start a Pomodoro session, complete a task, or review flashcards to build your streak."
              : "Create habits below and mark them complete daily to see your streak here."}
          </p>
        </div>
      ) : (
        <>
          {/* Stats row */}
          <div className="grid grid-cols-3 gap-3 mb-5">
            {[
              { icon: Flame, label: "Current Streak", value: stats.currentStreak, extra: "days", colorClass: "from-orange-50 to-red-50 dark:from-orange-950/40 dark:to-red-950/40 border-orange-200/50 dark:border-orange-800/50", iconColor: "text-orange-500" },
              { icon: TrendingUp, label: "Longest Streak", value: stats.longestStreak, extra: "days", colorClass: "from-purple-50 to-pink-50 dark:from-purple-950/40 dark:to-pink-950/40 border-purple-200/50 dark:border-purple-800/50", iconColor: "text-purple-500" },
              { icon: Target, label: "Active Days", value: stats.totalActiveDays, extra: `of ${days}`, colorClass: accentBg, iconColor: accentColor },
            ].map(({ icon: Icon, label, value, extra, colorClass, iconColor }) => (
              <div key={label} className={`flex flex-col items-center p-3 sm:p-4 bg-gradient-to-br rounded-xl border ${colorClass}`}>
                <Icon className={`h-5 w-5 mb-1 ${iconColor}`} />
                <div className="text-xl sm:text-2xl font-bold text-foreground">{value}</div>
                <div className="text-xs text-muted-foreground text-center">{label}</div>
                <div className="text-[10px] text-muted-foreground/70 mt-0.5">{extra}</div>
              </div>
            ))}
          </div>

          {/* Heatmap grid */}
          <div className="overflow-x-auto pb-2 -mx-1 px-1">
            <div className="inline-flex flex-col gap-0 min-w-max">
              {/* Month labels */}
              <div className="flex gap-1.5 mb-1 pl-7">
                {weeks.map((week, wi) => {
                  const showLabel = wi === 0 || week[0]?.date.slice(8) === "01" || (wi > 0 && getMonthLabel(week[0]?.date) !== getMonthLabel(weeks[wi - 1]?.[0]?.date))
                  return (
                    <div key={wi} className="w-4 text-[10px] text-muted-foreground/70 font-medium">
                      {showLabel ? getMonthLabel(week[0]?.date) : ""}
                    </div>
                  )
                })}
              </div>

              {/* Day rows */}
              {[0, 1, 2, 3, 4, 5, 6].map((dow) => (
                <div key={dow} className="flex gap-1.5 items-center mb-1">
                  <div className="w-5 text-[10px] text-muted-foreground/60 text-right">
                    {dow === 1 ? "Mon" : dow === 3 ? "Wed" : dow === 5 ? "Fri" : ""}
                  </div>
                  {weeks.map((week, wi) => {
                    const day = week.find((d) => getDayOfWeek(d.date) === dow)
                    if (!day) return <div key={wi} className="w-4 h-4" />
                    return (
                      <div
                        key={day.date}
                        className={`w-4 h-4 rounded-sm cursor-pointer transition-all hover:ring-2 hover:ring-offset-1 hover:ring-primary hover:scale-125 ${getIntensityClass(day.score, mode)}`}
                        onMouseEnter={(e) => handleHover(day, e)}
                        onMouseLeave={() => { setHoveredDay(null); setTooltipPos(null) }}
                      />
                    )
                  })}
                </div>
              ))}
            </div>
          </div>

          {/* Legend */}
          <div className="flex items-center gap-2 mt-3 text-xs text-muted-foreground">
            <span>Less</span>
            <div className="flex gap-1">
              {[0, 2, 5, 8, 10].map((s, i) => (
                <div key={i} className={`w-4 h-4 rounded-sm ${getIntensityClass(s, mode)}`} />
              ))}
            </div>
            <span>More</span>
          </div>
        </>
      )}

      {/* Tooltip */}
      {hoveredDay && tooltipPos && (
        <div
          className="fixed z-50 pointer-events-none"
          style={{ left: tooltipPos.x, top: tooltipPos.y, transform: "translate(-50%, -100%)" }}
        >
          <div className="bg-popover text-popover-foreground border shadow-xl rounded-xl p-3 text-sm min-w-[150px]">
            <p className="font-semibold mb-1.5">{formatDate(hoveredDay.date)}</p>
            {mode === "study" ? (
              <div className="space-y-1 text-xs">
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">Score</span>
                  <span className="font-bold">{hoveredDay.score}</span>
                </div>
                {(hoveredDay.breakdown?.tasks ?? 0) > 0 && (
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">Tasks</span>
                    <span>{hoveredDay.breakdown!.tasks}</span>
                  </div>
                )}
                {(hoveredDay.breakdown?.pomodoros ?? 0) > 0 && (
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">Pomodoros</span>
                    <span>{hoveredDay.breakdown!.pomodoros}</span>
                  </div>
                )}
                {(hoveredDay.breakdown?.flashcards ?? 0) > 0 && (
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">Flashcards</span>
                    <span>{hoveredDay.breakdown!.flashcards}</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-xs space-y-1">
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">Completed</span>
                  <span className="font-bold">{hoveredDay.completed} / {hoveredDay.total}</span>
                </div>
                <div className="w-full bg-muted rounded-full h-1.5 mt-1">
                  <div
                    className="h-1.5 rounded-full bg-violet-500"
                    style={{ width: `${hoveredDay.total ? (hoveredDay.completed! / hoveredDay.total) * 100 : 0}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </Card>
  )
}

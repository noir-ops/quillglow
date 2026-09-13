"use client"

import { useMemo } from "react"
import { motion } from "framer-motion"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart,
  ReferenceLine,
  
} from "recharts"
import { format, startOfWeek, endOfWeek, eachDayOfInterval, isToday } from "date-fns"
import { TrendingUp, TrendingDown, Minus } from "lucide-react"
import type { PomodoroSession } from "@/lib/types/study"

interface StudyHoursChartProps {
  sessions: PomodoroSession[]
}

// Custom tooltip shown on hover
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  const hours = payload[0]?.value ?? 0
  const prev = payload[0]?.payload?.prev
  const diff = prev !== undefined ? hours - prev : null

  return (
    <div className="rounded-xl border bg-card px-4 py-3 shadow-lg text-sm min-w-[120px]">
      <p className="font-semibold text-foreground mb-1">{payload[0]?.payload?.fullDate}</p>
      <p className="text-2xl font-bold text-primary">{hours.toFixed(1)}h</p>
      {diff !== null && (
        <p
          className={`text-xs mt-1 font-medium flex items-center gap-1 ${
            diff > 0 ? "text-emerald-500" : diff < 0 ? "text-rose-500" : "text-muted-foreground"
          }`}
        >
          {diff > 0 ? (
            <TrendingUp className="h-3 w-3" />
          ) : diff < 0 ? (
            <TrendingDown className="h-3 w-3" />
          ) : (
            <Minus className="h-3 w-3" />
          )}
          {diff > 0 ? "+" : ""}{diff.toFixed(1)}h vs prev day
        </p>
      )}
    </div>
  )
}

// Custom dot — highlight today, hide zero-days
function CustomDot(props: any) {
  const { cx, cy, payload, value } = props
  if (value === 0) return null
  const isCurrentDay = payload?.isToday
  return (
    <circle
      cx={cx}
      cy={cy}
      r={isCurrentDay ? 6 : 4}
      fill={isCurrentDay ? "hsl(var(--primary))" : "hsl(var(--background))"}
      stroke="hsl(var(--primary))"
      strokeWidth={isCurrentDay ? 0 : 2.5}
    />
  )
}

function CustomActiveDot(props: any) {
  const { cx, cy } = props
  return (
    <circle
      cx={cx}
      cy={cy}
      r={6}
      fill="hsl(var(--primary))"
      stroke="hsl(var(--background))"
      strokeWidth={2}
    />
  )
}

export function StudyHoursChart({ sessions }: StudyHoursChartProps) {
  const today = new Date()
  const weekStart = startOfWeek(today, { weekStartsOn: 1 }) // Mon–Sun
  const weekEnd = endOfWeek(today, { weekStartsOn: 1 })
  const days = eachDayOfInterval({ start: weekStart, end: weekEnd })

  const chartData = useMemo(() => {
    const raw = days.map((day) => {
      const daySessions = sessions.filter((s) => {
        const d = new Date(s.completed_at!)
        return format(d, "yyyy-MM-dd") === format(day, "yyyy-MM-dd")
      })
      const hours = Number(
        (daySessions.reduce((acc, s) => acc + s.duration_minutes, 0) / 60).toFixed(2)
      )
      return {
        date: format(day, "EEE"),
        fullDate: format(day, "EEEE, MMM d"),
        hours,
        isToday: isToday(day),
      }
    })

    // Attach previous day's value for delta in tooltip
    return raw.map((d, i) => ({
      ...d,
      prev: i > 0 ? raw[i - 1].hours : undefined,
    }))
  }, [sessions])

  const totalHours = chartData.reduce((a, d) => a + d.hours, 0)
  const maxHours = Math.max(...chartData.map((d) => d.hours), 0.5)
  const todayHours = chartData.find((d) => d.isToday)?.hours ?? 0
  const avgHours = totalHours / chartData.filter((d) => d.hours > 0).length || 0

  // Week-over-week trend: compare first vs second half
  const firstHalf = chartData.slice(0, 3).reduce((a, d) => a + d.hours, 0)
  const secondHalf = chartData.slice(3).reduce((a, d) => a + d.hours, 0)
  const weekTrend = secondHalf - firstHalf

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle>Study Hours This Week</CardTitle>
              <p className="text-sm text-muted-foreground mt-0.5">
                {totalHours.toFixed(1)}h total &middot; {todayHours.toFixed(1)}h today
              </p>
            </div>
            {/* Trend badge */}
            <div
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold shrink-0 ${
                weekTrend > 0
                  ? "bg-emerald-500/10 text-emerald-600"
                  : weekTrend < 0
                  ? "bg-rose-500/10 text-rose-600"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {weekTrend > 0 ? (
                <TrendingUp className="h-3.5 w-3.5" />
              ) : weekTrend < 0 ? (
                <TrendingDown className="h-3.5 w-3.5" />
              ) : (
                <Minus className="h-3.5 w-3.5" />
              )}
              {weekTrend > 0 ? "Improving" : weekTrend < 0 ? "Slowing down" : "Steady"}
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-0">
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="studyGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.18} />
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
              </defs>

              {/* Minimal horizontal grid only */}
              <CartesianGrid
                strokeDasharray="4 4"
                vertical={false}
                stroke="hsl(var(--border))"
                strokeOpacity={0.6}
              />

              <XAxis
                dataKey="date"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))", fontWeight: 500 }}
                dy={6}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                tickFormatter={(v) => `${v}h`}
                domain={[0, Math.ceil(maxHours + 0.5)]}
                width={36}
              />

              {/* Average reference line */}
              {avgHours > 0 && (
                <ReferenceLine
                  y={Number(avgHours.toFixed(2))}
                  stroke="hsl(var(--muted-foreground))"
                  strokeDasharray="6 3"
                  strokeOpacity={0.5}
                  label={{
                    value: `avg ${avgHours.toFixed(1)}h`,
                    position: "insideTopRight",
                    fontSize: 10,
                    fill: "hsl(var(--muted-foreground))",
                    dy: -4,
                  }}
                />
              )}

              <Tooltip
                content={<CustomTooltip />}
                cursor={{
                  stroke: "hsl(var(--primary))",
                  strokeWidth: 1,
                  strokeDasharray: "4 3",
                  strokeOpacity: 0.5,
                }}
              />

              <Area
                type="monotone"
                dataKey="hours"
                stroke="hsl(var(--primary))"
                strokeWidth={2.5}
                fill="url(#studyGradient)"
                dot={<CustomDot />}
                activeDot={<CustomActiveDot />}
                isAnimationActive={true}
                animationDuration={900}
                animationEasing="ease-out"
              />
            </AreaChart>
          </ResponsiveContainer>

          {/* Day pills summary row */}
          <div className="flex gap-1.5 mt-3">
            {chartData.map((d) => (
              <div
                key={d.date}
                className={`flex-1 rounded-lg py-1.5 text-center transition-colors ${
                  d.isToday
                    ? "bg-primary/10 ring-1 ring-primary/30"
                    : d.hours > 0
                    ? "bg-muted/60"
                    : "bg-muted/20"
                }`}
              >
                <p className={`text-[10px] font-medium ${d.isToday ? "text-primary" : "text-muted-foreground"}`}>
                  {d.date}
                </p>
                <p
                  className={`text-xs font-bold mt-0.5 ${
                    d.hours === 0
                      ? "text-muted-foreground/40"
                      : d.isToday
                      ? "text-primary"
                      : "text-foreground"
                  }`}
                >
                  {d.hours > 0 ? `${d.hours.toFixed(1)}h` : "—"}
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}

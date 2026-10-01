"use client"

import { useEffect, useState } from "react"
import { Clock, TrendingUp, Zap } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"

interface StudySession {
  id: string
  session_name: string | null
  duration_seconds: number
  start_time: string
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (h > 0) {
    return `${h}h ${m}m`
  }
  if (m > 0) {
    return `${m}m`
  }
  return `${seconds}s`
}

export function DailyStudySummary() {
  const [todayTotal, setTodayTotal] = useState(0)
  const [sessionCount, setSessionCount] = useState(0)
  const [sessions, setSessions] = useState<StudySession[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchSessions() {
      try {
        const response = await fetch("/api/study-sessions")
        if (!response.ok) return
        const data = await response.json()
        setTodayTotal(data.todayTotal || 0)
        setSessionCount(data.sessionCount || 0)
        setSessions(data.sessions || [])
      } catch {
        // Silently fail
      } finally {
        setLoading(false)
      }
    }
    fetchSessions()

    // Refresh every 30 seconds
    const interval = setInterval(fetchSessions, 30000)
    return () => clearInterval(interval)
  }, [])

  if (loading) {
    return (
      <Card className="border-border">
        <CardContent className="p-6">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-muted animate-pulse" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-32 bg-muted rounded animate-pulse" />
              <div className="h-3 w-48 bg-muted rounded animate-pulse" />
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  const avgSessionLength = sessionCount > 0 ? Math.round(todayTotal / sessionCount) : 0

  return (
    <Card className="border-border overflow-hidden">
      <CardContent className="p-0">
        <div className="flex flex-col sm:flex-row">
          {/* Total time */}
          <div className="flex-1 p-5 flex items-center gap-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 flex-shrink-0">
              <Clock className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Today&apos;s Study Time
              </p>
              <p className="text-2xl font-bold text-foreground tabular-nums">
                {todayTotal > 0 ? formatDuration(todayTotal) : "0m"}
              </p>
            </div>
          </div>

          {/* Divider */}
          <div className="hidden sm:block w-px bg-border" />
          <div className="sm:hidden h-px bg-border mx-5" />

          {/* Sessions count */}
          <div className="flex-1 p-5 flex items-center gap-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500/10 flex-shrink-0">
              <Zap className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Sessions
              </p>
              <p className="text-2xl font-bold text-foreground tabular-nums">
                {sessionCount}
              </p>
            </div>
          </div>

          {/* Divider */}
          <div className="hidden sm:block w-px bg-border" />
          <div className="sm:hidden h-px bg-border mx-5" />

          {/* Average */}
          <div className="flex-1 p-5 flex items-center gap-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-500/10 flex-shrink-0">
              <TrendingUp className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Avg Session
              </p>
              <p className="text-2xl font-bold text-foreground tabular-nums">
                {avgSessionLength > 0 ? formatDuration(avgSessionLength) : "--"}
              </p>
            </div>
          </div>
        </div>

        {/* Recent sessions */}
        {sessions.length > 0 && (
          <div className="border-t border-border px-5 py-3">
            <p className="text-xs font-medium text-muted-foreground mb-2">Recent Sessions</p>
            <div className="flex flex-wrap gap-2">
              {sessions.slice(0, 5).map((session) => (
                <span
                  key={session.id}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-muted text-xs font-medium text-foreground"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                  {session.session_name || "Study session"}
                  <span className="text-muted-foreground">
                    {formatDuration(session.duration_seconds)}
                  </span>
                </span>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

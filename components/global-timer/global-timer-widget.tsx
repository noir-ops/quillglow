"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { Play, Pause, Square, Clock, ChevronDown, ChevronUp } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useGlobalTimerStore } from "@/lib/store/global-timer-store.ts"
import { toast } from "sonner"

function formatTime(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = totalSeconds % 60
  if (h > 0) {
    return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`
  }
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`
}

export function GlobalTimerWidget() {
  const {
    isRunning,
    isPaused,
    elapsedSeconds,
    sessionName,
    startTimer,
    pauseTimer,
    resumeTimer,
    stopTimer,
    tick,
    setSessionName,
    startTimestamp,
  } = useGlobalTimerStore()

  const [expanded, setExpanded] = useState(false)
  const [nameInput, setNameInput] = useState("")
  const [isSaving, setIsSaving] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Re-sync elapsed on mount (for page refreshes while running)
  useEffect(() => {
    if (isRunning && !isPaused && startTimestamp) {
      tick()
    }
  }, [])

  // Tick interval
  useEffect(() => {
    if (isRunning && !isPaused) {
      intervalRef.current = setInterval(() => {
        tick()
      }, 1000)
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [isRunning, isPaused, tick])

  const handleStart = useCallback(() => {
    startTimer(nameInput.trim() || undefined)
    setNameInput("")
    setExpanded(false)
  }, [nameInput, startTimer])

  const handlePauseResume = useCallback(() => {
    if (isPaused) {
      resumeTimer()
    } else {
      pauseTimer()
    }
  }, [isPaused, pauseTimer, resumeTimer])

  const handleStop = useCallback(async () => {
    const result = stopTimer()
    if (!result || result.duration < 1) {
      toast.info("Session too short to save.")
      return
    }

    setIsSaving(true)
    try {
      const response = await fetch("/api/study-sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_name: result.name || null,
          task_reference: result.taskId,
          start_time: new Date(result.startTime).toISOString(),
          end_time: new Date().toISOString(),
          duration_seconds: result.duration,
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to save session")
      }

      const mins = Math.floor(result.duration / 60)
      const secs = result.duration % 60
      toast.success(
        `Session saved! ${mins > 0 ? `${mins}m ` : ""}${secs}s of focused study.`,
      )
    } catch {
      toast.error("Failed to save study session. Please try again.")
    } finally {
      setIsSaving(false)
    }
  }, [stopTimer])

  const isActive = isRunning || isPaused

  // Compact idle state
  if (!isActive && !expanded) {
    return (
      <div className="flex items-center gap-1.5">
        <button
          onClick={() => setExpanded(true)}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
          aria-label="Start study timer"
        >
          <Clock className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Study Timer</span>
        </button>
      </div>
    )
  }

  // Expanded start form
  if (!isActive && expanded) {
    return (
      <div className="flex items-center gap-1.5">
        <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-card border border-border shadow-sm">
          <Clock className="h-3.5 w-3.5 text-primary flex-shrink-0" />
          <input
            type="text"
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleStart()
              if (e.key === "Escape") setExpanded(false)
            }}
            placeholder="Session name..."
            className="w-24 sm:w-32 text-xs bg-transparent border-none outline-none placeholder:text-muted-foreground/50 text-foreground"
            autoFocus
          />
          <Button
            size="sm"
            onClick={handleStart}
            className="h-6 px-2 text-xs rounded-md"
          >
            <Play className="h-3 w-3 mr-1" />
            Start
          </Button>
          <button
            onClick={() => setExpanded(false)}
            className="p-0.5 rounded text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Close timer"
          >
            <ChevronUp className="h-3 w-3" />
          </button>
        </div>
      </div>
    )
  }

  // Active timer display
  return (
    <div className="flex items-center gap-1.5">
      <div
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border shadow-sm transition-colors ${
          isPaused
            ? "bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800/50"
            : "bg-emerald-50 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-800/50"
        }`}
      >
        {/* Pulsing dot */}
        <span className="relative flex h-2 w-2 flex-shrink-0">
          {!isPaused && (
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
          )}
          <span
            className={`relative inline-flex h-2 w-2 rounded-full ${
              isPaused ? "bg-amber-500" : "bg-emerald-500"
            }`}
          />
        </span>

        {/* Session name (truncated) */}
        {sessionName && (
          <span className="hidden sm:inline text-xs text-foreground/70 max-w-16 truncate">
            {sessionName}
          </span>
        )}

        {/* Time display */}
        <span
          className={`font-mono text-xs font-semibold tabular-nums ${
            isPaused ? "text-amber-700 dark:text-amber-300" : "text-emerald-700 dark:text-emerald-300"
          }`}
        >
          {formatTime(elapsedSeconds)}
        </span>

        {/* Pause / Resume */}
        <button
          onClick={handlePauseResume}
          className={`p-1 rounded-md transition-colors ${
            isPaused
              ? "text-amber-600 hover:bg-amber-100 dark:text-amber-400 dark:hover:bg-amber-900/40"
              : "text-emerald-600 hover:bg-emerald-100 dark:text-emerald-400 dark:hover:bg-emerald-900/40"
          }`}
          aria-label={isPaused ? "Resume timer" : "Pause timer"}
        >
          {isPaused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
        </button>

        {/* Stop */}
        <button
          onClick={handleStop}
          disabled={isSaving}
          className="p-1 rounded-md text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors disabled:opacity-50"
          aria-label="Stop and save timer"
        >
          <Square className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}

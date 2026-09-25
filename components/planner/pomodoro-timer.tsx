"use client"

import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import { Play, Pause, RotateCcw, Coffee } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { useStudyStore } from "@/lib/store/study-store"
import { createBrowserClient } from "@/lib/supabase/client"
import { toast } from "sonner"

export function PomodoroTimer() {
  const {
    pomodoroActive,
    pomodoroTimeLeft,
    pomodoroTaskId,
    startPomodoro,
    pausePomodoro,
    resetPomodoro,
    tickPomodoro,
  } = useStudyStore()
  const [isBreak, setIsBreak] = useState(false)
  const [breakTimeLeft, setBreakTimeLeft] = useState(5 * 60) // 5 minutes
  const supabase = createBrowserClient()

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null

    if (pomodoroActive && !isBreak) {
      interval = setInterval(() => {
        tickPomodoro()

        if (pomodoroTimeLeft <= 1) {
          // Pomodoro completed
          pausePomodoro()
          setIsBreak(true)
          toast.success("Great job! Take a 5-minute break 🎉")

          // Log session to database
          const logSession = async () => {
            const {
              data: { user },
            } = await supabase.auth.getUser()
            if (user) {
              await supabase.from("pomodoro_sessions").insert({
                user_id: user.id,
                task_id: pomodoroTaskId,
                duration_minutes: 25,
                completed: true,
                completed_at: new Date().toISOString(),
              })
            }
          }
          logSession()
        }
      }, 1000)
    } else if (isBreak && pomodoroActive) {
      interval = setInterval(() => {
        setBreakTimeLeft((prev) => {
          if (prev <= 1) {
            setIsBreak(false)
            resetPomodoro()
            toast.success("Break over! Ready for another session?")
            return 5 * 60
          }
          return prev - 1
        })
      }, 1000)
    }

    return () => {
      if (interval) clearInterval(interval)
    }
  }, [pomodoroActive, pomodoroTimeLeft, isBreak, tickPomodoro, pausePomodoro, resetPomodoro, pomodoroTaskId, supabase])

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
  }

  const currentTime = isBreak ? breakTimeLeft : pomodoroTimeLeft
  const totalTime = isBreak ? 5 * 60 : 25 * 60
  const progress = ((totalTime - currentTime) / totalTime) * 100

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
      <Card className={isBreak ? "bg-green-500/10 border-green-500/30" : ""}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {isBreak ? <Coffee className="h-5 w-5 text-green-500" /> : <Play className="h-5 w-5 text-primary" />}
            {isBreak ? "Break Time" : "Pomodoro Timer"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {/* Timer Display */}
            <div className="text-center">
              <motion.div
                key={currentTime}
                initial={{ scale: 1.1 }}
                animate={{ scale: 1 }}
                className="text-6xl font-bold text-foreground mb-4"
              >
                {formatTime(currentTime)}
              </motion.div>
              <Progress value={progress} className="h-2" />
            </div>

            {/* Controls */}
            <div className="flex gap-2">
              {!pomodoroActive ? (
                <Button className="flex-1" size="lg" onClick={() => startPomodoro()}>
                  <Play className="mr-2 h-4 w-4" />
                  Start
                </Button>
              ) : (
                <Button className="flex-1 bg-transparent" size="lg" variant="outline" onClick={pausePomodoro}>
                  <Pause className="mr-2 h-4 w-4" />
                  Pause
                </Button>
              )}
              <Button
                variant="outline"
                size="lg"
                onClick={() => {
                  resetPomodoro()
                  setIsBreak(false)
                  setBreakTimeLeft(5 * 60)
                }}
              >
                <RotateCcw className="h-4 w-4" />
              </Button>
            </div>

            {/* Info */}
            <div className="text-center text-sm text-muted-foreground">
              {isBreak ? (
                <p>Relax and recharge for your next session</p>
              ) : (
                <p>Focus for 25 minutes, then take a 5-minute break</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}

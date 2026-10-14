"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { Smile } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { Textarea } from "@/components/ui/textarea"
import { createBrowserClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import type { MoodLog } from "@/lib/types/study"

interface MoodTrackerProps {
  userId: string
  moodLogs: MoodLog[]
}

export function MoodTracker({ userId, moodLogs }: MoodTrackerProps) {
  const [moodScore, setMoodScore] = useState([7])
  const [notes, setNotes] = useState("")
  const [loading, setLoading] = useState(false)
  const supabase = createBrowserClient()
  const router = useRouter()

  const handleLogMood = async () => {
    setLoading(true)

    const { error } = await supabase.from("mood_logs").insert({
      user_id: userId,
      mood_score: moodScore[0],
      notes,
    })

    if (error) {
      toast.error("Failed to log mood")
    } else {
      toast.success("Mood logged!")
      setNotes("")
      router.refresh()
    }

    setLoading(false)
  }

  const avgMood = moodLogs.length > 0 ? moodLogs.reduce((acc, m) => acc + m.mood_score, 0) / moodLogs.length : 0

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Smile className="h-5 w-5" />
            Mood Tracker
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {avgMood > 0 && (
            <div className="p-3 rounded-lg bg-primary/10">
              <p className="text-sm text-muted-foreground">Average Mood</p>
              <p className="text-2xl font-bold">{avgMood.toFixed(1)}/10</p>
            </div>
          )}

          <div className="space-y-2">
            <p className="text-sm font-medium">How are you feeling today?</p>
            <div className="flex items-center gap-4">
              <span className="text-2xl">😰</span>
              <Slider value={moodScore} onValueChange={setMoodScore} max={10} min={1} step={1} className="flex-1" />
              <span className="text-2xl">😄</span>
            </div>
            <p className="text-center text-lg font-medium">{moodScore[0]}/10</p>
          </div>

          <Textarea
            placeholder="Any notes about your mood? (optional)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
          />

          <Button className="w-full" onClick={handleLogMood} disabled={loading}>
            {loading ? "Logging..." : "Log Mood"}
          </Button>
        </CardContent>
      </Card>
    </motion.div>
  )
}

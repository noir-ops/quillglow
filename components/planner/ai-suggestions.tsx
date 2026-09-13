"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { Sparkles, Loader2 } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "sonner"
import { createBrowserClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"

export function AISuggestions() {
  const [syllabusText, setSyllabusText] = useState("")
  const [loading, setLoading] = useState(false)
  const [suggestions, setSuggestions] = useState<any[]>([])
  const supabase = createBrowserClient()
  const router = useRouter()

  const handleAnalyze = async () => {
    if (!syllabusText.trim()) {
      toast.error("Please paste your syllabus text")
      return
    }

    setLoading(true)

    try {
      const response = await fetch("/api/ai/analyze-syllabus", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ syllabusText }),
      })

      if (!response.ok) throw new Error("Failed to analyze")

      const data = await response.json()
      setSuggestions(data.tasks)
      toast.success("AI analysis complete!")
    } catch (error) {
      toast.error("Failed to analyze syllabus")
    } finally {
      setLoading(false)
    }
  }

  const handleAddTask = async (task: any) => {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return

    const today = new Date().toISOString().split("T")[0]

    const { error } = await supabase.from("tasks").insert({
      user_id: user.id,
      title: task.title,
      description: task.description,
      due_date: today,
      priority: task.priority,
      subject: task.subject,
    })

    if (error) {
      toast.error("Failed to add task")
    } else {
      toast.success("Task added!")
      setSuggestions(suggestions.filter((s) => s !== task))
      router.refresh()
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.1 }}
    >
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            AI Task Suggestions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Textarea
              placeholder="Paste your syllabus or course outline here..."
              value={syllabusText}
              onChange={(e) => setSyllabusText(e.target.value)}
              rows={6}
              className="resize-none"
            />
            <Button className="w-full" onClick={handleAnalyze} disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Analyze with AI
                </>
              )}
            </Button>

            {suggestions.length > 0 && (
              <div className="space-y-3 mt-4">
                <p className="text-sm font-medium">Suggested Tasks:</p>
                {suggestions.map((task, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="p-3 rounded-lg border bg-card"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <p className="font-medium text-sm">{task.title}</p>
                        <p className="text-xs text-muted-foreground mt-1">{task.description}</p>
                      </div>
                      <Button size="sm" onClick={() => handleAddTask(task)}>
                        Add
                      </Button>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}

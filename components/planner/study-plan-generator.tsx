"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  Sparkles,
  Loader2,
  Calendar,
  Target,
  Clock,
  Save,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  ChevronDown,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "sonner"

export function StudyPlanGenerator() {
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [studyPlan, setStudyPlan] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const [formCollapsed, setFormCollapsed] = useState(false)
  const [formData, setFormData] = useState({
    subjects: "",
    examDate: "",
    hoursPerDay: "",
    goals: "",
  })

  const handleGenerate = async () => {
    if (!formData.subjects || !formData.examDate || !formData.hoursPerDay) {
      toast.error("Please fill in all required fields")
      return
    }

    setLoading(true)
    setError(null)
    setStudyPlan(null)

    try {
      const response = await fetch("/api/ai/generate-study-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || "Failed to generate plan")
      }

      const data = await response.json()
      setStudyPlan(data.plan)
      setFormCollapsed(true)
      toast.success("Study plan generated!")
    } catch (err: any) {
      setError(err.message || "Failed to generate study plan. Please try again.")
      toast.error("Failed to generate study plan")
    } finally {
      setLoading(false)
    }
  }

  const handleRegenerate = () => {
    setStudyPlan(null)
    setFormCollapsed(false)
    setError(null)
  }

  const handleSavePlan = async () => {
    if (!studyPlan) return

    setSaving(true)

    try {
      const goals = studyPlan.schedule.map((session: any, index: number) => ({
        title: session.topic,
        description: session.activities.join(", "),
        priority: index < 3 ? "high" : index < 6 ? "medium" : "low",
        dueDate: null,
        estimatedHours: Number.parseInt(session.duration.split(" ")[0]) || 2,
      }))

      const response = await fetch("/api/study-plans/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan: {
            title: studyPlan.title,
            subject: formData.subjects.split(",")[0].trim(),
            startDate: new Date().toISOString().split("T")[0],
            endDate: formData.examDate,
            duration: studyPlan.duration,
            goals: studyPlan.goals,
            tips: studyPlan.tips,
          },
          goals,
        }),
      })

      if (!response.ok) throw new Error("Failed to save plan")

      toast.success("Study plan saved successfully!")
      setStudyPlan(null)
      setFormCollapsed(false)
      setFormData({ subjects: "", examDate: "", hoursPerDay: "", goals: "" })
    } catch (error) {
      toast.error("Failed to save study plan")
    } finally {
      setSaving(false)
    }
  }

  const calculateDuration = () => {
    if (!formData.examDate) return ""

    const today = new Date()
    const examDate = new Date(formData.examDate)
    const diffTime = Math.abs(examDate.getTime() - today.getTime())
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    const weeks = Math.floor(diffDays / 7)

    const formatDate = (date: Date) => {
      return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    }

    return `${formatDate(today)} - ${formatDate(examDate)} (${weeks} weeks)`
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.2 }}
    >
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            AI Study Plan Generator
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <AnimatePresence>
              {(!formCollapsed || !studyPlan) && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="space-y-4"
                >
                  <div className="space-y-2">
                    <Label htmlFor="subjects">Subjects (comma-separated) *</Label>
                    <Input
                      id="subjects"
                      placeholder="e.g., Math, Physics, Chemistry"
                      value={formData.subjects}
                      onChange={(e) => setFormData({ ...formData, subjects: e.target.value })}
                      disabled={loading}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="examDate">Exam Date *</Label>
                      <Input
                        id="examDate"
                        type="date"
                        value={formData.examDate}
                        onChange={(e) => setFormData({ ...formData, examDate: e.target.value })}
                        disabled={loading}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="hoursPerDay">Hours/Day *</Label>
                      <Input
                        id="hoursPerDay"
                        type="number"
                        min="1"
                        max="12"
                        placeholder="e.g., 4"
                        value={formData.hoursPerDay}
                        onChange={(e) => setFormData({ ...formData, hoursPerDay: e.target.value })}
                        disabled={loading}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="goals">Goals (optional)</Label>
                    <Textarea
                      id="goals"
                      placeholder="e.g., Score 90%+ in finals, master calculus..."
                      value={formData.goals}
                      onChange={(e) => setFormData({ ...formData, goals: e.target.value })}
                      rows={3}
                      disabled={loading}
                    />
                  </div>

                  <Button className="w-full" onClick={handleGenerate} disabled={loading}>
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Generating Plan...
                      </>
                    ) : (
                      <>
                        <Sparkles className="mr-2 h-4 w-4" />
                        Generate Study Plan
                      </>
                    )}
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence>
              {loading && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="p-6 rounded-lg border-2 border-dashed border-primary/30 bg-primary/5"
                >
                  <div className="flex flex-col items-center justify-center gap-4">
                    <div className="relative">
                      <div className="w-16 h-16 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
                      <Sparkles className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-6 w-6 text-primary" />
                    </div>
                    <div className="text-center">
                      <p className="font-medium text-lg">Generating your personalized study plan...</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        Our AI is analyzing your subjects and creating an optimized schedule
                      </p>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence>
              {error && !loading && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="p-4 rounded-lg border border-destructive/50 bg-destructive/10"
                >
                  <div className="flex items-start gap-3">
                    <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="font-medium text-destructive">Failed to generate study plan</p>
                      <p className="text-sm text-muted-foreground mt-1">{error}</p>
                      <Button variant="outline" size="sm" className="mt-3 bg-transparent" onClick={handleGenerate}>
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Try Again
                      </Button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence>
              {studyPlan && !loading && (
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                  <div className="p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-full bg-emerald-500/20">
                        <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                      </div>
                      <div>
                        <p className="font-semibold text-emerald-700 dark:text-emerald-300">
                          Your Personalized Study Plan is Ready!
                        </p>
                        <p className="text-sm text-muted-foreground">Review and save it to your planner</p>
                      </div>
                    </div>
                  </div>

                  {formCollapsed && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full justify-between"
                      onClick={() => setFormCollapsed(false)}
                    >
                      <span className="text-muted-foreground">Show form inputs</span>
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                  )}

                  <div className="p-4 rounded-lg border bg-card">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                      <h3 className="font-semibold text-lg">{studyPlan.title}</h3>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={handleRegenerate}>
                          <RefreshCw className="mr-2 h-4 w-4" />
                          Adjust & Regenerate
                        </Button>
                        <Button onClick={handleSavePlan} disabled={saving} size="sm">
                          {saving ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Saving...
                            </>
                          ) : (
                            <>
                              <Save className="mr-2 h-4 w-4" />
                              Save Plan
                            </>
                          )}
                        </Button>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-4 w-4" />
                        {calculateDuration()}
                      </span>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <h4 className="font-medium mb-2 flex items-center gap-2">
                          <Target className="h-4 w-4" />
                          Goals
                        </h4>
                        <ul className="space-y-1 text-sm">
                          {studyPlan.goals.map((goal: string, i: number) => (
                            <li key={i} className="flex items-start gap-2">
                              <span className="text-primary">•</span>
                              <span>{goal}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div>
                        <h4 className="font-medium mb-3 flex items-center gap-2">
                          <Clock className="h-4 w-4" />
                          Weekly Schedule
                        </h4>
                        <div className="space-y-3">
                          {studyPlan.schedule.map((session: any, i: number) => (
                            <div key={i} className="p-3 rounded-lg bg-background border">
                              <div className="flex items-start justify-between mb-2">
                                <div>
                                  <p className="font-medium text-sm">
                                    {session.day} - {session.timeSlot}
                                  </p>
                                  <p className="text-xs text-muted-foreground">{session.duration}</p>
                                </div>
                                <span className="text-xs px-2 py-1 rounded-full bg-primary/10 text-primary">
                                  {session.subject}
                                </span>
                              </div>
                              <p className="text-sm font-medium mb-1">{session.topic}</p>
                              <ul className="text-xs text-muted-foreground space-y-1">
                                {session.activities.map((activity: string, j: number) => (
                                  <li key={j}>• {activity}</li>
                                ))}
                              </ul>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div>
                        <h4 className="font-medium mb-2">Study Tips</h4>
                        <ul className="space-y-1 text-sm text-muted-foreground">
                          {studyPlan.tips.map((tip: string, i: number) => (
                            <li key={i} className="flex items-start gap-2">
                              <span className="text-primary">💡</span>
                              <span>{tip}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}

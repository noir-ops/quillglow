"use client"

import { useEffect, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Calendar, Trash2, Plus, CheckCircle2, Circle } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"
import { format } from "date-fns"
import type { StudyPlan } from "@/lib/types/study"

type FilterType = "upcoming" | "past_due" | "completed"

export function SavedStudyPlans() {
  const [plans, setPlans] = useState<StudyPlan[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<FilterType>("upcoming")
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null)
  const [addingGoal, setAddingGoal] = useState(false)
  const [newGoal, setNewGoal] = useState({
    title: "",
    description: "",
    priority: "medium",
    dueDate: "",
    estimatedHours: "",
  })

  useEffect(() => {
    fetchPlans()
  }, [filter])

  const fetchPlans = async () => {
    try {
      const response = await fetch(`/api/study-plans/list?filter=${filter}`)
      if (!response.ok) throw new Error("Failed to fetch plans")
      const data = await response.json()
      setPlans(data.plans)
    } catch (error) {
      toast.error("Failed to load study plans")
    } finally {
      setLoading(false)
    }
  }

  const handleAddGoal = async (planId: string) => {
    if (!newGoal.title.trim()) {
      toast.error("Please enter a goal title")
      return
    }

    setAddingGoal(true)

    try {
      const response = await fetch("/api/study-plans/goals/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planId,
          title: newGoal.title,
          description: newGoal.description,
          priority: newGoal.priority,
          dueDate: newGoal.dueDate || null,
          estimatedHours: newGoal.estimatedHours ? Number.parseInt(newGoal.estimatedHours) : null,
        }),
      })

      if (!response.ok) throw new Error("Failed to add goal")

      toast.success("Goal added successfully!")
      setSelectedPlan(null)
      setNewGoal({ title: "", description: "", priority: "medium", dueDate: "", estimatedHours: "" })
      fetchPlans()
    } catch (error) {
      toast.error("Failed to add goal")
    } finally {
      setAddingGoal(false)
    }
  }

  const toggleGoal = async (goalId: string, completed: boolean) => {
    try {
      const response = await fetch("/api/study-plans/goals/toggle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goalId, completed }),
      })

      if (!response.ok) throw new Error("Failed to update goal")

      toast.success(completed ? "Goal completed!" : "Goal marked incomplete")
      fetchPlans()
    } catch (error) {
      toast.error("Failed to update goal")
    }
  }

  const deletePlan = async (planId: string) => {
    if (!confirm("Are you sure you want to delete this study plan?")) return

    try {
      const response = await fetch(`/api/study-plans/delete?planId=${planId}`, {
        method: "DELETE",
      })

      if (!response.ok) throw new Error("Failed to delete plan")

      toast.success("Study plan deleted")
      fetchPlans()
    } catch (error) {
      toast.error("Failed to delete study plan")
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high":
        return "bg-red-500/10 text-red-500 border-red-500/20"
      case "medium":
        return "bg-yellow-500/10 text-yellow-500 border-yellow-500/20"
      case "low":
        return "bg-green-500/10 text-green-500 border-green-500/20"
      default:
        return "bg-muted text-muted-foreground"
    }
  }

  return (
    <div className="space-y-6">
      {/* Filter Tabs */}
      <div className="flex gap-2 p-1 bg-muted rounded-lg">
        <button
          onClick={() => setFilter("upcoming")}
          className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            filter === "upcoming" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Upcoming
        </button>
        <button
          onClick={() => setFilter("past_due")}
          className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            filter === "past_due" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Past Due
        </button>
        <button
          onClick={() => setFilter("completed")}
          className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            filter === "completed"
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Completed
        </button>
      </div>

      {/* Study Plans List */}
      <AnimatePresence mode="wait">
        {loading ? (
          <div className="text-center py-12 text-muted-foreground">Loading plans...</div>
        ) : plans.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="text-center py-12 text-muted-foreground"
          >
            No study plans found
          </motion.div>
        ) : (
          <div className="space-y-4">
            {plans.map((plan) => (
              <motion.div
                key={plan.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                layout
              >
                <Card className="p-6">
                  {/* Plan Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-semibold text-foreground mb-1">{plan.title}</h3>
                      {plan.subject && (
                        <span className="text-xs px-2 py-1 rounded-full bg-primary/10 text-primary">
                          {plan.subject}
                        </span>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deletePlan(plan.id)}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>

                  {/* Date Range */}
                  <div className="flex items-center gap-2 text-sm text-foreground/70 mb-4">
                    <Calendar className="h-4 w-4" />
                    <span>
                      {format(new Date(plan.start_date), "MMM dd")} - {format(new Date(plan.end_date), "MMM dd, yyyy")}
                    </span>
                  </div>

                  {/* Progress */}
                  <div className="mb-6">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-foreground">Progress</span>
                      <span className="text-sm font-medium text-foreground">{plan.progress}%</span>
                    </div>
                    <Progress value={plan.progress} className="h-2" />
                  </div>

                  {/* Goals */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-medium text-foreground">Goals</h4>
                      <Dialog open={selectedPlan === plan.id} onOpenChange={(open) => !open && setSelectedPlan(null)}>
                        <DialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 text-xs"
                            onClick={() => setSelectedPlan(plan.id)}
                          >
                            <Plus className="h-3 w-3 mr-1" />
                            Add Goal
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-[500px]">
                          <DialogHeader>
                            <DialogTitle>Add New Goal</DialogTitle>
                          </DialogHeader>
                          <div className="space-y-4 py-4">
                            <div className="space-y-2">
                              <Label htmlFor="goal-title">Goal Title *</Label>
                              <Input
                                id="goal-title"
                                placeholder="e.g., Master Chapter 5"
                                value={newGoal.title}
                                onChange={(e) => setNewGoal({ ...newGoal, title: e.target.value })}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="goal-description">Description</Label>
                              <Textarea
                                id="goal-description"
                                placeholder="Add more details about this goal..."
                                value={newGoal.description}
                                onChange={(e) => setNewGoal({ ...newGoal, description: e.target.value })}
                                rows={3}
                              />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <Label htmlFor="goal-priority">Priority</Label>
                                <Select
                                  value={newGoal.priority}
                                  onValueChange={(value) => setNewGoal({ ...newGoal, priority: value })}
                                >
                                  <SelectTrigger id="goal-priority">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="low">Low</SelectItem>
                                    <SelectItem value="medium">Medium</SelectItem>
                                    <SelectItem value="high">High</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor="goal-hours">Est. Hours</Label>
                                <Input
                                  id="goal-hours"
                                  type="number"
                                  min="1"
                                  placeholder="e.g., 5"
                                  value={newGoal.estimatedHours}
                                  onChange={(e) => setNewGoal({ ...newGoal, estimatedHours: e.target.value })}
                                />
                              </div>
                            </div>
                          </div>
                          <div className="flex justify-end gap-3">
                            <Button variant="outline" onClick={() => setSelectedPlan(null)} disabled={addingGoal}>
                              Cancel
                            </Button>
                            <Button onClick={() => handleAddGoal(plan.id)} disabled={addingGoal}>
                              {addingGoal ? "Adding..." : "Add Goal"}
                            </Button>
                          </div>
                        </DialogContent>
                      </Dialog>
                    </div>

                    <div className="space-y-3">
                      {plan.goals?.map((goal) => (
                        <motion.div
                          key={goal.id}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors group"
                        >
                          <button
                            onClick={() => toggleGoal(goal.id, !goal.completed)}
                            className="mt-0.5 text-muted-foreground hover:text-primary transition-colors"
                          >
                            {goal.completed ? (
                              <CheckCircle2 className="h-5 w-5 text-primary" />
                            ) : (
                              <Circle className="h-5 w-5" />
                            )}
                          </button>

                          <div className="flex-1 min-w-0">
                            <p
                              className={`font-medium text-sm mb-1 ${
                                goal.completed ? "line-through text-foreground/60" : "text-foreground"
                              }`}
                            >
                              {goal.title}
                            </p>
                            {goal.description && <p className="text-xs text-foreground/70 mb-2">{goal.description}</p>}
                            <div className="flex items-center gap-3 text-xs text-foreground/70">
                              <span className={`px-2 py-0.5 rounded-full border ${getPriorityColor(goal.priority)}`}>
                                {goal.priority}
                              </span>
                              {goal.due_date && (
                                <span className="flex items-center gap-1">
                                  <Calendar className="h-3 w-3" />
                                  {format(new Date(goal.due_date), "MMM dd")}
                                </span>
                              )}
                              {goal.estimated_hours && <span>{goal.estimated_hours} hrs</span>}
                            </div>
                          </div>

                          <Button
                            variant="ghost"
                            size="icon"
                            className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}

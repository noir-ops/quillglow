"use client"

import type React from "react"

import { useState } from "react"
import { motion } from "framer-motion"
import { Plus, Loader2 } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { createBrowserClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { useStudyStore } from "@/lib/store/study-store"
import type { Task } from "@/lib/types/study"

export function QuickActions() {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createBrowserClient()
  const { addOptimisticTask, removeOptimisticTask, confirmOptimisticTask } = useStudyStore()

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)

    const formData = new FormData(e.currentTarget)
    const title = formData.get("title") as string
    const description = formData.get("description") as string
    const dueDate = formData.get("dueDate") as string
    const priority = (formData.get("priority") as string) || "medium"
    const subject = formData.get("subject") as string

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      toast.error("Please sign in to add tasks")
      setLoading(false)
      return
    }

    const tempId = `temp-${Date.now()}`
    const optimisticTask: Task & { isOptimistic?: boolean } = {
      id: tempId,
      user_id: user.id,
      title,
      description: description || null,
      due_date: dueDate ? new Date(dueDate).toISOString() : null,
      priority,
      subject: subject || null,
      completed: false,
      completed_at: null,
      created_at: new Date().toISOString(),
      isOptimistic: true,
    }

    addOptimisticTask(optimisticTask)
    toast.success("Task added!")
    setOpen(false)
    setLoading(false)

    const { data, error } = await supabase
      .from("tasks")
      .insert({
        user_id: user.id,
        title,
        description,
        due_date: dueDate ? new Date(dueDate).toISOString() : null,
        priority,
        subject,
      })
      .select("id")
      .single()

    if (error) {
      removeOptimisticTask(tempId)
      toast.error("Couldn't save task. Please try again.")
    } else {
      confirmOptimisticTask(tempId, data.id)
      await fetch("/api/usage/track-task", { method: "POST" })
      router.refresh()
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.1 }}
    >
      <Card className="h-full hover:shadow-lg transition-shadow">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5 text-primary" />
            Quick Add Task
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="w-full" size="lg">
                <Plus className="mr-2 h-4 w-4" />
                Add New Task
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>Create New Task</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Task Name *</Label>
                  <Input id="title" name="title" placeholder="e.g., Study Chapter 5" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea id="description" name="description" placeholder="Add details about this task..." rows={3} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="dueDate">Due Date</Label>
                    <Input id="dueDate" name="dueDate" type="date" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="priority">Priority</Label>
                    <Select name="priority" defaultValue="medium">
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="subject">Subject</Label>
                  <Input id="subject" name="subject" placeholder="e.g., Mathematics" />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Adding...
                    </>
                  ) : (
                    "Add Task"
                  )}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
          <p className="text-sm text-muted-foreground mt-4 text-center">
            Quickly capture tasks and organize your study schedule
          </p>
        </CardContent>
      </Card>
    </motion.div>
  )
}

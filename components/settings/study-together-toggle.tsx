"use client"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Users } from "lucide-react"
import { toast } from "sonner"

export function StudyTogetherToggle() {
  const [enabled, setEnabled] = useState(true)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [loadFailed, setLoadFailed] = useState(false)

  useEffect(() => {
    fetchPreference()
  }, [])

  const fetchPreference = async () => {
    try {
      const response = await fetch("/api/preferences/study-together")
      if (!response.ok) throw new Error("Could not load preference")
      const data = await response.json()
      setEnabled(data.enabled ?? true)
    } catch (error) {
      setLoadFailed(true)
      toast.error("Could not load Study Together settings. Please reload to try again.")
    } finally {
      setIsLoading(false)
    }
  }

  const handleToggle = async (checked: boolean) => {
    if (isSaving) return
    setIsSaving(true)
    setEnabled(checked)
    try {
      const response = await fetch("/api/preferences/study-together", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: checked }),
      })

      if (!response.ok) {
        throw new Error("Failed to update preference")
      }

      window.dispatchEvent(new CustomEvent("study-together-preference", { detail: checked }))
      toast.success("Study Together preference saved")
    } catch (error) {
      console.error("[v0] Error updating preference:", error)
      // Revert on error — and say so, rather than silently flipping back.
      setEnabled(!checked)
      toast.error("Couldn't update Study Together. Please try again.")
    } finally { setIsSaving(false) }
  }

  if (isLoading) {
    return (
      <Card className="p-4 animate-pulse">
        <div className="h-20 bg-muted rounded" />
      </Card>
    )
  }

  return (
    <Card className="p-4 sm:p-6 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/20">
            <Users className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="space-y-1">
            <h3 className="font-semibold text-foreground">Study Together</h3>
            <p className="text-sm text-muted-foreground">
              {enabled
                ? "Show Study Together under Resources for community channels and private rooms"
                : "Feature disabled. Enable to join study communities"}
            </p>
          </div>
        </div>
        <Switch aria-label="Show Study Together under Resources" disabled={isSaving || loadFailed} checked={enabled} onCheckedChange={handleToggle} className="flex-shrink-0" />
      </div>
    </Card>
  )
}

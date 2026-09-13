"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { ArrowLeft, Sparkles, BookOpen, Target, GraduationCap, Trash2, Loader2, Check, Brain } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface TutorProfile {
  id: string
  user_id: string
  learning_style: string
  difficulty: string
  goal: string
  subjects: string[]
  exams: string[]
  ask_followups: boolean
  keep_short: boolean
  onboarding_completed: boolean
}

interface TutorSettingsProps {
  profile: TutorProfile
  onSave: (profile: Partial<TutorProfile>) => Promise<void>
  onCancel: () => void
}

const learningStyles = [
  { id: "simple_short", title: "Simple & Short", icon: "⚡" },
  { id: "step_by_step", title: "Step-by-Step", icon: "📝" },
  { id: "examples_first", title: "Examples First", icon: "💡" },
  { id: "conceptual", title: "Conceptual", icon: "🧠" },
]

const difficulties = [
  { id: "gentle", title: "Gentle", color: "bg-green-500" },
  { id: "standard", title: "Standard", color: "bg-blue-500" },
  { id: "challenging", title: "Challenging", color: "bg-purple-500" },
]

const goals = [
  { id: "understand", title: "Understand", icon: BookOpen },
  { id: "practice", title: "Practice", icon: Target },
  { id: "exam_prep", title: "Exam Prep", icon: GraduationCap },
  { id: "revision", title: "Revision", icon: Sparkles },
]

export function TutorSettings({ profile, onSave, onCancel }: TutorSettingsProps) {
  const [editedProfile, setEditedProfile] = useState(profile)
  const [isSaving, setIsSaving] = useState(false)
  const [isResetting, setIsResetting] = useState(false)
  const [customSubject, setCustomSubject] = useState("")
  const { toast } = useToast()

  const handleSave = async () => {
    setIsSaving(true)
    try {
      await onSave(editedProfile)
      toast({ title: "Settings saved", description: "Your tutor preferences have been updated." })
    } catch {
      toast({ title: "Error", description: "Failed to save settings.", variant: "destructive" })
    } finally {
      setIsSaving(false)
    }
  }

  const handleResetMemory = async () => {
    setIsResetting(true)
    try {
      const response = await fetch("/api/tutor/memory", { method: "DELETE" })
      if (response.ok) {
        toast({ title: "Memory reset", description: "Your tutor memory has been cleared." })
      }
    } catch {
      toast({ title: "Error", description: "Failed to reset memory.", variant: "destructive" })
    } finally {
      setIsResetting(false)
    }
  }

  const toggleSubject = (subject: string) => {
    setEditedProfile((prev) => ({
      ...prev,
      subjects: prev.subjects.includes(subject)
        ? prev.subjects.filter((s) => s !== subject)
        : [...prev.subjects, subject],
    }))
  }

  const addCustomSubject = () => {
    if (customSubject.trim() && !editedProfile.subjects.includes(customSubject.trim())) {
      setEditedProfile((prev) => ({ ...prev, subjects: [...prev.subjects, customSubject.trim()] }))
      setCustomSubject("")
    }
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="icon" onClick={onCancel}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Tutor Settings</h1>
            <p className="text-muted-foreground">Customize how your personal tutor works</p>
          </div>
        </div>

        <div className="space-y-6">
          {/* Learning Style */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Learning Style</CardTitle>
              <CardDescription>How do you prefer explanations?</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-2">
                {learningStyles.map((style) => (
                  <button
                    key={style.id}
                    onClick={() => setEditedProfile((prev) => ({ ...prev, learning_style: style.id }))}
                    className={`flex items-center gap-2 p-3 rounded-lg border-2 transition-all ${
                      editedProfile.learning_style === style.id
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/50"
                    }`}
                  >
                    <span className="text-lg">{style.icon}</span>
                    <span className="text-sm font-medium">{style.title}</span>
                    {editedProfile.learning_style === style.id && <Check className="h-4 w-4 text-primary ml-auto" />}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Difficulty */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Difficulty Level</CardTitle>
              <CardDescription>Adjust the complexity of explanations</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                {difficulties.map((diff) => (
                  <button
                    key={diff.id}
                    onClick={() => setEditedProfile((prev) => ({ ...prev, difficulty: diff.id }))}
                    className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-lg border-2 transition-all ${
                      editedProfile.difficulty === diff.id
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/50"
                    }`}
                  >
                    <div className={`h-2 w-2 rounded-full ${diff.color}`} />
                    <span className="text-sm font-medium">{diff.title}</span>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Goal */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Learning Goal</CardTitle>
              <CardDescription>What are you focusing on?</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-2">
                {goals.map((g) => (
                  <button
                    key={g.id}
                    onClick={() => setEditedProfile((prev) => ({ ...prev, goal: g.id }))}
                    className={`flex items-center gap-2 p-3 rounded-lg border-2 transition-all ${
                      editedProfile.goal === g.id
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/50"
                    }`}
                  >
                    <g.icon className="h-4 w-4 text-primary" />
                    <span className="text-sm font-medium">{g.title}</span>
                    {editedProfile.goal === g.id && <Check className="h-4 w-4 text-primary ml-auto" />}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Subjects */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Subjects</CardTitle>
              <CardDescription>Topics you&apos;re studying</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {editedProfile.subjects.map((subject) => (
                  <Badge
                    key={subject}
                    variant="default"
                    className="cursor-pointer hover:bg-destructive hover:text-destructive-foreground"
                    onClick={() => toggleSubject(subject)}
                  >
                    {subject} ×
                  </Badge>
                ))}
                {editedProfile.subjects.length === 0 && (
                  <p className="text-sm text-muted-foreground">No subjects selected</p>
                )}
              </div>
              <div className="flex gap-2">
                <Input
                  placeholder="Add a subject..."
                  value={customSubject}
                  onChange={(e) => setCustomSubject(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addCustomSubject()}
                />
                <Button variant="outline" onClick={addCustomSubject}>
                  Add
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Behavior Toggles */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Behavior</CardTitle>
              <CardDescription>Fine-tune how your tutor responds</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="followups">Ask follow-up questions</Label>
                  <p className="text-xs text-muted-foreground">Tutor will check your understanding</p>
                </div>
                <Switch
                  id="followups"
                  checked={editedProfile.ask_followups}
                  onCheckedChange={(checked) => setEditedProfile((prev) => ({ ...prev, ask_followups: checked }))}
                />
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="short">Keep answers short</Label>
                  <p className="text-xs text-muted-foreground">More concise responses</p>
                </div>
                <Switch
                  id="short"
                  checked={editedProfile.keep_short}
                  onCheckedChange={(checked) => setEditedProfile((prev) => ({ ...prev, keep_short: checked }))}
                />
              </div>
            </CardContent>
          </Card>

          {/* Reset Memory */}
          <Card className="border-destructive/20">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Brain className="h-5 w-5" />
                Tutor Memory
              </CardTitle>
              <CardDescription>
                Your tutor remembers topics you&apos;ve discussed to personalize responses
              </CardDescription>
            </CardHeader>
            <CardContent>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" className="text-destructive hover:text-destructive bg-transparent">
                    <Trash2 className="h-4 w-4 mr-2" />
                    Reset Memory
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Reset Tutor Memory?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will clear all remembered topics and confidence levels. Your tutor will start fresh without
                      knowledge of your strengths and weak areas.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleResetMemory}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      {isResetting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Reset"}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </CardContent>
          </Card>

          {/* Save Button */}
          <div className="flex gap-3 pt-4">
            <Button variant="outline" onClick={onCancel} className="flex-1 bg-transparent">
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isSaving} className="flex-1">
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

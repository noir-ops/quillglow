"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ChevronRight, ChevronLeft, Sparkles, BookOpen, Target, GraduationCap, Check } from "lucide-react"

interface TutorOnboardingProps {
  onComplete: (profile: TutorProfileData) => void
}

interface TutorProfileData {
  learning_style: string
  difficulty: string
  goal: string
  subjects: string[]
  exams: string[]
  ask_followups: boolean
  keep_short: boolean
  onboarding_completed: boolean
}

const learningStyles = [
  {
    id: "simple_short",
    title: "Simple & Short",
    description: "Brief explanations with simple language",
    icon: "⚡",
  },
  {
    id: "step_by_step",
    title: "Step-by-Step",
    description: "Clear, numbered steps through each concept",
    icon: "📝",
  },
  {
    id: "examples_first",
    title: "Examples First",
    description: "Start with examples, then explain theory",
    icon: "💡",
  },
  {
    id: "conceptual",
    title: "Conceptual",
    description: "Deep focus on theory and understanding 'why'",
    icon: "🧠",
  },
]

const difficulties = [
  {
    id: "gentle",
    title: "Gentle",
    description: "Beginner-friendly, patient explanations",
    color:
      "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800",
  },
  {
    id: "standard",
    title: "Standard",
    description: "Balanced depth and accessibility",
    color: "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800",
  },
  {
    id: "challenging",
    title: "Challenging",
    description: "Exam-level depth and critical thinking",
    color:
      "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800",
  },
]

const goals = [
  { id: "understand", title: "Understand Concepts", description: "Build genuine comprehension", icon: BookOpen },
  { id: "practice", title: "Practice Questions", description: "Focus on application", icon: Target },
  { id: "exam_prep", title: "Exam Preparation", description: "Exam tips and patterns", icon: GraduationCap },
  { id: "revision", title: "Quick Revision", description: "Concise summaries", icon: Sparkles },
]

const commonSubjects = [
  "Mathematics",
  "Physics",
  "Chemistry",
  "Biology",
  "Computer Science",
  "English",
  "History",
  "Economics",
  "Psychology",
  "Business",
]

const commonExams = [
  "AP Exams",
  "A-Levels",
  "IB",
  "SAT",
  "ACT",
  "GRE",
  "GMAT",
  "College Finals",
  "High School",
  "Other",
]

export function TutorOnboarding({ onComplete }: TutorOnboardingProps) {
  const [step, setStep] = useState(1)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [profile, setProfile] = useState<TutorProfileData>({
    learning_style: "step_by_step",
    difficulty: "standard",
    goal: "understand",
    subjects: [],
    exams: [],
    ask_followups: true,
    keep_short: false,
    onboarding_completed: true,
  })

  const [customSubject, setCustomSubject] = useState("")
  const [customExam, setCustomExam] = useState("")

  const totalSteps = 4

  const toggleSubject = (subject: string) => {
    setProfile((prev) => ({
      ...prev,
      subjects: prev.subjects.includes(subject)
        ? prev.subjects.filter((s) => s !== subject)
        : [...prev.subjects, subject],
    }))
  }

  const addCustomSubject = () => {
    if (customSubject.trim() && !profile.subjects.includes(customSubject.trim())) {
      setProfile((prev) => ({ ...prev, subjects: [...prev.subjects, customSubject.trim()] }))
      setCustomSubject("")
    }
  }

  const toggleExam = (exam: string) => {
    setProfile((prev) => ({
      ...prev,
      exams: prev.exams.includes(exam) ? prev.exams.filter((e) => e !== exam) : [...prev.exams, exam],
    }))
  }

  const addCustomExam = () => {
    if (customExam.trim() && !profile.exams.includes(customExam.trim())) {
      setProfile((prev) => ({ ...prev, exams: [...prev.exams, customExam.trim()] }))
      setCustomExam("")
    }
  }

  const handleComplete = async () => {
    setIsSubmitting(true)
    try {
      await onComplete(profile)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30 flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl shadow-xl border-border/50">
        <CardHeader className="text-center pb-2">
          <div className="flex justify-center mb-4">
            <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-lg">
              <Sparkles className="h-8 w-8 text-primary-foreground" />
            </div>
          </div>
          <CardTitle className="text-2xl sm:text-3xl font-bold">Set Up Your Personal Tutor</CardTitle>
          <CardDescription className="text-base mt-2">
            Help us understand how you learn best. This takes about 1 minute.
          </CardDescription>

          {/* Progress Bar */}
          <div className="flex items-center gap-2 mt-6 px-4">
            {[1, 2, 3, 4].map((s) => (
              <div key={s} className="flex-1 flex items-center">
                <div
                  className={`h-2 w-full rounded-full transition-all duration-300 ${
                    s <= step ? "bg-primary" : "bg-muted"
                  }`}
                />
              </div>
            ))}
          </div>
          <p className="text-sm text-muted-foreground mt-2">
            Step {step} of {totalSteps}
          </p>
        </CardHeader>

        <CardContent className="pt-6 pb-8">
          {/* Step 1: Learning Style */}
          {step === 1 && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-center mb-6">How do you prefer explanations?</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {learningStyles.map((style) => (
                  <button
                    key={style.id}
                    onClick={() => setProfile((prev) => ({ ...prev, learning_style: style.id }))}
                    className={`relative p-4 rounded-xl border-2 text-left transition-all duration-200 hover:scale-[1.02] ${
                      profile.learning_style === style.id
                        ? "border-primary bg-primary/5 shadow-md"
                        : "border-border hover:border-primary/50 hover:bg-muted/50"
                    }`}
                  >
                    {profile.learning_style === style.id && (
                      <div className="absolute top-2 right-2">
                        <Check className="h-5 w-5 text-primary" />
                      </div>
                    )}
                    <div className="text-2xl mb-2">{style.icon}</div>
                    <h4 className="font-semibold text-foreground">{style.title}</h4>
                    <p className="text-sm text-muted-foreground mt-1">{style.description}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 2: Difficulty */}
          {step === 2 && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-center mb-6">What difficulty level suits you?</h3>
              <div className="grid grid-cols-1 gap-3">
                {difficulties.map((diff) => (
                  <button
                    key={diff.id}
                    onClick={() => setProfile((prev) => ({ ...prev, difficulty: diff.id }))}
                    className={`relative p-4 rounded-xl border-2 text-left transition-all duration-200 hover:scale-[1.01] ${
                      profile.difficulty === diff.id
                        ? `${diff.color} border-current shadow-md`
                        : "border-border hover:border-primary/50 hover:bg-muted/50"
                    }`}
                  >
                    {profile.difficulty === diff.id && (
                      <div className="absolute top-3 right-3">
                        <Check className="h-5 w-5" />
                      </div>
                    )}
                    <h4 className="font-semibold text-lg">{diff.title}</h4>
                    <p className="text-sm opacity-80 mt-1">{diff.description}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 3: Goal */}
          {step === 3 && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-center mb-6">What is your learning goal?</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {goals.map((g) => (
                  <button
                    key={g.id}
                    onClick={() => setProfile((prev) => ({ ...prev, goal: g.id }))}
                    className={`relative p-4 rounded-xl border-2 text-left transition-all duration-200 hover:scale-[1.02] ${
                      profile.goal === g.id
                        ? "border-primary bg-primary/5 shadow-md"
                        : "border-border hover:border-primary/50 hover:bg-muted/50"
                    }`}
                  >
                    {profile.goal === g.id && (
                      <div className="absolute top-2 right-2">
                        <Check className="h-5 w-5 text-primary" />
                      </div>
                    )}
                    <g.icon className="h-6 w-6 text-primary mb-2" />
                    <h4 className="font-semibold text-foreground">{g.title}</h4>
                    <p className="text-sm text-muted-foreground mt-1">{g.description}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 4: Subjects & Exams (Optional) */}
          {step === 4 && (
            <div className="space-y-6">
              <h3 className="text-lg font-semibold text-center mb-2">What do you study? (Optional)</h3>
              <p className="text-sm text-muted-foreground text-center mb-6">
                This helps personalize your experience. You can skip or add later.
              </p>

              {/* Subjects */}
              <div>
                <Label className="text-sm font-medium mb-3 block">Subjects</Label>
                <div className="flex flex-wrap gap-2 mb-3">
                  {commonSubjects.map((subject) => (
                    <Badge
                      key={subject}
                      variant={profile.subjects.includes(subject) ? "default" : "outline"}
                      className={`cursor-pointer transition-all hover:scale-105 ${
                        profile.subjects.includes(subject) ? "" : "hover:bg-muted"
                      }`}
                      onClick={() => toggleSubject(subject)}
                    >
                      {subject}
                    </Badge>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input
                    placeholder="Add custom subject..."
                    value={customSubject}
                    onChange={(e) => setCustomSubject(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addCustomSubject()}
                    className="flex-1"
                  />
                  <Button variant="outline" size="sm" onClick={addCustomSubject}>
                    Add
                  </Button>
                </div>
              </div>

              {/* Exams */}
              <div>
                <Label className="text-sm font-medium mb-3 block">Exams you&apos;re preparing for</Label>
                <div className="flex flex-wrap gap-2 mb-3">
                  {commonExams.map((exam) => (
                    <Badge
                      key={exam}
                      variant={profile.exams.includes(exam) ? "default" : "outline"}
                      className={`cursor-pointer transition-all hover:scale-105 ${
                        profile.exams.includes(exam) ? "" : "hover:bg-muted"
                      }`}
                      onClick={() => toggleExam(exam)}
                    >
                      {exam}
                    </Badge>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input
                    placeholder="Add custom exam..."
                    value={customExam}
                    onChange={(e) => setCustomExam(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addCustomExam()}
                    className="flex-1"
                  />
                  <Button variant="outline" size="sm" onClick={addCustomExam}>
                    Add
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="flex justify-between mt-8 pt-4 border-t">
            <Button variant="ghost" onClick={() => setStep((s) => s - 1)} disabled={step === 1} className="gap-1">
              <ChevronLeft className="h-4 w-4" />
              Back
            </Button>

            {step < totalSteps ? (
              <Button onClick={() => setStep((s) => s + 1)} className="gap-1">
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button onClick={handleComplete} disabled={isSubmitting} className="gap-2">
                {isSubmitting ? (
                  <>
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    Setting up...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    Start Learning
                  </>
                )}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

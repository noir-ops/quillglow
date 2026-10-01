"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, ArrowRight, CheckCircle2, Sparkles } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import confetti from "canvas-confetti"

interface Question {
  question: string
  options: string[]
  correctAnswer: number
  explanation: string
}

interface QuestPlayerProps {
  quest: {
    id: string
    title: string
    description: string
    subject: string
    difficulty: string
    xp_reward: number
    questions: Question[]
  }
}

export function QuestPlayer({ quest }: QuestPlayerProps) {
  const [currentQuestion, setCurrentQuestion] = useState(0)
  const [selectedAnswers, setSelectedAnswers] = useState<number[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [results, setResults] = useState<any>(null)
  const router = useRouter()

  const progress = ((currentQuestion + 1) / quest.questions.length) * 100

  const handleSelectAnswer = (answerIndex: number) => {
    const newAnswers = [...selectedAnswers]
    newAnswers[currentQuestion] = answerIndex
    setSelectedAnswers(newAnswers)
  }

  const handleNext = () => {
    if (currentQuestion < quest.questions.length - 1) {
      setCurrentQuestion(currentQuestion + 1)
    }
  }

  const handlePrevious = () => {
    if (currentQuestion > 0) {
      setCurrentQuestion(currentQuestion - 1)
    }
  }

  const handleSubmit = async () => {
    setIsSubmitting(true)
    try {
      const response = await fetch("/api/quests/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questId: quest.id,
          answers: selectedAnswers,
        }),
      })

      const data = await response.json()
      setResults(data)

      // Trigger confetti if score is good
      if (data.score >= 70) {
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 },
        })
      }
    } catch (error) {
      console.error("[v0] Error submitting quest:", error)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (results) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
        >
          <Card className="border-2 bg-white/90 backdrop-blur">
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-green-400 to-emerald-500">
                <CheckCircle2 className="h-10 w-10 text-white" />
              </div>
              <CardTitle className="text-3xl">Quest Complete!</CardTitle>
              <CardDescription>Great job on completing this quest</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="rounded-lg bg-gradient-to-br from-blue-50 to-cyan-50 p-4 text-center">
                  <p className="text-sm text-muted-foreground">Score</p>
                  <p className="text-3xl font-bold text-blue-600">{results.score}%</p>
                </div>
                <div className="rounded-lg bg-gradient-to-br from-green-50 to-emerald-50 p-4 text-center">
                  <p className="text-sm text-muted-foreground">Correct</p>
                  <p className="text-3xl font-bold text-green-600">
                    {results.correctCount}/{results.totalQuestions}
                  </p>
                </div>
                <div className="rounded-lg bg-gradient-to-br from-yellow-50 to-orange-50 p-4 text-center">
                  <p className="text-sm text-muted-foreground">XP Earned</p>
                  <p className="text-3xl font-bold text-orange-600">+{results.xpEarned}</p>
                </div>
              </div>

              <div className="flex gap-3">
                <Link href="/dashboard" className="flex-1">
                  <Button variant="outline" className="w-full bg-transparent">
                    Back to Dashboard
                  </Button>
                </Link>
                <Button onClick={() => router.push("/dashboard")} className="flex-1">
                  <Sparkles className="mr-2 h-4 w-4" />
                  Find More Quests
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    )
  }

  const question = quest.questions[currentQuestion]

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <Link href="/dashboard">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
        </Link>
        <Badge>{quest.subject}</Badge>
      </div>

      <Card className="border-2 bg-white/90 backdrop-blur">
        <CardHeader>
          <div className="mb-4 flex items-center justify-between">
            <CardTitle className="text-2xl">{quest.title}</CardTitle>
            <span className="text-sm text-muted-foreground">
              Question {currentQuestion + 1} of {quest.questions.length}
            </span>
          </div>
          <Progress value={progress} className="h-2" />
        </CardHeader>
        <CardContent className="space-y-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentQuestion}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
              className="space-y-6"
            >
              <div>
                <h3 className="text-xl font-semibold leading-relaxed">{question.question}</h3>
              </div>

              <div className="space-y-3">
                {question.options.map((option, index) => (
                  <motion.button
                    key={index}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handleSelectAnswer(index)}
                    className={`w-full rounded-lg border-2 p-4 text-left transition-all ${
                      selectedAnswers[currentQuestion] === index
                        ? "border-primary bg-primary/10"
                        : "border-border bg-white hover:border-primary/50"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`flex h-8 w-8 items-center justify-center rounded-full border-2 ${
                          selectedAnswers[currentQuestion] === index
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border"
                        }`}
                      >
                        {String.fromCharCode(65 + index)}
                      </div>
                      <span className="flex-1">{option}</span>
                    </div>
                  </motion.button>
                ))}
              </div>
            </motion.div>
          </AnimatePresence>

          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={handlePrevious}
              disabled={currentQuestion === 0}
              className="flex-1 bg-transparent"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Previous
            </Button>
            {currentQuestion === quest.questions.length - 1 ? (
              <Button
                onClick={handleSubmit}
                disabled={selectedAnswers.length !== quest.questions.length || isSubmitting}
                className="flex-1"
              >
                {isSubmitting ? "Submitting..." : "Submit Quest"}
              </Button>
            ) : (
              <Button onClick={handleNext} disabled={selectedAnswers[currentQuestion] === undefined} className="flex-1">
                Next
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

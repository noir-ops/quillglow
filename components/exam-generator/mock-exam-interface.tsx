"use client"

import { useState, useEffect, useCallback } from "react"
import { ChatMarkdown } from "@/components/chat/chat-markdown"
import { motion, AnimatePresence } from "framer-motion"
import { Clock, CheckCircle, XCircle, ChevronLeft, ChevronRight, AlertCircle, Trophy, Home } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import Link from "next/link"

interface MockExamQuestion {
  id: number
  question: string
  options: string[]
  difficulty?: string
}

interface MockExamInterfaceProps {
  attemptId: string
  questions: MockExamQuestion[]
  totalQuestions: number
  timeLimit?: number
  onExit: () => void
  /** When retaking, we pass the full original questions (with correctAnswer + explanation) */
  originalQuestions?: Array<{
    question: string
    options: string[]
    correctAnswer: string
    explanation: string
    difficulty?: string
  }>
}

interface GradedAnswer {
  questionIndex: number
  userAnswer: string
  correctAnswer: string
  isCorrect: boolean
  explanation: string
}

interface ExamResults {
  correctAnswers: number
  totalQuestions: number
  scorePercentage: number
  gradedAnswers: GradedAnswer[]
  timeTaken: number
}

export function MockExamInterface({ attemptId, questions, totalQuestions, timeLimit, onExit, originalQuestions }: MockExamInterfaceProps) {
  const isRetake = attemptId.startsWith("retake-")
  const [currentQuestion, setCurrentQuestion] = useState(0)
  const [answers, setAnswers] = useState<string[]>(Array(totalQuestions).fill(""))
  const [timeRemaining, setTimeRemaining] = useState(timeLimit ? timeLimit * 60 : null)
  const [examStartTime] = useState(Date.now())
  const [submitting, setSubmitting] = useState(false)
  const [results, setResults] = useState<ExamResults | null>(null)
  const [showReview, setShowReview] = useState(false)

  // Timer countdown
  useEffect(() => {
    if (timeRemaining === null || results) return

    const timer = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev === null) return null
        if (prev <= 1) {
          handleSubmit(true)
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [timeRemaining, results])

  const handleAnswerSelect = (answer: string) => {
    const newAnswers = [...answers]
    newAnswers[currentQuestion] = answer
    setAnswers(newAnswers)
  }

  const handleNext = () => {
    if (currentQuestion < totalQuestions - 1) {
      setCurrentQuestion(currentQuestion + 1)
    }
  }

  const handlePrevious = () => {
    if (currentQuestion > 0) {
      setCurrentQuestion(currentQuestion - 1)
    }
  }

  const handleSubmit = useCallback(
    async (autoSubmit = false) => {
      const unanswered = answers.filter((a) => !a).length
      if (unanswered > 0 && !autoSubmit) {
        if (!confirm(`You have ${unanswered} unanswered questions. Submit anyway?`)) {
          return
        }
      }

      setSubmitting(true)
      const timeTaken = Math.floor((Date.now() - examStartTime) / 1000)

      try {
        if (isRetake && originalQuestions) {
          // For retakes, grade locally and save as a new attempt via POST-grade
          let correctCount = 0
          const gradedAnswers = answers.map((userAnswer, idx) => {
            const question = originalQuestions[idx]
            const isCorrect = userAnswer === question.correctAnswer
            if (isCorrect) correctCount++
            return {
              questionIndex: idx,
              userAnswer,
              correctAnswer: question.correctAnswer,
              isCorrect,
              explanation: question.explanation,
            }
          })
          const scorePercentage = (correctCount / totalQuestions) * 100

          // Save as new attempt
          const response = await fetch("/api/mock-exam", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              retake: true,
              questions: originalQuestions,
              totalQuestions,
              difficulty: originalQuestions[0]?.difficulty || "mixed",
              timeLimit: timeLimit || null,
              userAnswers: answers,
              correctAnswers: correctCount,
              scorePercentage,
              timeTaken,
            }),
          })

          if (response.ok) {
            // Saved successfully
          }

          setResults({
            correctAnswers: correctCount,
            totalQuestions,
            scorePercentage: Number.parseFloat(scorePercentage.toFixed(2)),
            gradedAnswers,
            timeTaken,
          })
        } else {
          // Normal submit via PUT
          const response = await fetch("/api/mock-exam", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              attemptId,
              userAnswers: answers,
              timeTaken,
            }),
          })

          if (!response.ok) {
            throw new Error("Failed to submit exam")
          }

          const data = await response.json()
          setResults(data)
        }

        if (!autoSubmit) {
          toast.success("Exam submitted successfully!")
        } else {
          toast.info("Time's up! Exam auto-submitted.")
        }
      } catch (error) {
        toast.error("Failed to submit exam. Please try again.")
        console.error(error)
      } finally {
        setSubmitting(false)
      }
    },
    [answers, examStartTime, attemptId, isRetake, originalQuestions, totalQuestions, timeLimit],
  )

  const formatTime = (seconds: number | null) => {
    if (seconds === null) return "No Limit"
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, "0")}`
  }

  const answeredCount = answers.filter((a) => a).length
  const progress = (answeredCount / totalQuestions) * 100

  // Results view
  if (results) {
    const performanceLabel =
      results.scorePercentage >= 90
        ? "Excellent"
        : results.scorePercentage >= 70
          ? "Good"
          : results.scorePercentage >= 50
            ? "Fair"
            : "Needs Review"

    const performanceColor =
      results.scorePercentage >= 90
        ? "text-green-600 dark:text-green-400"
        : results.scorePercentage >= 70
          ? "text-blue-600 dark:text-blue-400"
          : results.scorePercentage >= 50
            ? "text-orange-600 dark:text-orange-400"
            : "text-red-600 dark:text-red-400"

    if (showReview) {
      return (
        <div className="space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Detailed Review</CardTitle>
              <Button variant="outline" size="sm" onClick={() => setShowReview(false)}>
                Back to Summary
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {results.gradedAnswers.map((answer, idx) => (
                <Card
                  key={idx}
                  className={`border-l-4 ${answer.isCorrect ? "border-l-green-500" : "border-l-red-500"}`}
                >
                  <CardContent className="pt-4">
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <p className="font-medium text-sm">
                        Question {idx + 1} of {totalQuestions}
                      </p>
                      {answer.isCorrect ? (
                        <Badge className="bg-green-500">Correct</Badge>
                      ) : (
                        <Badge variant="destructive">Incorrect</Badge>
                      )}
                    </div>
                    <p className="text-sm mb-3">{questions[idx].question}</p>
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">Your answer:</span>
                        <span className={answer.isCorrect ? "text-green-600 dark:text-green-400 font-medium" : "text-red-600 dark:text-red-400 font-medium"}>
                          {answer.userAnswer || "Not answered"}
                        </span>
                      </div>
                      {!answer.isCorrect && (
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground">Correct answer:</span>
                          <span className="text-green-600 dark:text-green-400 font-medium">{answer.correctAnswer}</span>
                        </div>
                      )}
                      <div className="mt-3 p-3 bg-muted rounded-lg">
                        <p className="text-xs text-muted-foreground mb-1">Explanation:</p>
                        <ChatMarkdown content={answer.explanation} />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </CardContent>
          </Card>
        </div>
      )
    }

    return (
      <div className="space-y-6">
        <Card className="border-2 border-primary">
          <CardContent className="pt-8 pb-8">
            <div className="text-center space-y-6">
              <Trophy className="h-16 w-16 mx-auto text-amber-500" />
              <div>
                <h2 className="text-3xl font-bold mb-2">Exam Complete!</h2>
                <p className="text-muted-foreground">You've finished the mock exam. Here are your results.</p>
              </div>

              <div className="bg-muted rounded-xl p-8">
                <div className={`text-6xl font-black mb-2 ${performanceColor}`}>{results.scorePercentage.toFixed(1)}%</div>
                <p className={`text-xl font-semibold ${performanceColor}`}>{performanceLabel}</p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="p-4 bg-muted rounded-lg">
                  <p className="text-2xl font-bold text-green-600 dark:text-green-400">{results.correctAnswers}</p>
                  <p className="text-xs text-muted-foreground">Correct</p>
                </div>
                <div className="p-4 bg-muted rounded-lg">
                  <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                    {results.totalQuestions - results.correctAnswers}
                  </p>
                  <p className="text-xs text-muted-foreground">Incorrect</p>
                </div>
                <div className="p-4 bg-muted rounded-lg">
                  <p className="text-2xl font-bold">{results.totalQuestions}</p>
                  <p className="text-xs text-muted-foreground">Total Questions</p>
                </div>
                <div className="p-4 bg-muted rounded-lg">
                  <p className="text-2xl font-bold">{formatTime(results.timeTaken)}</p>
                  <p className="text-xs text-muted-foreground">Time Taken</p>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Button onClick={() => setShowReview(true)} className="gap-2">
                  <CheckCircle className="h-4 w-4" />
                  View Detailed Review
                </Button>
                <Button variant="outline" onClick={onExit} className="gap-2">
                  <Home className="h-4 w-4" />
                  Back to Generator
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Exam taking view
  return (
    <div className="space-y-4">
      {/* Header with timer and progress */}
      <Card className="border-2 border-primary">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-primary" />
                <span
                  className={`text-lg font-bold ${timeRemaining !== null && timeRemaining < 60 ? "text-red-500 animate-pulse" : ""}`}
                >
                  {formatTime(timeRemaining)}
                </span>
              </div>
              <div className="h-6 w-px bg-border" />
              <p className="text-sm text-muted-foreground">
                Question {currentQuestion + 1} of {totalQuestions}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">{answeredCount} answered</span>
              <Progress value={progress} className="w-24 h-2" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Question card */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentQuestion}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.2 }}
        >
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between gap-4">
                <CardTitle className="text-lg leading-relaxed">{questions[currentQuestion].question}</CardTitle>
                {questions[currentQuestion].difficulty && (
                  <Badge variant="outline" className="capitalize">
                    {questions[currentQuestion].difficulty}
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {questions[currentQuestion].options.map((option, idx) => {
                const optionLetter = option.charAt(0) // Extract A, B, C, D
                const isSelected = answers[currentQuestion] === optionLetter

                return (
                  <button
                    key={idx}
                    onClick={() => handleAnswerSelect(optionLetter)}
                    className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                      isSelected
                        ? "border-primary bg-primary/10"
                        : "border-border hover:border-primary/50 hover:bg-muted/50"
                    }`}
                  >
                    <span className="text-sm">{option}</span>
                  </button>
                )
              })}
            </CardContent>
          </Card>
        </motion.div>
      </AnimatePresence>

      {/* Navigation */}
      <div className="flex items-center justify-between gap-4">
        <Button
          variant="outline"
          onClick={handlePrevious}
          disabled={currentQuestion === 0}
          className="gap-2 bg-transparent"
        >
          <ChevronLeft className="h-4 w-4" />
          Previous
        </Button>

        <div className="flex gap-2">
          {currentQuestion === totalQuestions - 1 ? (
            <Button onClick={() => handleSubmit(false)} disabled={submitting} className="gap-2">
              {submitting ? "Submitting..." : "Submit Exam"}
              <CheckCircle className="h-4 w-4" />
            </Button>
          ) : (
            <Button onClick={handleNext} className="gap-2">
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Question navigator */}
      <Card>
        <CardContent className="p-4">
          <p className="text-sm font-medium mb-3">Question Navigator</p>
          <div className="grid grid-cols-10 gap-2">
            {Array.from({ length: totalQuestions }, (_, i) => (
              <button
                key={i}
                onClick={() => setCurrentQuestion(i)}
                className={`aspect-square rounded-md text-xs font-medium transition-colors ${
                  i === currentQuestion
                    ? "bg-primary text-primary-foreground"
                    : answers[i]
                      ? "bg-green-500/20 text-green-600 dark:text-green-400 hover:bg-green-500/30"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                {i + 1}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

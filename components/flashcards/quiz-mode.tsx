"use client"

import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { BookOpen, CheckCircle2, XCircle } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import Link from "next/link"
import confetti from "canvas-confetti"
import type { Flashcard } from "@/lib/types/study"

interface QuizModeProps {
  deck: any
  flashcards: Flashcard[]
}

export function QuizMode({ deck, flashcards }: QuizModeProps) {
  const [quizCards, setQuizCards] = useState<Flashcard[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null)
  const [score, setScore] = useState(0)
  const [showResult, setShowResult] = useState(false)
  const [answers, setAnswers] = useState<string[]>([])

  useEffect(() => {
    // Shuffle and take 10 cards
    const shuffled = [...flashcards].sort(() => Math.random() - 0.5).slice(0, Math.min(10, flashcards.length))
    setQuizCards(shuffled)
  }, [flashcards])

  useEffect(() => {
    if (quizCards.length > 0 && currentIndex < quizCards.length) {
      generateAnswers()
    }
  }, [currentIndex, quizCards])

  const generateAnswers = () => {
    const currentCard = quizCards[currentIndex]
    const wrongAnswers = quizCards
      .filter((c) => c.id !== currentCard.id)
      .sort(() => Math.random() - 0.5)
      .slice(0, 3)
      .map((c) => c.answer)

    const allAnswers = [currentCard.answer, ...wrongAnswers].sort(() => Math.random() - 0.5)
    setAnswers(allAnswers)
  }

  const handleAnswer = (answer: string) => {
    setSelectedAnswer(answer)
    const isCorrect = answer === quizCards[currentIndex].answer

    if (isCorrect) {
      setScore(score + 1)
    }

    setTimeout(() => {
      if (currentIndex + 1 < quizCards.length) {
        setCurrentIndex(currentIndex + 1)
        setSelectedAnswer(null)
      } else {
        setShowResult(true)
        if (isCorrect && score + 1 === quizCards.length) {
          confetti({
            particleCount: 100,
            spread: 70,
            origin: { y: 0.6 },
          })
        }
      }
    }, 1500)
  }

  if (flashcards.length < 4) {
    return (
      <Card>
        <CardContent className="py-12 md:py-16 text-center px-4">
          <p className="text-sm md:text-base text-muted-foreground mb-4">
            You need at least 4 flashcards to start a quiz
          </p>
          <Link href={`/flashcards?deck=${deck.id}`}>
            <Button className="w-full sm:w-auto">Add More Cards</Button>
          </Link>
        </CardContent>
      </Card>
    )
  }

  if (quizCards.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 md:py-16 text-center">
          <p className="text-sm md:text-base text-muted-foreground">Loading quiz...</p>
        </CardContent>
      </Card>
    )
  }

  if (showResult) {
    const percentage = Math.round((score / quizCards.length) * 100)
    return (
      <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
        <Card>
          <CardHeader className="px-4 md:px-6">
            <CardTitle className="text-center text-lg md:text-xl">Quiz Complete!</CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4 md:space-y-6 px-4 md:px-6">
            <div>
              <p className="text-4xl md:text-6xl font-bold text-primary mb-2">{percentage}%</p>
              <p className="text-sm md:text-base text-muted-foreground">
                You got {score} out of {quizCards.length} correct
              </p>
            </div>

            {percentage === 100 && <p className="text-base md:text-lg font-medium">Perfect score! You're a master!</p>}
            {percentage >= 70 && percentage < 100 && (
              <p className="text-base md:text-lg font-medium">Great job! Keep it up!</p>
            )}
            {percentage >= 50 && percentage < 70 && (
              <p className="text-base md:text-lg font-medium">Good effort! Review and try again.</p>
            )}
            {percentage < 50 && <p className="text-base md:text-lg font-medium">Keep studying! You'll get there.</p>}

            <div className="flex flex-col sm:flex-row gap-3 md:gap-4">
              <Link href={`/flashcards?deck=${deck.id}`} className="flex-1">
                <Button variant="outline" className="w-full bg-transparent">
                  <BookOpen className="mr-2 h-4 w-4" />
                  Review Cards
                </Button>
              </Link>
              <Button
                className="flex-1"
                onClick={() => {
                  setCurrentIndex(0)
                  setScore(0)
                  setShowResult(false)
                  setSelectedAnswer(null)
                  const shuffled = [...flashcards]
                    .sort(() => Math.random() - 0.5)
                    .slice(0, Math.min(10, flashcards.length))
                  setQuizCards(shuffled)
                }}
              >
                Try Again
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    )
  }

  const currentCard = quizCards[currentIndex]
  const progress = ((currentIndex + 1) / quizCards.length) * 100

  return (
    <div className="space-y-3 md:space-y-6">
      {/* Progress */}
      <Card>
        <CardContent className="pt-4 md:pt-6 px-4 md:px-6">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs md:text-sm font-medium">
              Question {currentIndex + 1} of {quizCards.length}
            </p>
            <p className="text-xs md:text-sm text-muted-foreground">Score: {score}</p>
          </div>
          <Progress value={progress} className="h-2" />
        </CardContent>
      </Card>

      {/* Question */}
      <motion.div key={currentIndex} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
        <Card>
          <CardHeader className="px-4 md:px-6 pb-3 md:pb-6">
            <CardTitle className="text-base md:text-xl leading-snug">{currentCard.question}</CardTitle>
          </CardHeader>
          <CardContent className="px-4 md:px-6">
            <div className="grid gap-2 md:gap-3">
              {answers.map((answer, index) => {
                const isCorrect = answer === currentCard.answer
                const isSelected = selectedAnswer === answer
                const showFeedback = selectedAnswer !== null

                return (
                  <Button
                    key={index}
                    variant="outline"
                    className={`h-auto py-3 md:py-4 px-4 md:px-6 text-left justify-start text-sm md:text-base ${
                      showFeedback && isCorrect
                        ? "bg-green-500/20 border-green-500"
                        : showFeedback && isSelected && !isCorrect
                          ? "bg-red-500/20 border-red-500"
                          : ""
                    }`}
                    onClick={() => !selectedAnswer && handleAnswer(answer)}
                    disabled={selectedAnswer !== null}
                  >
                    <div className="flex items-center gap-2 md:gap-3 w-full">
                      <span className="flex-1 break-words">{answer}</span>
                      {showFeedback && isCorrect && (
                        <CheckCircle2 className="h-4 w-4 md:h-5 md:w-5 text-green-500 flex-shrink-0" />
                      )}
                      {showFeedback && isSelected && !isCorrect && (
                        <XCircle className="h-4 w-4 md:h-5 md:w-5 text-red-500 flex-shrink-0" />
                      )}
                    </div>
                  </Button>
                )
              })}
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}

"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Brain, RotateCw, ArrowRight } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import type { Flashcard } from "@/lib/types/study"

interface QuickQuizProps {
  card?: Flashcard
  deckId?: string
}

export function QuickQuiz({ card, deckId }: QuickQuizProps) {
  const [flipped, setFlipped] = useState(false)

  if (!card) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.3 }}
      >
        <Card className="h-full hover:shadow-lg transition-shadow">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-primary" />
              Quick Quiz
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8">
              <p className="text-muted-foreground">No flashcards available</p>
              <Link href="/flashcards">
                <Button className="mt-4">Create Flashcards</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.3 }}
    >
      <Card className="h-full hover:shadow-lg transition-shadow">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-primary" />
            Quick Quiz
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="relative h-48 cursor-pointer perspective-1000" onClick={() => setFlipped(!flipped)}>
              <AnimatePresence mode="wait">
                <motion.div
                  key={flipped ? "answer" : "question"}
                  initial={{ rotateY: 90, opacity: 0 }}
                  animate={{ rotateY: 0, opacity: 1 }}
                  exit={{ rotateY: -90, opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  className="absolute inset-0 flex items-center justify-center p-6 bg-gradient-to-br from-primary/10 to-purple-500/10 rounded-lg border-2 border-primary/20"
                >
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground mb-2">{flipped ? "Answer" : "Question"}</p>
                    <p className="text-lg font-medium">{flipped ? card.answer : card.question}</p>
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1 bg-transparent" onClick={() => setFlipped(!flipped)}>
                <RotateCw className="mr-2 h-4 w-4" />
                Flip Card
              </Button>
              <Link href={`/flashcards?deck=${deckId}`} className="flex-1">
                <Button className="w-full">
                  <ArrowRight className="mr-2 h-4 w-4" />
                  Study More
                </Button>
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}

"use client"

import { useRef, useCallback } from "react"
import { FlashcardStudy } from "@/components/flashcards/flashcard-study"
import { AIFlashcardGenerator } from "@/components/flashcards/ai-flashcard-generator"
import { QuizMode } from "@/components/flashcards/quiz-mode"
import type { Flashcard } from "@/lib/types/study"

interface FlashcardContentProps {
  deck: any
  flashcards: Flashcard[]
  allTags: string[]
  mode: string
}

export function FlashcardContent({ deck, flashcards, allTags, mode }: FlashcardContentProps) {
  // Ref that FlashcardStudy writes its refreshCards fn into
  const refreshRef = useRef<(() => Promise<void>) | null>(null)

  const handleGenerated = useCallback(async () => {
    // Silently re-fetch cards inside FlashcardStudy without touching the page
    await refreshRef.current?.()
  }, [])

  return (
    <div className="space-y-6">
      <AIFlashcardGenerator
        deckId={deck.id}
        subject={deck.subject}
        onGenerated={handleGenerated}
      />

      {mode === "quiz" ? (
        <QuizMode deck={deck} flashcards={flashcards} />
      ) : (
        <FlashcardStudy
          deck={deck}
          flashcards={flashcards}
          allTags={allTags}
          refreshRef={refreshRef}
        />
      )}
    </div>
  )
}

"use client"

import { useState } from "react"
import type { GeneratedQuest } from "@/lib/types/quest"

export function useQuestGeneration() {
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const generateQuest = async (
    subject: string,
    difficulty: "easy" | "medium" | "hard",
    questionCount = 5,
  ): Promise<GeneratedQuest | null> => {
    setIsGenerating(true)
    setError(null)

    try {
      const response = await fetch("/api/quests/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, difficulty, questionCount }),
      })

      if (!response.ok) {
        throw new Error("Failed to generate quest")
      }

      const data = await response.json()
      return data.quest
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "An error occurred"
      setError(errorMessage)
      return null
    } finally {
      setIsGenerating(false)
    }
  }

  return { generateQuest, isGenerating, error }
}

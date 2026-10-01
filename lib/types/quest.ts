import { z } from "zod"

export const QuestionSchema = z.object({
  question: z.string(),
  options: z.array(z.string()).length(4),
  correctAnswer: z.number().min(0).max(3),
  explanation: z.string(),
})

export const GeneratedQuestSchema = z.object({
  title: z.string(),
  description: z.string(),
  subject: z.string(),
  difficulty: z.enum(["easy", "medium", "hard"]),
  xpReward: z.number(),
  questions: z.array(QuestionSchema).min(3).max(10),
})

export type Question = z.infer<typeof QuestionSchema>
export type GeneratedQuest = z.infer<typeof GeneratedQuestSchema>

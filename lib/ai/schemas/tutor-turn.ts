/**
 * Structured output schemas for Sprout AI.
 *
 * THIS IS WHERE THE SOCRATIC GUARANTEE LIVES.
 *
 * A prompt that says "please be Socratic" is a suggestion. Requiring
 * `nextLeadingQuestion` to be a non-empty string that ends in a question mark
 * is enforceable: a response that just hands over the answer fails validation
 * and is retried. That's the difference between a stated intention and a
 * guardrail.
 */

import { z } from "zod"

export const TutorTurnSchema = z.object({
  feedbackOnStudentInput: z.string().min(1),
  // Required, non-empty, and must actually be a question.
  nextLeadingQuestion: z
    .string()
    .min(5)
    .refine((s) => s.trim().endsWith("?"), {
      message: "nextLeadingQuestion must be a question",
    }),
  conceptsTouched: z.array(z.string()).default([]),
  observedMastery: z.enum(["struggling", "developing", "solid"]).default("developing"),
  misconceptionDetected: z.string().nullable().default(null),
})
export type TutorTurn = z.infer<typeof TutorTurnSchema>

export const AssessorOutputSchema = z.object({
  concepts: z
    .array(
      z.object({
        name: z.string(),
        evidence: z.string().default(""),
        mastery: z.enum(["struggling", "developing", "solid"]),
      }),
    )
    .default([]),
  misconceptions: z.array(z.string()).default([]),
  recommendedFocus: z.string().default(""),
  confidence: z.number().min(0).max(1).default(0.5),
})
export type AssessorOutput = z.infer<typeof AssessorOutputSchema>

export const CurriculumOutputSchema = z.object({
  nextConcept: z.string(),
  reason: z.string().default(""),
  difficulty: z.enum(["easier", "same", "harder"]).default("same"),
  alternativeConcepts: z.array(z.string()).default([]),
})
export type CurriculumOutput = z.infer<typeof CurriculumOutputSchema>

/** Strip markdown fences and parse the first JSON object in a model response. */
export function parseJsonResponse(raw: string): unknown {
  let text = (raw ?? "").trim()
  text = text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim()

  try {
    return JSON.parse(text)
  } catch {
    const match = text.match(/\{[\s\S]*\}/)
    if (!match) throw new Error("No JSON object found in model response")
    return JSON.parse(match[0])
  }
}

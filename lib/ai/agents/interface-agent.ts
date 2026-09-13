/**
 * Interface Agent — the only agent a student ever sees.
 *
 * Returns a validated Socratic turn. If the model produces something that isn't
 * a valid turn (most commonly: answering outright, with no leading question),
 * the call is retried with corrective feedback. After the retries are exhausted
 * we fall back to a safe generic prompt rather than shipping an unvalidated
 * answer to the student.
 */

import { aiChatCompletion } from "@/lib/ai/provider"
import { buildPrompt, promptVersion } from "@/lib/ai/prompts/registry"
import { TutorTurnSchema, parseJsonResponse, type TutorTurn } from "@/lib/ai/schemas/tutor-turn"

export interface InterfaceAgentInput {
  studentName?: string | null
  subject?: string | null
  /** Retrieved reference material, already formatted. */
  context?: string
  /** Short natural-language summary of the student's mastery. */
  masterySummary?: string
  history: Array<{ role: "user" | "assistant"; content: string }>
  message: string
}

export interface InterfaceAgentResult {
  turn: TutorTurn
  promptVersion: string
  attempts: number
  degraded: boolean
}

const MAX_ATTEMPTS = 3

export async function runInterfaceAgent(input: InterfaceAgentInput): Promise<InterfaceAgentResult> {
  const system = buildPrompt("interface_agent", {
    studentName: input.studentName,
    subject: input.subject,
    context: input.context,
    masterySummary: input.masterySummary,
  })

  const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
    { role: "system", content: system },
    ...input.history.slice(-10),
    { role: "user", content: input.message },
  ]

  let lastError = ""

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const attemptMessages =
      attempt === 1
        ? messages
        : [
            ...messages,
            {
              role: "user" as const,
              content:
                `Your previous response was rejected: ${lastError}. ` +
                `Respond ONLY with the required JSON object. ` +
                `"nextLeadingQuestion" is mandatory and must end with a question mark. ` +
                `Do not give the student the answer.`,
            },
          ]

    const res = await aiChatCompletion({
      messages: attemptMessages,
      temperature: 0.7,
      max_tokens: 900,
      response_format: { type: "json_object" },
    })

    if (!res.ok) {
      lastError = `provider error ${res.status}`
      continue
    }

    try {
      const data = await res.json()
      const raw = data?.choices?.[0]?.message?.content ?? ""
      const parsed = TutorTurnSchema.parse(parseJsonResponse(raw))
      return {
        turn: parsed,
        promptVersion: promptVersion("interface_agent"),
        attempts: attempt,
        degraded: false,
      }
    } catch (err) {
      lastError = err instanceof Error ? err.message : "validation failed"
      console.warn(`[interface-agent] attempt ${attempt} rejected: ${lastError}`)
    }
  }

  // Never ship an unvalidated answer. A generic nudge is a worse experience but
  // it cannot violate the teaching rules.
  console.error("[interface-agent] all attempts failed, returning safe fallback")
  return {
    turn: {
      feedbackOnStudentInput:
        "Let's work through this together rather than jumping to the answer.",
      nextLeadingQuestion: "What part of this problem feels least clear to you right now?",
      conceptsTouched: [],
      observedMastery: "developing",
      misconceptionDetected: null,
    },
    promptVersion: promptVersion("interface_agent"),
    attempts: MAX_ATTEMPTS,
    degraded: true,
  }
}

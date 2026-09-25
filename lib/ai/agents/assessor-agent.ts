/**
 * Assessor Agent — invisible. Judges what evidence reveals about understanding.
 *
 * Runs AFTER the student's response has been sent, off the event queue. It never
 * sits in the request path: its job is to accumulate judgements over time, not
 * to shape the immediate reply.
 */

import { aiGenerateText } from "@/lib/ai/provider"
import { buildPrompt, promptVersion } from "@/lib/ai/prompts/registry"
import { AssessorOutputSchema, parseJsonResponse, type AssessorOutput } from "@/lib/ai/schemas/tutor-turn"
import { createAdminClient } from "@/lib/supabase/admin"

export interface AssessorInput {
  userId: string
  transcript: string
  subject?: string | null
}

export async function runAssessor(input: AssessorInput): Promise<AssessorOutput | null> {
  try {
    const raw = await aiGenerateText({
      messages: [
        {
          role: "system",
          content: buildPrompt("assessor_agent", { transcript: input.transcript, subject: input.subject }),
        },
        { role: "user", content: "Assess this exchange." },
      ],
      temperature: 0.2, // low: this is judgement, not creativity
      max_tokens: 800,
      response_format: { type: "json_object" },
    })

    const result = AssessorOutputSchema.parse(parseJsonResponse(raw))

    // Persist misconceptions as evidence so they surface in later sessions.
    if (result.misconceptions.length > 0) {
      const admin = createAdminClient()
      await admin.from("learning_events").insert({
        user_id: input.userId,
        event_type: "tutor_exchange",
        source: "assessor",
        subject: input.subject ?? null,
        outcome: "partial",
        payload: {
          misconceptions: result.misconceptions,
          recommendedFocus: result.recommendedFocus,
          confidence: result.confidence,
          promptVersion: promptVersion("assessor_agent"),
        },
      })
    }

    return result
  } catch (err) {
    console.error("[assessor] failed:", err)
    return null
  }
}

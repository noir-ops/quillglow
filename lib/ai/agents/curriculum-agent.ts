/**
 * Curriculum Agent — invisible. Decides what the student should study next.
 *
 * Reads the Learning Graph rather than guessing, then asks the model only to
 * sequence what it is given. Keeping the data authoritative and the model
 * advisory is what stops it inventing topics that aren't in the syllabus.
 */

import { aiGenerateText } from "@/lib/ai/provider"
import { buildPrompt } from "@/lib/ai/prompts/registry"
import { CurriculumOutputSchema, parseJsonResponse, type CurriculumOutput } from "@/lib/ai/schemas/tutor-turn"
import { getDueForReview, getWeakestConcepts } from "@/lib/services/learning-graph"
import { createAdminClient } from "@/lib/supabase/admin"

export async function runCurriculum(
  userId: string,
  subject?: string | null,
): Promise<CurriculumOutput | null> {
  try {
    const [weak, due] = await Promise.all([getWeakestConcepts(userId, 8), getDueForReview(userId, 8)])

    // Nothing to plan from yet.
    if (weak.length === 0 && due.length === 0) return null

    const label = (c: any) => c.learning_concepts?.name ?? c.concept_id

    const raw = await aiGenerateText({
      messages: [
        {
          role: "system",
          content: buildPrompt("curriculum_agent", {
            weakConcepts: weak.map(label),
            dueForReview: due.map(label),
            subject,
          }),
        },
        { role: "user", content: "What should this student study next?" },
      ],
      temperature: 0.3,
      max_tokens: 500,
      response_format: { type: "json_object" },
    })

    const plan = CurriculumOutputSchema.parse(parseJsonResponse(raw))

    // Cache as a score row so the UI can read it without another LLM call.
    const admin = createAdminClient()
    await admin.from("intelligence_scores").upsert(
      {
        user_id: userId,
        score_type: "next_best_action",
        scope: subject ?? "global",
        value: 0,
        breakdown: plan as unknown as Record<string, unknown>,
        computed_at: new Date().toISOString(),
      },
      { onConflict: "user_id,score_type,scope" },
    )

    return plan
  } catch (err) {
    console.error("[curriculum] failed:", err)
    return null
  }
}

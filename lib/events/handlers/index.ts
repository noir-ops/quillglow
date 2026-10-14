/**
 * Event handlers.
 *
 * Each handler is a pure async function that either succeeds or throws. The
 * worker owns retry/backoff/dead-lettering, so handlers stay simple.
 */

import { runAssessor } from "@/lib/ai/agents/assessor-agent"
import { runCurriculum } from "@/lib/ai/agents/curriculum-agent"
import { computeExamReadiness, computeLearningRisk } from "@/lib/services/learning-graph"
import type { PlatformEvent, PlatformEventType } from "../bus"

export type EventHandler = (event: PlatformEvent) => Promise<void>

const handlers: Partial<Record<PlatformEventType, EventHandler>> = {
  "assessment.requested": async (event) => {
    if (!event.user_id) return
    const transcript = String(event.payload?.transcript ?? "")
    if (!transcript.trim()) return
    await runAssessor({
      userId: event.user_id,
      transcript,
      subject: event.payload?.subject ?? null,
    })
  },

  "curriculum.requested": async (event) => {
    if (!event.user_id) return
    await runCurriculum(event.user_id, event.payload?.subject ?? null)
  },

  "scores.refresh_requested": async (event) => {
    if (!event.user_id) return
    await computeExamReadiness(event.user_id, event.payload?.syllabus ?? null, event.payload?.subject ?? null)
    await computeLearningRisk(event.user_id)
  },

  "learning.evidence_recorded": async () => {
    // Evidence is written synchronously by record_learning_event. This exists so
    // future subscribers (notifications, rewards) have a hook without changing
    // the emitters.
  },

  "learning.session_completed": async (event) => {
    if (!event.user_id) return
    await computeLearningRisk(event.user_id)
  },
}

export function getHandler(type: PlatformEventType): EventHandler | null {
  return handlers[type] ?? null
}

export function registeredEventTypes(): string[] {
  return Object.keys(handlers)
}

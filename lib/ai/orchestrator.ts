/**
 * Sprout AI orchestrator — the single visible assistant.
 *
 * CRITICAL DESIGN DECISION: only the Interface Agent runs in the request path.
 *
 * The proposal describes three agents. If all three ran synchronously, every
 * student message would cost three LLM calls and feel sluggish. The invisible
 * agents (Assessor, Curriculum) exist to accumulate judgements over time, not to
 * shape the immediate reply — so they run AFTER the response is returned.
 *
 *   Student message
 *         │
 *   1. Load context   (mastery + RAG)      ← cheap DB + one embedding call
 *   2. Interface Agent                     ← the ONLY blocking LLM call
 *   3. Emit learning_event
 *   4. Return to student
 *         │  (async, post-response)
 *   5. Assessor / Curriculum / score refresh
 */

import { runInterfaceAgent } from "@/lib/ai/agents/interface-agent"
import { buildContextBlock, retrieve } from "@/lib/ai/rag/retriever"
import { emitLearningEvent, getWeakestConcepts } from "@/lib/services/learning-graph"
import { emit } from "@/lib/events/bus"
import type { TutorTurn } from "@/lib/ai/schemas/tutor-turn"
import { getLearnerSyllabus, describeSyllabusForPrompt } from "@/lib/services/syllabus"

export interface SproutRequest {
  userId: string
  message: string
  history?: Array<{ role: "user" | "assistant"; content: string }>
  subject?: string | null
  syllabus?: string | null
  studentName?: string | null
  /** Set false to skip retrieval (e.g. for casual navigation chat). */
  useRag?: boolean
}

export interface SproutResponse {
  reply: string
  turn: TutorTurn
  sources: Array<{ id: number; namespace: string; snippet: string }>
  meta: { promptVersion: string; attempts: number; degraded: boolean; ragHits: number }
}

/** Turn the mastery map into a short line the model can actually use. */
function summariseMastery(concepts: any[]): string {
  if (!concepts.length) return ""
  const names = concepts
    .slice(0, 5)
    .map((c) => c.learning_concepts?.name ?? c.concept_id)
    .filter(Boolean)
  if (!names.length) return ""
  return `This student is currently weakest on: ${names.join(", ")}. Bias your questions toward these.`
}

export async function runSprout(req: SproutRequest): Promise<SproutResponse> {
  // ── 1. Context ────────────────────────────────────────────────────────────
  // Syllabus resolution: an explicit per-request value wins (a session pinned
  // to one subject), otherwise fall back to the learner's saved selection.
  // Before this, callers almost always passed null and retrieval silently ran
  // with no curriculum grounding at all.
  const saved = await getLearnerSyllabus(req.userId).catch(() => ({ primary: null, secondary: null }))
  const primary = req.syllabus ?? saved.primary
  // Secondary only applies when the caller didn't pin a specific syllabus —
  // a pinned session shouldn't silently pull in a second curriculum.
  const secondary = req.syllabus ? null : saved.secondary

  const namespaces: string[] = []
  if (primary) namespaces.push(`syllabus_${primary.toLowerCase()}`)
  if (secondary) namespaces.push(`syllabus_${secondary.toLowerCase()}`)
  namespaces.push("user_upload")

  const syllabusDirective = describeSyllabusForPrompt({ primary, secondary })

  const [chunks, weak] = await Promise.all([
    req.useRag === false
      ? Promise.resolve([])
      : retrieve({
          query: req.message,
          namespaces,
          userId: req.userId,
          // Slightly wider when two syllabi are in play so the secondary
          // doesn't crowd out the primary's chunks.
          limit: secondary ? 8 : 6,
        }),
    getWeakestConcepts(req.userId, 5).catch(() => []),
  ])

  // ── 2. Interface Agent (only blocking LLM call) ───────────────────────────
  const result = await runInterfaceAgent({
    studentName: req.studentName,
    subject: req.subject,
    context: buildContextBlock(chunks),
    // The syllabus directive rides alongside the mastery summary so the model
    // gets curriculum scoping without changing the agent's signature.
    masterySummary: [syllabusDirective, summariseMastery(weak)].filter(Boolean).join("\n\n"),
    history: req.history ?? [],
    message: req.message,
  })

  const { turn } = result

  // ── 3. Evidence ───────────────────────────────────────────────────────────
  emitLearningEvent({
    userId: req.userId,
    eventType: "tutor_exchange",
    source: "sprout",
    rawTopic: turn.conceptsTouched[0] ?? req.message.slice(0, 120),
    subject: req.subject ?? null,
    outcome:
      turn.observedMastery === "solid"
        ? "correct"
        : turn.observedMastery === "struggling"
          ? "incorrect"
          : "partial",
    payload: {
      // Readiness is recomputed from this payload (see events/handlers), so
      // the resolved PRIMARY syllabus goes here — never the secondary, which
      // would fragment the score across two curricula.
      syllabus: primary ?? null,
      subject: req.subject ?? null,
      conceptsTouched: turn.conceptsTouched,
      misconception: turn.misconceptionDetected,
      promptVersion: result.promptVersion,
      degraded: result.degraded,
      ragHits: chunks.length,
    },
  })

  // ── 4. Post-response work — queued, never inline ──────────────────────────
  // Debounced per user: a rapid back-and-forth produces ONE assessment run
  // when the student pauses, not one per message.
  if (!result.degraded) {
    const transcript = [...(req.history ?? []).slice(-6), { role: "user", content: req.message }]
      .map((m) => `${m.role}: ${m.content}`)
      .join("\n")

    void emit("assessment.requested", {
      userId: req.userId,
      payload: { transcript, subject: req.subject ?? null },
      dedupeKey: `assess:${req.userId}`,
      delaySeconds: 45,
    })

    void emit("curriculum.requested", {
      userId: req.userId,
      payload: { subject: req.subject ?? null },
      dedupeKey: `curriculum:${req.userId}`,
      delaySeconds: 60,
    })

    void emit("scores.refresh_requested", {
      userId: req.userId,
      payload: { syllabus: req.syllabus ?? null, subject: req.subject ?? null },
      dedupeKey: `scores:${req.userId}`,
      delaySeconds: 30,
    })
  }

  return {
    // The two structured fields compose into what the student reads. Because
    // the question is a required field, every reply ends with a next step.
    reply: `${turn.feedbackOnStudentInput}\n\n${turn.nextLeadingQuestion}`,
    turn,
    sources: chunks.map((c) => ({
      id: c.id,
      namespace: c.namespace,
      snippet: c.content.slice(0, 160),
    })),
    meta: {
      promptVersion: result.promptVersion,
      attempts: result.attempts,
      degraded: result.degraded,
      ragHits: chunks.length,
    },
  }
}

/**
 * Student Learning Graph service.
 *
 * Every feature that produces evidence about what a student knows calls
 * `recordLearningEvent()`. That evidence accumulates in an append-only log and
 * drives mastery, Intelligence Scores, and (in Phase 2) the Assessor and
 * Curriculum agents.
 *
 * Design notes:
 *  - Emission is FIRE-AND-FORGET. A failure to record evidence must never break
 *    the user-facing feature that produced it.
 *  - `conceptId` is optional. Before the curriculum is seeded, pass `rawTopic`
 *    instead — the event is still logged and can be mapped to a concept later.
 *    This is what lets evidence start accumulating today rather than after the
 *    syllabus work finishes.
 */

import { createAdminClient } from "@/lib/supabase/admin"
import { getLearnerSyllabus } from "@/lib/services/syllabus"

export type LearningEventType =
  | "quiz_answer"
  | "flashcard_review"
  | "exam_attempt"
  | "essay_submitted"
  | "note_created"
  | "tutor_exchange"
  | "mind_map_created"
  | "revision_note_created"
  | "study_session"
  | "audio_overview"
  | "quest_completed"
  // Section D of the proposal: the Learning Graph tracks scholarship
  // applications, mentor interactions, purchases and certifications alongside
  // strengths, weaknesses and exam history.
  | "scholarship_application"
  | "mentor_interaction"
  | "purchase"
  | "certification"

export type LearningOutcome = "correct" | "incorrect" | "partial" | "skipped" | "completed"

export interface LearningEventInput {
  userId: string
  eventType: LearningEventType
  /** Originating feature, e.g. "mock-exam". */
  source: string
  /** Curriculum concept, once mapping exists. */
  conceptId?: string | null
  /** Free-text topic, used before curriculum mapping. */
  rawTopic?: string | null
  subject?: string | null
  outcome?: LearningOutcome | null
  /** Raw score. Pair with maxScore for normalisation. */
  score?: number | null
  maxScore?: number | null
  durationMs?: number | null
  payload?: Record<string, unknown>
}

/**
 * Record one piece of evidence. Never throws — logging failures are swallowed
 * and reported so they can't take down the calling feature.
 */
export async function recordLearningEvent(input: LearningEventInput): Promise<number | null> {
  try {
    const admin = createAdminClient()
    const { data, error } = await admin.rpc("record_learning_event", {
      p_user_id: input.userId,
      p_event_type: input.eventType,
      p_source: input.source,
      p_concept_id: input.conceptId ?? null,
      p_raw_topic: input.rawTopic ?? null,
      p_subject: input.subject ?? null,
      p_outcome: input.outcome ?? null,
      p_score: input.score ?? null,
      p_max_score: input.maxScore ?? null,
      p_duration_ms: input.durationMs ?? null,
      p_payload: input.payload ?? {},
    })

    if (error) {
      console.error("[learning-graph] record failed:", error.message)
      return null
    }
    return data as number
  } catch (err) {
    console.error("[learning-graph] record threw:", err)
    return null
  }
}

/**
 * Fire-and-forget wrapper. Use this inside route handlers so evidence recording
 * never adds latency to the response.
 */
export function emitLearningEvent(input: LearningEventInput): void {
  void recordLearningEvent(input)
}

/** Record several events at once (e.g. every question in a submitted exam). */
export async function recordLearningEvents(inputs: LearningEventInput[]): Promise<void> {
  await Promise.allSettled(inputs.map(recordLearningEvent))
}

// ── Reads ───────────────────────────────────────────────────────────────────

export interface ConceptMastery {
  concept_id: string
  mastery: number
  confidence: number
  state: "unseen" | "learning" | "weak" | "review" | "mastered"
  evidence_count: number
  last_seen_at: string | null
  next_review_at: string | null
}

/** Full mastery map for a student, optionally filtered by state. */
export async function getMastery(
  userId: string,
  opts: { state?: ConceptMastery["state"]; limit?: number } = {},
): Promise<ConceptMastery[]> {
  const admin = createAdminClient()
  let query = admin
    .from("student_concept_mastery")
    .select("concept_id, mastery, confidence, state, evidence_count, last_seen_at, next_review_at")
    .eq("user_id", userId)

  if (opts.state) query = query.eq("state", opts.state)
  query = query.order("mastery", { ascending: true }).limit(opts.limit ?? 200)

  const { data, error } = await query
  if (error) {
    console.error("[learning-graph] getMastery failed:", error.message)
    return []
  }
  return (data ?? []) as ConceptMastery[]
}

/** Concepts due for review now — the input to spaced-repetition scheduling. */
export async function getDueForReview(userId: string, limit = 20) {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from("student_concept_mastery")
    .select("concept_id, mastery, state, next_review_at, learning_concepts(name, subject, syllabus)")
    .eq("user_id", userId)
    .in("state", ["weak", "review"])
    .lte("next_review_at", new Date().toISOString())
    .order("next_review_at", { ascending: true })
    .limit(limit)

  if (error) {
    console.error("[learning-graph] getDueForReview failed:", error.message)
    return []
  }
  return data ?? []
}

/** Weakest concepts — what the Curriculum Agent should target next. */
export async function getWeakestConcepts(userId: string, limit = 10) {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from("student_concept_mastery")
    .select("concept_id, mastery, confidence, state, learning_concepts(name, subject, syllabus)")
    .eq("user_id", userId)
    .in("state", ["weak", "learning"])
    .order("mastery", { ascending: true })
    .limit(limit)

  if (error) {
    console.error("[learning-graph] getWeakestConcepts failed:", error.message)
    return []
  }
  return data ?? []
}

// ── Intelligence Scores ─────────────────────────────────────────────────────

export interface IntelligenceScore {
  score_type: string
  scope: string
  value: number
  breakdown: Record<string, unknown>
  computed_at: string
}

/**
 * Recompute Exam Readiness™ for a syllabus/subject.
 *
 * When no syllabus is passed, falls back to the learner's saved PRIMARY
 * syllabus rather than scoring across the whole graph — an unscoped score
 * mixes curricula the student isn't sitting and reads as artificially low.
 */
export async function computeExamReadiness(
  userId: string,
  syllabus?: string,
  subject?: string,
): Promise<number | null> {
  try {
    let scopedSyllabus = syllabus
    if (!scopedSyllabus) {
      const { primary } = await getLearnerSyllabus(userId).catch(() => ({ primary: null }))
      scopedSyllabus = primary ?? undefined
    }

    const admin = createAdminClient()
    const { data, error } = await admin.rpc("compute_exam_readiness", {
      p_user_id: userId,
      p_syllabus: scopedSyllabus ?? null,
      p_subject: subject ?? null,
    })
    if (error) {
      console.error("[learning-graph] examReadiness failed:", error.message)
      return null
    }
    return Number(data)
  } catch (err) {
    console.error("[learning-graph] examReadiness threw:", err)
    return null
  }
}

/** Recompute Learning Risk™ (high = struggling). */
export async function computeLearningRisk(userId: string): Promise<number | null> {
  try {
    const admin = createAdminClient()
    const { data, error } = await admin.rpc("compute_learning_risk", { p_user_id: userId })
    if (error) {
      console.error("[learning-graph] learningRisk failed:", error.message)
      return null
    }
    return Number(data)
  } catch (err) {
    console.error("[learning-graph] learningRisk threw:", err)
    return null
  }
}

/** All cached Intelligence Scores for a student. */
export async function getIntelligenceScores(userId: string): Promise<IntelligenceScore[]> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from("intelligence_scores")
    .select("score_type, scope, value, breakdown, computed_at")
    .eq("user_id", userId)

  if (error) {
    console.error("[learning-graph] getIntelligenceScores failed:", error.message)
    return []
  }
  return (data ?? []) as IntelligenceScore[]
}

/**
 * Recompute scores after a batch of evidence. Fire-and-forget: scores are a
 * derived convenience, never worth blocking a response for.
 */
export function refreshScores(userId: string, syllabus?: string, subject?: string): void {
  // Section E: mastery changing is exactly the moment new opportunities may
  // have become reachable, so recommendations refresh alongside the scores.
  // Fire-and-forget — a student never waits on this.
  void (async () => {
    try {
      const { refreshRecommendations } = await import("@/lib/services/recommendation")
      refreshRecommendations(userId)
    } catch (err) {
      console.error("[learning-graph] recommendation refresh failed:", err)
    }
  })()

  void (async () => {
    try {
      // One RPC computes all six Intelligence Scores from the PDF spec.
      const admin = createAdminClient()
      const { error } = await admin.rpc("refresh_all_scores", {
        p_user_id: userId,
        p_syllabus: syllabus ?? null,
        p_subject: subject ?? null,
      })
      if (!error) return
      console.error("[learning-graph] refresh_all_scores failed:", error.message)
    } catch (err) {
      console.error("[learning-graph] refresh_all_scores threw:", err)
    }
    // Fall back to the two core scores if the combined function is unavailable
    // (e.g. migration 027 not yet applied).
    await computeExamReadiness(userId, syllabus, subject)
    await computeLearningRisk(userId)
  })()
}

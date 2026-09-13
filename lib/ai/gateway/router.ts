/**
 * Model Router — spec §9, §11.
 *
 * Maps a TASK to an ordered list of routes. The gateway walks them in priority
 * order, falling through on failure. Application code never names a vendor.
 *
 * Routing follows the spec's cost principle (§8): high-volume, structured or
 * classification work goes to the fast layer; only genuinely hard reasoning and
 * long-document work escalates.
 */

import type { AIRoute, AITask } from "./types"

const fast = () => process.env.FAST_MODEL || "gpt-4.1-mini"
const reasoning = () => process.env.REASONING_MODEL || "gpt-5.4-mini"
const longContext = () => process.env.LONG_CONTEXT_MODEL || "gemini-2.5-pro"

/** Routes are functions so env changes take effect without a rebuild. */
export function getRoutes(task: AITask): AIRoute[] {
  const ROUTES: Record<AITask, AIRoute[]> = {
    // ── High volume / low cost ──────────────────────────────────────────
    intent_detection: [
      { provider: "fast", model: fast(), maxTokens: 200, temperature: 0, priority: 1 },
    ],
    classification: [
      { provider: "fast", model: fast(), maxTokens: 300, temperature: 0, priority: 1 },
    ],
    safety_check: [
      { provider: "fast", model: fast(), maxTokens: 150, temperature: 0, priority: 1 },
    ],
    flashcards: [
      { provider: "fast", model: fast(), maxTokens: 4000, temperature: 0.4, priority: 1 },
      { provider: "reasoning", model: reasoning(), maxTokens: 4000, temperature: 0.4, priority: 2 },
    ],
    summarization: [
      { provider: "fast", model: fast(), maxTokens: 2000, temperature: 0.3, priority: 1 },
    ],
    revision_notes: [
      { provider: "fast", model: fast(), maxTokens: 4000, temperature: 0.4, priority: 1 },
    ],
    mind_map: [
      { provider: "fast", model: fast(), maxTokens: 3000, temperature: 0.4, priority: 1 },
    ],
    study_plan: [
      { provider: "fast", model: fast(), maxTokens: 4000, temperature: 0.5, priority: 1 },
      { provider: "reasoning", model: reasoning(), maxTokens: 4000, temperature: 0.4, priority: 2 },
    ],
    web_research: [
      { provider: "fast", model: fast(), maxTokens: 1500, temperature: 0.3, priority: 1 },
    ],

    // ── Tutoring: fast first, escalate on failure ───────────────────────
    tutoring: [
      { provider: "fast", model: fast(), maxTokens: 1200, temperature: 0.3, priority: 1 },
      { provider: "reasoning", model: reasoning(), maxTokens: 1600, temperature: 0.2, priority: 2 },
    ],

    // ── Genuinely hard reasoning ────────────────────────────────────────
    reasoning: [
      { provider: "reasoning", model: reasoning(), maxTokens: 3000, temperature: 0.1, priority: 1 },
      { provider: "long_context", model: longContext(), maxTokens: 3000, temperature: 0.1, priority: 2 },
    ],
    exam_generation: [
      { provider: "reasoning", model: reasoning(), maxTokens: 6000, temperature: 0.5, priority: 1 },
      { provider: "fast", model: fast(), maxTokens: 6000, temperature: 0.5, priority: 2 },
    ],
    scholarship_matching: [
      { provider: "reasoning", model: reasoning(), maxTokens: 2000, temperature: 0.1, priority: 1 },
    ],

    // ── Long-form / long-document ───────────────────────────────────────
    essay_review: [
      { provider: "long_context", model: longContext(), maxTokens: 4000, temperature: 0.2, priority: 1 },
      { provider: "reasoning", model: reasoning(), maxTokens: 4000, temperature: 0.2, priority: 2 },
    ],
    document_analysis: [
      { provider: "long_context", model: longContext(), maxTokens: 8000, temperature: 0.1, priority: 1 },
    ],
  }

  const routes = ROUTES[task]
  if (!routes?.length) {
    // Unknown task must not crash the caller — fall back to the fast layer and
    // log, so a new task added upstream degrades rather than breaks.
    console.warn(`[router] no routes for task "${task}", using fast layer`)
    return [{ provider: "fast", model: fast(), maxTokens: 1500, temperature: 0.3, priority: 1 }]
  }
  return [...routes].sort((a, b) => a.priority - b.priority)
}

/**
 * Heuristic task classification for callers that don't declare a task.
 * Deliberately keyword-based: spending an LLM call to classify every request
 * would defeat the cost control this router exists to provide.
 */
export function classifyTask(message: string): AITask {
  const m = (message ?? "").toLowerCase()
  if (/essay|composition|my writing|review my/.test(m)) return "essay_review"
  if (/flashcard|revision card/.test(m)) return "flashcards"
  if (/mind ?map|diagram/.test(m)) return "mind_map"
  if (/study plan|schedule|timetable/.test(m)) return "study_plan"
  if (/scholarship|grant|funding|bursary/.test(m)) return "scholarship_matching"
  if (/prove|derive|integral|differentiat|theorem|solve for/.test(m)) return "reasoning"
  if (/summar|tl;?dr/.test(m)) return "summarization"
  return "tutoring"
}

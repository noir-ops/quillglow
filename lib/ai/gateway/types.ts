/**
 * AI Gateway types — spec §10.
 *
 * `AIProvider` names a ROUTING LAYER, not a vendor. That indirection is the
 * whole point of §9: application code asks for "reasoning", and configuration
 * decides whether that's OpenAI, Gemini or something else. Naming layers after
 * vendors would reintroduce exactly the coupling the spec forbids.
 */

export type AIProviderLayer = "fast" | "reasoning" | "long_context" | "specialized"

export type AITask =
  | "tutoring"
  | "classification"
  | "flashcards"
  | "summarization"
  | "study_plan"
  | "reasoning"
  | "essay_review"
  | "document_analysis"
  | "scholarship_matching"
  | "web_research"
  | "mind_map"
  | "revision_notes"
  | "exam_generation"
  | "intent_detection"
  | "safety_check"

export type AIAgent = "study_ai" | "sprout_ai" | "unified_core"

export interface AIRoute {
  provider: AIProviderLayer
  model: string
  maxTokens: number
  temperature: number
  priority: number
}

export interface AIMessage {
  role: "system" | "user" | "assistant"
  content: any
}

export interface AIRequest {
  task: AITask
  messages: AIMessage[]
  system?: string
  userId?: string | null
  agent?: AIAgent
  /** Force JSON output. */
  json?: boolean
  /** Override the route's token cap. */
  maxTokens?: number
  temperature?: number
  /**
   * Cacheable only when the prompt contains nothing user-specific. The gateway
   * refuses to cache when `userId`-derived context could be embedded, because a
   * shared cache would leak one student's data into another's response.
   */
  cacheable?: boolean
  cacheTtlSeconds?: number
  metadata?: Record<string, unknown>
}

export interface AIResult {
  text: string
  provider: AIProviderLayer
  model: string
  inputTokens: number
  outputTokens: number
  latencyMs: number
  cacheHit: boolean
  fallbackDepth: number
}

/** Every vendor adapter implements this — spec §12. */
export interface AIProviderAdapter {
  generate(input: {
    system?: string
    messages: AIMessage[]
    model: string
    temperature?: number
    maxTokens?: number
    json?: boolean
  }): Promise<{
    text: string
    inputTokens: number
    outputTokens: number
    latencyMs: number
  }>
}

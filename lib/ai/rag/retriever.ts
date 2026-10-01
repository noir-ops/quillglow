/**
 * Knowledge retrieval.
 *
 * Every call is scoped by namespace AND user. The `search_knowledge` function
 * enforces isolation in SQL rather than trusting the caller, so a bug here can't
 * leak one student's uploaded notes into another student's context.
 */

import { createAdminClient } from "@/lib/supabase/admin"
import { embedText, getEmbeddingModelId, isEmbeddingConfigured } from "./embeddings"

export type KnowledgeNamespace =
  | "syllabus_waec"
  | "syllabus_jamb"
  | "syllabus_sat"
  | "syllabus_igcse"
  | "syllabus_act"
  | "scholarships"
  | "university_admissions"
  | "marketplace"
  | "user_upload"

export interface RetrievedChunk {
  id: number
  source_id: string
  namespace: string
  content: string
  concept_id: string | null
  metadata: Record<string, unknown>
  similarity: number
  score: number
}

export interface RetrieveOptions {
  query: string
  namespaces: KnowledgeNamespace[] | string[]
  userId?: string | null
  conceptId?: string | null
  limit?: number
  /** Drop weak matches so irrelevant context isn't injected into the prompt. */
  minScore?: number
}

/**
 * Hybrid (vector + lexical) retrieval. Returns [] rather than throwing when
 * embeddings aren't configured — RAG is an enhancement, and a retrieval outage
 * should degrade the tutor to non-grounded answers, not break it.
 */
export async function retrieve(options: RetrieveOptions): Promise<RetrievedChunk[]> {
  const { query, namespaces, userId = null, conceptId = null, limit = 8, minScore = 0 } = options

  if (!query?.trim() || namespaces.length === 0) return []
  if (!isEmbeddingConfigured()) {
    console.warn("[rag] embeddings not configured — skipping retrieval")
    return []
  }

  try {
    const queryVector = await embedText(query, "query")
    const admin = createAdminClient()

    const { data, error } = await admin.rpc("search_knowledge", {
      p_query_embedding: queryVector,
      p_query_text: query,
      p_namespaces: namespaces,
      p_user_id: userId,
      p_embedding_model: getEmbeddingModelId(),
      p_match_count: limit,
      p_concept_id: conceptId,
    })

    if (error) {
      console.error("[rag] search failed:", error.message)
      return []
    }

    const rows = (data ?? []) as RetrievedChunk[]
    return minScore > 0 ? rows.filter((r) => r.score >= minScore) : rows
  } catch (err) {
    console.error("[rag] retrieve threw:", err)
    return []
  }
}

/**
 * Format retrieved chunks for prompt injection.
 *
 * Chunks are numbered so the model can cite them, and the caller is told to say
 * when the context doesn't cover the question — grounding without that
 * instruction encourages confident answers from irrelevant context.
 */
export function buildContextBlock(chunks: RetrievedChunk[]): string {
  if (chunks.length === 0) return ""

  const body = chunks
    .map((c, i) => `[${i + 1}] ${c.content.trim()}`)
    .join("\n\n")

  return [
    "REFERENCE MATERIAL (from the student's syllabus and uploads):",
    body,
    "",
    "Use this material when it is relevant. If it does not cover the question, say so plainly rather than guessing.",
  ].join("\n")
}

/** Resolve which namespaces a student's query should search. */
export function namespacesForStudent(opts: {
  syllabus?: string | null
  includeUploads?: boolean
}): string[] {
  const out: string[] = []
  if (opts.syllabus) out.push(`syllabus_${opts.syllabus.toLowerCase()}`)
  if (opts.includeUploads !== false) out.push("user_upload")
  return out
}

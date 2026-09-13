/**
 * AI Gateway — spec §15. The single entry point for all AI in the platform.
 *
 * Responsibilities:
 *   - route by task (§9)         - fall back on failure (§15)
 *   - cache identical calls (§27) - record tokens/cost/latency (§26)
 *
 * Application code calls `aiGateway.execute({ task, messages })` and never
 * names a vendor.
 */

import { createHash } from "node:crypto"
import { createAdminClient } from "@/lib/supabase/admin"
import { getAdapter } from "./adapters"
import { getRoutes } from "./router"
import type { AIRequest, AIResult, AITask } from "./types"

export * from "./types"
export { classifyTask, getRoutes } from "./router"

/**
 * Tasks safe to cache across users: output depends only on the prompt, never on
 * student memory, private uploads or personal profile data. Anything omitted
 * here is never cached — the safe default.
 */
const CACHEABLE_TASKS: AITask[] = [
  "classification",
  "intent_detection",
  "safety_check",
  "summarization",
  "flashcards",
  "mind_map",
]

const DEFAULT_CACHE_TTL_SECONDS = 60 * 60 * 24 * 7

function normalizePrompt(messages: any[], system?: string): string {
  // Normalising means trivially different phrasings share a cache entry.
  const flat = [system ?? "", ...messages.map((m) => (typeof m.content === "string" ? m.content : JSON.stringify(m.content)))]
    .join("\n")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
  return flat
}

function cacheKey(task: string, model: string, prompt: string): string {
  return createHash("sha256").update(`${task}::${model}::${prompt}`).digest("hex")
}

async function readCache(key: string) {
  try {
    const admin = createAdminClient()
    const { data } = await admin.rpc("get_cached_ai_response", { p_cache_key: key })
    const row = Array.isArray(data) ? data[0] : data
    return row ?? null
  } catch {
    return null
  }
}

/**
 * Semantic cache lookup. Failures are swallowed: a cache miss is always safe,
 * and an embedding outage must not take down AI entirely.
 */
async function readSemanticCache(task: string, prompt: string) {
  try {
    const { embedText, isEmbeddingConfigured } = await import("@/lib/ai/rag/embeddings")
    if (!isEmbeddingConfigured()) return null

    const embedding = await embedText(prompt, "query")
    const admin = createAdminClient()
    const { data } = await admin.rpc("find_semantic_cache", {
      p_task: task,
      p_embedding: embedding,
      p_threshold: Number(process.env.SEMANTIC_CACHE_THRESHOLD ?? 0.95),
    })
    const row = Array.isArray(data) ? data[0] : data
    return row ?? null
  } catch (err) {
    console.error("[gateway] semantic cache lookup failed:", err)
    return null
  }
}

async function writeSemanticCache(
  task: string,
  prompt: string,
  provider: string,
  model: string,
  response: string,
  inputTokens: number,
  outputTokens: number,
  ttlSeconds: number,
) {
  try {
    const { embedText, isEmbeddingConfigured } = await import("@/lib/ai/rag/embeddings")
    if (!isEmbeddingConfigured()) return

    const embedding = await embedText(prompt, "document")
    const admin = createAdminClient()
    await admin.rpc("store_semantic_cache", {
      p_task: task,
      p_normalized_prompt: prompt.slice(0, 2000),
      p_embedding: embedding,
      p_response: response,
      p_provider: provider,
      p_model: model,
      p_input_tokens: inputTokens,
      p_output_tokens: outputTokens,
      p_ttl_seconds: ttlSeconds,
    })
  } catch (err) {
    console.error("[gateway] semantic cache write failed:", err)
  }
}

async function writeCache(
  key: string,
  task: string,
  provider: string,
  model: string,
  response: string,
  inputTokens: number,
  outputTokens: number,
  ttlSeconds: number,
) {
  try {
    const admin = createAdminClient()
    await admin.from("ai_response_cache").upsert(
      {
        cache_key: key,
        task,
        provider,
        model,
        response,
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        expires_at: new Date(Date.now() + ttlSeconds * 1000).toISOString(),
      },
      { onConflict: "cache_key" },
    )
  } catch (err) {
    console.error("[gateway] cache write failed:", err)
  }
}

/** Fire-and-forget: telemetry must never delay or break a student's response. */
function recordUsage(params: {
  userId?: string | null
  task: string
  agent?: string
  provider: string
  model: string
  inputTokens: number
  outputTokens: number
  latencyMs: number
  success: boolean
  error?: string
  cacheHit: boolean
  fallbackDepth: number
  metadata?: Record<string, unknown>
}) {
  void (async () => {
    try {
      const admin = createAdminClient()
      await admin.rpc("record_ai_usage", {
        p_user_id: params.userId ?? null,
        p_task: params.task,
        p_agent: params.agent ?? null,
        p_provider: params.provider,
        p_model: params.model,
        p_input_tokens: params.inputTokens,
        p_output_tokens: params.outputTokens,
        p_latency_ms: params.latencyMs,
        p_success: params.success,
        p_error: params.error ?? null,
        p_cache_hit: params.cacheHit,
        p_fallback_depth: params.fallbackDepth,
        p_metadata: params.metadata ?? {},
      })
    } catch (err) {
      console.error("[gateway] usage logging failed:", err)
    }
  })()
}

export class AIGateway {
  async execute(request: AIRequest): Promise<AIResult> {
    const routes = getRoutes(request.task)
    const started = Date.now()

    // Caching is opt-in AND restricted to tasks with no user-specific context.
    // Both conditions must hold — an explicit `cacheable: true` on a personalised
    // task would otherwise leak one student's response to another.
    const mayCache =
      request.cacheable !== false &&
      CACHEABLE_TASKS.includes(request.task) &&
      !request.messages.some((m) => typeof m.content !== "string")

    const prompt = normalizePrompt(request.messages, request.system)
    const primary = routes[0]
    const key = mayCache ? cacheKey(request.task, primary.model, prompt) : null

    // Semantic lookup: catches "explain photosynthesis" vs "what is
    // photosynthesis". Tried only after the free exact-hash miss, because
    // embedding the query costs a (small) API call.
    if (key) {
      const exact = await readCache(key)
      if (!exact?.response) {
        const semantic = await readSemanticCache(request.task, prompt)
        if (semantic?.response) {
          recordUsage({
            userId: request.userId,
            task: request.task,
            agent: request.agent,
            provider: semantic.provider,
            model: semantic.model,
            inputTokens: 0,
            outputTokens: 0,
            latencyMs: Date.now() - started,
            success: true,
            cacheHit: true,
            fallbackDepth: 0,
            metadata: { ...request.metadata, semanticSimilarity: semantic.similarity },
          })
          return {
            text: semantic.response,
            provider: semantic.provider,
            model: semantic.model,
            inputTokens: 0,
            outputTokens: 0,
            latencyMs: Date.now() - started,
            cacheHit: true,
            fallbackDepth: 0,
          }
        }
      }
    }

    if (key) {
      const cached = await readCache(key)
      if (cached?.response) {
        recordUsage({
          userId: request.userId,
          task: request.task,
          agent: request.agent,
          provider: cached.provider,
          model: cached.model,
          inputTokens: 0,
          outputTokens: 0,
          latencyMs: Date.now() - started,
          success: true,
          cacheHit: true,
          fallbackDepth: 0,
          metadata: request.metadata,
        })
        return {
          text: cached.response,
          provider: cached.provider,
          model: cached.model,
          inputTokens: cached.input_tokens ?? 0,
          outputTokens: cached.output_tokens ?? 0,
          latencyMs: Date.now() - started,
          cacheHit: true,
          fallbackDepth: 0,
        }
      }
    }

    let lastError: unknown

    for (let depth = 0; depth < routes.length; depth++) {
      const route = routes[depth]
      try {
        const adapter = getAdapter(route.provider)
        const result = await adapter.generate({
          system: request.system,
          messages: request.messages,
          model: route.model,
          temperature: request.temperature ?? route.temperature,
          maxTokens: request.maxTokens ?? route.maxTokens,
          json: request.json,
        })

        recordUsage({
          userId: request.userId,
          task: request.task,
          agent: request.agent,
          provider: route.provider,
          model: route.model,
          inputTokens: result.inputTokens,
          outputTokens: result.outputTokens,
          latencyMs: result.latencyMs,
          success: true,
          cacheHit: false,
          fallbackDepth: depth,
          metadata: request.metadata,
        })

        if (key && result.text) {
          void writeSemanticCache(
            request.task,
            prompt,
            route.provider,
            route.model,
            result.text,
            result.inputTokens,
            result.outputTokens,
            request.cacheTtlSeconds ?? DEFAULT_CACHE_TTL_SECONDS,
          )
          void writeCache(
            key,
            request.task,
            route.provider,
            route.model,
            result.text,
            result.inputTokens,
            result.outputTokens,
            request.cacheTtlSeconds ?? DEFAULT_CACHE_TTL_SECONDS,
          )
        }

        return { ...result, provider: route.provider, model: route.model, cacheHit: false, fallbackDepth: depth }
      } catch (error) {
        lastError = error
        console.error(`[gateway] route ${depth} (${route.provider}/${route.model}) failed:`, error)

        recordUsage({
          userId: request.userId,
          task: request.task,
          agent: request.agent,
          provider: route.provider,
          model: route.model,
          inputTokens: 0,
          outputTokens: 0,
          latencyMs: Date.now() - started,
          success: false,
          error: error instanceof Error ? error.message.slice(0, 500) : "unknown",
          cacheHit: false,
          fallbackDepth: depth,
          metadata: request.metadata,
        })
      }
    }

    throw new Error(`AI execution failed after ${routes.length} route(s): ${String(lastError)}`)
  }

  /** Convenience: returns text only. */
  async generate(request: AIRequest): Promise<string> {
    return (await this.execute(request)).text
  }
}

export const aiGateway = new AIGateway()

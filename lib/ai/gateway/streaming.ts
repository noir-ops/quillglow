/**
 * Streaming AI responses — spec §25.
 *
 * "AI responses should stream rather than waiting for the entire response."
 * Perceived latency is what matters: first token in ~300ms beats a complete
 * answer in 4s, especially on the mobile bandwidth this platform targets.
 *
 * Streaming deliberately bypasses the response cache — you cannot meaningfully
 * cache a stream mid-flight — but it still records full usage on completion, so
 * cost tracking (§26) stays accurate.
 */

import { createAdminClient } from "@/lib/supabase/admin"
import { getRoutes } from "./router"
import type { AIAgent, AITask } from "./types"

const OPENAI_BASE_URL = process.env.OPENAI_BASE_URL || "https://api.openai.com/v1"
const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta"
const GROQ_BASE_URL = "https://api.groq.com/openai/v1"

export interface StreamRequest {
  task: AITask
  messages: Array<{ role: string; content: any }>
  system?: string
  userId?: string | null
  agent?: AIAgent
  maxTokens?: number
  temperature?: number
}

function estimateTokens(text: string): number {
  return Math.ceil((text?.length ?? 0) / 4)
}

function isReasoningModel(model: string): boolean {
  return /^(gpt-5|o1|o3|o4)/i.test(model)
}

function vendorFor(layer: string): string {
  const explicit = process.env[`${layer.toUpperCase()}_VENDOR`]
  if (explicit) return explicit.toLowerCase()
  return layer === "long_context" ? "gemini" : "openai"
}

function recordUsage(p: {
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
}) {
  void (async () => {
    try {
      const admin = createAdminClient()
      await admin.rpc("record_ai_usage", {
        p_user_id: p.userId ?? null,
        p_task: p.task,
        p_agent: p.agent ?? null,
        p_provider: p.provider,
        p_model: p.model,
        p_input_tokens: p.inputTokens,
        p_output_tokens: p.outputTokens,
        p_latency_ms: p.latencyMs,
        p_success: p.success,
        p_error: p.error ?? null,
        p_cache_hit: false,
        p_fallback_depth: 0,
        p_metadata: { streamed: true },
      })
    } catch (err) {
      console.error("[stream] usage logging failed:", err)
    }
  })()
}

/** Parse an OpenAI-style SSE chunk into its text delta. */
function parseOpenAIChunk(line: string): string | null {
  if (!line.startsWith("data:")) return null
  const payload = line.slice(5).trim()
  if (!payload || payload === "[DONE]") return null
  try {
    return JSON.parse(payload)?.choices?.[0]?.delta?.content ?? null
  } catch {
    return null
  }
}

function parseGeminiChunk(line: string): string | null {
  if (!line.startsWith("data:")) return null
  const payload = line.slice(5).trim()
  if (!payload) return null
  try {
    const parts = JSON.parse(payload)?.candidates?.[0]?.content?.parts ?? []
    return parts.map((p: any) => p?.text ?? "").join("") || null
  } catch {
    return null
  }
}

/**
 * Returns a `ReadableStream` of plain text deltas, suitable for returning
 * directly from a route handler.
 */
export async function streamAI(request: StreamRequest): Promise<Response> {
  const route = getRoutes(request.task)[0]
  const vendor = vendorFor(route.provider)
  const started = Date.now()

  const messages = request.messages.filter((m) => m.role !== "system")
  const systemText =
    request.system ??
    request.messages
      .filter((m) => m.role === "system")
      .map((m) => (typeof m.content === "string" ? m.content : ""))
      .join("\n\n")

  let upstream: Response
  let isGemini = false

  if (vendor === "gemini") {
    isGemini = true
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) throw new Error("GEMINI_API_KEY is not configured")

    const body: Record<string, unknown> = {
      contents: messages.map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: typeof m.content === "string" ? m.content : JSON.stringify(m.content) }],
      })),
      generationConfig: {
        temperature: request.temperature ?? route.temperature,
        maxOutputTokens: request.maxTokens ?? route.maxTokens,
      },
    }
    if (systemText) body.systemInstruction = { parts: [{ text: systemText }] }

    upstream = await fetch(
      `${GEMINI_BASE_URL}/models/${encodeURIComponent(route.model)}:streamGenerateContent?alt=sse`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify(body),
      },
    )
  } else {
    const baseUrl = vendor === "groq" ? GROQ_BASE_URL : OPENAI_BASE_URL
    const keyEnv = vendor === "groq" ? "GROQ_API_KEY" : "OPENAI_API_KEY"
    const apiKey = process.env[keyEnv]
    if (!apiKey) throw new Error(`${keyEnv} is not configured`)

    const payload: Record<string, unknown> = {
      model: route.model,
      messages: systemText ? [{ role: "system", content: systemText }, ...messages] : messages,
      stream: true,
    }
    if (isReasoningModel(route.model)) {
      payload.max_completion_tokens = Math.max(request.maxTokens ?? route.maxTokens, 2048)
    } else {
      payload.max_tokens = request.maxTokens ?? route.maxTokens
      payload.temperature = request.temperature ?? route.temperature
    }

    upstream = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(payload),
    })
  }

  if (!upstream.ok || !upstream.body) {
    const detail = await upstream.text().catch(() => "")
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
      error: `stream failed ${upstream.status}: ${detail.slice(0, 300)}`,
    })
    throw new Error(`Streaming failed (${upstream.status})`)
  }

  const decoder = new TextDecoder()
  const encoder = new TextEncoder()
  const reader = upstream.body.getReader()
  let full = ""
  let buffer = ""

  const stream = new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        // Loop until we actually emit something or the upstream ends.
        //
        // A network chunk can end mid-JSON (e.g. `data: {"choices":[{"delta":{"con`),
        // producing no complete line and therefore no enqueue. Returning from
        // pull() without enqueuing stalls the stream, so keep reading until
        // there is real output.
        // eslint-disable-next-line no-constant-condition
        while (true) {
        const { done, value } = await reader.read()

        if (done) {
          // Log the complete request only once the stream finishes, so cost
          // tracking stays accurate even though nothing was cached.
          recordUsage({
            userId: request.userId,
            task: request.task,
            agent: request.agent,
            provider: route.provider,
            model: route.model,
            inputTokens: estimateTokens(JSON.stringify(messages) + systemText),
            outputTokens: estimateTokens(full),
            latencyMs: Date.now() - started,
            success: true,
          })
          controller.close()
          return
        }

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split("\n")
        // Keep the last (possibly partial) line for the next chunk.
        buffer = lines.pop() ?? ""

        let emitted = false
        for (const line of lines) {
          const delta = isGemini ? parseGeminiChunk(line) : parseOpenAIChunk(line)
          if (delta) {
            full += delta
            controller.enqueue(encoder.encode(delta))
            emitted = true
          }
        }

        if (emitted) return
        }
      } catch (err) {
        recordUsage({
          userId: request.userId,
          task: request.task,
          agent: request.agent,
          provider: route.provider,
          model: route.model,
          inputTokens: 0,
          outputTokens: estimateTokens(full),
          latencyMs: Date.now() - started,
          success: false,
          error: err instanceof Error ? err.message.slice(0, 300) : "stream error",
        })
        controller.error(err)
      }
    },
    cancel() {
      // The student navigated away — stop paying for tokens nobody will read.
      void reader.cancel()
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  })
}

/**
 * Central AI provider layer for QuillGlow.
 *
 * Every AI feature in the app goes through `aiChatCompletion()`. The active
 * provider (OpenAI, Gemini, or an open-source/OpenAI-compatible endpoint) and
 * the model are chosen by the admin in the admin panel (Admin → APIs) and
 * stored in the `ai_provider_settings` table.
 *
 * `aiChatCompletion()` accepts an OpenAI-style chat-completions body and
 * always resolves to a standard `Response` whose JSON body is in OpenAI
 * chat-completions shape:
 *   { choices: [{ message: { role, content } }], usage: {...} }
 *
 * This means calling code stays identical regardless of which provider is
 * active — Gemini requests/responses are translated transparently, and the
 * open-source path is a direct pass-through since it already speaks this
 * format.
 */

import { createAdminClient } from "@/lib/supabase/admin"

export type AIProvider = "openai" | "gemini" | "opensource"

export interface AIProviderConfig {
  provider: AIProvider
  openaiModel: string
  openaiVisionModel: string | null
  openaiReasoningEffort: string | null
  geminiModel: string
  geminiVisionModel: string | null
  opensourceBaseUrl: string | null
  opensourceModel: string | null
}

/** Used only when the settings row is missing or the DB is unreachable. */
const DEFAULTS: AIProviderConfig = {
  provider: (process.env.AI_PROVIDER as AIProvider) || "openai",
  openaiModel: process.env.OPENAI_MODEL || "gpt-4.1-mini",
  openaiVisionModel: null,
  openaiReasoningEffort: "low",
  geminiModel: process.env.GEMINI_MODEL || "gemini-2.5-flash",
  geminiVisionModel: null,
  opensourceBaseUrl: process.env.OPEN_SOURCE_MODEL_BASE_URL || null,
  opensourceModel: process.env.OPEN_SOURCE_MODEL_NAME || null,
}

const OPENAI_BASE_URL = process.env.OPENAI_BASE_URL || "https://api.openai.com/v1"
const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta"

// ── Settings cache ──────────────────────────────────────────────────────────
// The settings change rarely but are read on every AI request, so cache them
// briefly in memory. A short TTL means an admin change takes effect quickly.
const CACHE_TTL_MS = 30_000
let cached: { value: AIProviderConfig; at: number } | null = null

export function clearAIProviderConfigCache() {
  cached = null
}

export async function getAIProviderConfig(): Promise<AIProviderConfig> {
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.value

  try {
    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from("ai_provider_settings")
      .select("*")
      .eq("id", "global")
      .maybeSingle()

    if (error || !data) {
      cached = { value: DEFAULTS, at: Date.now() }
      return DEFAULTS
    }

    const value: AIProviderConfig = {
      provider:
        data.active_provider === "gemini" ? "gemini" : data.active_provider === "opensource" ? "opensource" : "openai",
      openaiModel: data.openai_model || DEFAULTS.openaiModel,
      openaiVisionModel: data.openai_vision_model || null,
      openaiReasoningEffort: data.openai_reasoning_effort || "low",
      geminiModel: data.gemini_model || DEFAULTS.geminiModel,
      geminiVisionModel: data.gemini_vision_model || null,
      opensourceBaseUrl: data.opensource_base_url || DEFAULTS.opensourceBaseUrl,
      opensourceModel: data.opensource_model || DEFAULTS.opensourceModel,
    }
    cached = { value, at: Date.now() }
    return value
  } catch (err) {
    console.error("[ai/provider] Failed to load AI settings, using defaults:", err)
    cached = { value: DEFAULTS, at: Date.now() }
    return DEFAULTS
  }
}

// ── Request/response types ──────────────────────────────────────────────────

export type ChatMessageContent =
  | string
  | Array<
      | { type: "text"; text: string }
      | { type: "image_url"; image_url: { url: string } }
    >

export interface ChatMessage {
  role: "system" | "user" | "assistant"
  content: ChatMessageContent
}

export interface ChatCompletionBody {
  /** Ignored — the model is resolved from the admin settings. */
  model?: string
  messages: ChatMessage[] | any[]
  temperature?: number
  top_p?: number
  max_tokens?: number
  response_format?: { type: string }
}

export interface AICallOptions {
  /**
   * Hint that the request contains images. When set, the provider's dedicated
   * vision model is used if the admin configured one. Both current OpenAI and
   * Gemini default models are multimodal, so this is usually unnecessary.
   */
  needsVision?: boolean
  /**
   * Declaring a task opts this call into the AI Gateway: task-based model
   * routing, fallback, caching and cost tracking. Omit it to use the direct
   * admin-configured provider path.
   */
  task?: import("@/lib/ai/gateway/types").AITask
  agent?: import("@/lib/ai/gateway/types").AIAgent
  userId?: string | null
}

// ── Helpers ─────────────────────────────────────────────────────────────────

/**
 * OpenAI reasoning models (the gpt-5 family, o1/o3/o4) use
 * `max_completion_tokens` instead of `max_tokens` and reject a custom
 * `temperature`/`top_p`.
 */
function isReasoningModel(model: string): boolean {
  return /^(gpt-5|o1|o3|o4)/i.test(model)
}

function messagesContainImages(messages: any[]): boolean {
  return messages.some(
    (m) =>
      Array.isArray(m?.content) &&
      m.content.some((part: any) => part?.type === "image_url" || part?.type === "input_image"),
  )
}

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  })
}

function errorResponse(message: string, status = 500): Response {
  return new Response(JSON.stringify({ error: { message } }), {
    status,
    headers: { "Content-Type": "application/json" },
  })
}

// ── OpenAI ──────────────────────────────────────────────────────────────────

async function callOpenAI(body: ChatCompletionBody, model: string, config: AIProviderConfig): Promise<Response> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) return errorResponse("OPENAI_API_KEY is not configured", 500)

  const payload: Record<string, unknown> = {
    model,
    messages: body.messages,
  }

  if (body.response_format) payload.response_format = body.response_format

  if (isReasoningModel(model)) {
    // Reasoning tokens are counted inside max_completion_tokens, so a very
    // small cap can be consumed entirely before any visible text is produced.
    // Keep a sane floor.
    const requested = body.max_tokens ?? 2048
    payload.max_completion_tokens = Math.max(requested, 2048)
    if (config.openaiReasoningEffort) {
      payload.reasoning_effort = config.openaiReasoningEffort
    }
    // temperature / top_p are intentionally omitted — not supported.
  } else {
    if (body.max_tokens != null) payload.max_tokens = body.max_tokens
    if (body.temperature != null) payload.temperature = body.temperature
    if (body.top_p != null) payload.top_p = body.top_p
  }

  return fetch(`${OPENAI_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
  })
}

// ── Gemini ──────────────────────────────────────────────────────────────────

function dataUrlToInlineData(url: string): { mimeType: string; data: string } | null {
  const match = url.match(/^data:([^;]+);base64,(.*)$/)
  if (!match) return null
  return { mimeType: match[1], data: match[2] }
}

function toGeminiParts(content: ChatMessageContent): any[] {
  if (typeof content === "string") return [{ text: content }]

  const parts: any[] = []
  for (const part of content) {
    if (part?.type === "text") {
      parts.push({ text: part.text })
    } else if (part?.type === "image_url") {
      const url = part.image_url?.url ?? ""
      const inline = dataUrlToInlineData(url)
      if (inline) {
        parts.push({ inlineData: inline })
      } else if (url) {
        // Remote URL — Gemini needs inline bytes, so pass the link as text.
        parts.push({ text: `Image URL: ${url}` })
      }
    }
  }
  return parts.length ? parts : [{ text: "" }]
}

async function callGemini(body: ChatCompletionBody, model: string): Promise<Response> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return errorResponse("GEMINI_API_KEY is not configured", 500)

  const systemTexts: string[] = []
  const contents: any[] = []

  for (const message of body.messages as ChatMessage[]) {
    if (message.role === "system") {
      systemTexts.push(typeof message.content === "string" ? message.content : JSON.stringify(message.content))
      continue
    }
    contents.push({
      role: message.role === "assistant" ? "model" : "user",
      parts: toGeminiParts(message.content),
    })
  }

  // Gemini requires at least one content entry.
  if (contents.length === 0) contents.push({ role: "user", parts: [{ text: "" }] })

  const generationConfig: Record<string, unknown> = {}
  if (body.temperature != null) generationConfig.temperature = body.temperature
  if (body.top_p != null) generationConfig.topP = body.top_p
  if (body.max_tokens != null) generationConfig.maxOutputTokens = body.max_tokens
  if (body.response_format?.type === "json_object") {
    generationConfig.responseMimeType = "application/json"
  }

  const payload: Record<string, unknown> = { contents, generationConfig }
  if (systemTexts.length) {
    payload.systemInstruction = { parts: [{ text: systemTexts.join("\n\n") }] }
  }

  const res = await fetch(`${GEMINI_BASE_URL}/models/${encodeURIComponent(model)}:generateContent`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify(payload),
  })

  if (!res.ok) {
    const errorText = await res.text()
    return new Response(errorText, {
      status: res.status,
      headers: { "Content-Type": "application/json" },
    })
  }

  const data = await res.json()
  const candidate = data?.candidates?.[0]
  const text: string = (candidate?.content?.parts ?? [])
    .map((p: any) => p?.text ?? "")
    .join("")

  // Translate into OpenAI chat-completions shape so callers need no changes.
  return jsonResponse({
    id: data?.responseId ?? "gemini-response",
    object: "chat.completion",
    model,
    choices: [
      {
        index: 0,
        message: { role: "assistant", content: text },
        finish_reason: String(candidate?.finishReason ?? "stop").toLowerCase(),
      },
    ],
    usage: {
      prompt_tokens: data?.usageMetadata?.promptTokenCount ?? 0,
      completion_tokens: data?.usageMetadata?.candidatesTokenCount ?? 0,
      total_tokens: data?.usageMetadata?.totalTokenCount ?? 0,
    },
  })
}

// ── Open-source model (any OpenAI-compatible endpoint) ─────────────────────

async function callOpenSource(body: ChatCompletionBody, model: string, config: AIProviderConfig): Promise<Response> {
  const baseUrl = config.opensourceBaseUrl
  if (!baseUrl) return errorResponse("No open-source model base URL configured", 500)

  const apiKey = process.env.OPEN_SOURCE_MODEL_API_KEY // optional — many self-hosted servers need none

  const payload: Record<string, unknown> = { model, messages: body.messages }
  if (body.max_tokens != null) payload.max_tokens = body.max_tokens
  if (body.temperature != null) payload.temperature = body.temperature
  if (body.top_p != null) payload.top_p = body.top_p
  if (body.response_format) payload.response_format = body.response_format

  return fetch(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
    },
    body: JSON.stringify(payload),
  })
}

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Drop-in replacement for a direct chat-completions `fetch()`.
 * Routes the request to whichever provider/model the admin has activated.
 */
export async function aiChatCompletion(body: ChatCompletionBody, options: AICallOptions = {}): Promise<Response> {
  // Route through the AI Gateway when a task is supplied. The gateway adds
  // task-based model routing, automatic fallback, response caching and
  // token/cost tracking (spec §9, §15, §26, §27) without changing this
  // function's contract — callers still receive an OpenAI-shaped Response.
  if (options.task) {
    try {
      const { aiGateway } = await import("@/lib/ai/gateway")
      const messages = (body.messages as any[]).filter((m) => m.role !== "system")
      const system = (body.messages as any[])
        .filter((m) => m.role === "system")
        .map((m) => (typeof m.content === "string" ? m.content : JSON.stringify(m.content)))
        .join("\n\n")

      const result = await aiGateway.execute({
        task: options.task,
        agent: options.agent,
        userId: options.userId ?? null,
        system: system || undefined,
        messages,
        json: body.response_format?.type === "json_object",
        maxTokens: body.max_tokens,
        temperature: body.temperature,
      })

      return jsonResponse({
        id: "gateway-response",
        object: "chat.completion",
        model: result.model,
        choices: [
          { index: 0, message: { role: "assistant", content: result.text }, finish_reason: "stop" },
        ],
        usage: {
          prompt_tokens: result.inputTokens,
          completion_tokens: result.outputTokens,
          total_tokens: result.inputTokens + result.outputTokens,
        },
      })
    } catch (err) {
      console.error("[ai/provider] gateway failed, falling back to direct provider:", err)
      // Fall through to the direct path rather than failing the request.
    }
  }

  const config = await getAIProviderConfig()
  const needsVision = options.needsVision ?? messagesContainImages(body.messages as any[])

  try {
    if (config.provider === "gemini") {
      const model = (needsVision && config.geminiVisionModel) || config.geminiModel
      return await callGemini(body, model)
    }
    if (config.provider === "opensource") {
      const model = config.opensourceModel
      if (!model) return errorResponse("No open-source model configured", 500)
      return await callOpenSource(body, model, config)
    }
    const model = (needsVision && config.openaiVisionModel) || config.openaiModel
    return await callOpenAI(body, model, config)
  } catch (err) {
    console.error("[ai/provider] Request failed:", err)
    return errorResponse(err instanceof Error ? err.message : "AI request failed", 500)
  }
}

/**
 * Convenience wrapper returning the assistant text directly.
 * Throws on a non-OK response.
 */
export async function aiGenerateText(
  body: ChatCompletionBody,
  options: AICallOptions = {},
): Promise<string> {
  const res = await aiChatCompletion(body, options)
  if (!res.ok) {
    throw new Error(`AI provider error: ${await res.text()}`)
  }
  const data = await res.json()
  return data?.choices?.[0]?.message?.content ?? ""
}

/** True when the active provider has its API key (or, for opensource, base URL) configured. */
export async function isAIConfigured(): Promise<boolean> {
  const config = await getAIProviderConfig()
  if (config.provider === "gemini") return !!process.env.GEMINI_API_KEY
  if (config.provider === "opensource") return !!config.opensourceBaseUrl && !!config.opensourceModel
  return !!process.env.OPENAI_API_KEY
}

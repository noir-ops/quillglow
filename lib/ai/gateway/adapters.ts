/**
 * Provider adapters — spec §12.
 *
 * Each vendor implements the same interface, so swapping one is configuration,
 * not a rewrite. Token counts come back from the vendor where available and are
 * estimated otherwise, since cost tracking (§26) depends on them.
 */

import type { AIMessage, AIProviderAdapter } from "./types"

const OPENAI_BASE_URL = process.env.OPENAI_BASE_URL || "https://api.openai.com/v1"
const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta"
const GROQ_BASE_URL = "https://api.groq.com/openai/v1"

/** ~4 chars per token. Only used when a vendor omits usage data. */
function estimateTokens(text: string): number {
  return Math.ceil((text?.length ?? 0) / 4)
}

function isReasoningModel(model: string): boolean {
  return /^(gpt-5|o1|o3|o4)/i.test(model)
}

/** OpenAI-compatible chat completions — covers OpenAI and Groq. */
function openAICompatibleAdapter(baseUrl: string, apiKeyEnv: string): AIProviderAdapter {
  return {
    async generate({ system, messages, model, temperature, maxTokens, json }) {
      const apiKey = process.env[apiKeyEnv]
      if (!apiKey) throw new Error(`${apiKeyEnv} is not configured`)

      const payload: Record<string, unknown> = {
        model,
        messages: system ? [{ role: "system", content: system }, ...messages] : messages,
      }
      if (json) payload.response_format = { type: "json_object" }

      if (isReasoningModel(model)) {
        // Reasoning tokens count against the cap, so a low limit can consume the
        // whole budget before any visible output.
        payload.max_completion_tokens = Math.max(maxTokens ?? 2048, 2048)
        payload.reasoning_effort = process.env.REASONING_EFFORT || "low"
      } else {
        if (maxTokens != null) payload.max_tokens = maxTokens
        if (temperature != null) payload.temperature = temperature
      }

      const started = Date.now()
      const res = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify(payload),
      })

      if (!res.ok) throw new Error(`${baseUrl} error ${res.status}: ${await res.text()}`)

      const data = await res.json()
      const text = data?.choices?.[0]?.message?.content ?? ""

      return {
        text,
        inputTokens: data?.usage?.prompt_tokens ?? estimateTokens(JSON.stringify(messages)),
        outputTokens: data?.usage?.completion_tokens ?? estimateTokens(text),
        latencyMs: Date.now() - started,
      }
    },
  }
}

function geminiAdapter(): AIProviderAdapter {
  return {
    async generate({ system, messages, model, temperature, maxTokens, json }) {
      const apiKey = process.env.GEMINI_API_KEY
      if (!apiKey) throw new Error("GEMINI_API_KEY is not configured")

      const systemTexts: string[] = system ? [system] : []
      const contents: any[] = []

      for (const m of messages as AIMessage[]) {
        if (m.role === "system") {
          systemTexts.push(typeof m.content === "string" ? m.content : JSON.stringify(m.content))
          continue
        }
        const parts =
          typeof m.content === "string"
            ? [{ text: m.content }]
            : (m.content as any[]).map((p: any) => {
                if (p?.type === "text") return { text: p.text }
                if (p?.type === "image_url") {
                  const match = String(p.image_url?.url ?? "").match(/^data:([^;]+);base64,(.*)$/)
                  return match ? { inlineData: { mimeType: match[1], data: match[2] } } : { text: "" }
                }
                return { text: "" }
              })
        contents.push({ role: m.role === "assistant" ? "model" : "user", parts })
      }

      if (contents.length === 0) contents.push({ role: "user", parts: [{ text: "" }] })

      const generationConfig: Record<string, unknown> = {}
      if (temperature != null) generationConfig.temperature = temperature
      if (maxTokens != null) generationConfig.maxOutputTokens = maxTokens
      if (json) generationConfig.responseMimeType = "application/json"

      const body: Record<string, unknown> = { contents, generationConfig }
      if (systemTexts.length) body.systemInstruction = { parts: [{ text: systemTexts.join("\n\n") }] }

      const started = Date.now()
      const res = await fetch(`${GEMINI_BASE_URL}/models/${encodeURIComponent(model)}:generateContent`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify(body),
      })

      if (!res.ok) throw new Error(`Gemini error ${res.status}: ${await res.text()}`)

      const data = await res.json()
      const text = (data?.candidates?.[0]?.content?.parts ?? [])
        .map((p: any) => p?.text ?? "")
        .join("")

      return {
        text,
        inputTokens: data?.usageMetadata?.promptTokenCount ?? estimateTokens(JSON.stringify(messages)),
        outputTokens: data?.usageMetadata?.candidatesTokenCount ?? estimateTokens(text),
        latencyMs: Date.now() - started,
      }
    },
  }
}

/**
 * Which vendor backs each routing layer. This is the ONLY place vendors are
 * named — changing a layer's vendor is an env change here, nothing else.
 */
export function getAdapter(layer: string): AIProviderAdapter {
  const vendor = (process.env[`${layer.toUpperCase()}_VENDOR`] || defaultVendor(layer)).toLowerCase()

  switch (vendor) {
    case "gemini":
      return geminiAdapter()
    case "groq":
      return openAICompatibleAdapter(GROQ_BASE_URL, "GROQ_API_KEY")
    case "openai":
    default:
      return openAICompatibleAdapter(OPENAI_BASE_URL, "OPENAI_API_KEY")
  }
}

function defaultVendor(layer: string): string {
  if (layer === "long_context") return "gemini"
  return "openai"
}

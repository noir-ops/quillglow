/** Shared rules for the OpenAI-compatible endpoint. Credentials stay in env. */
export function normalizeOpenSourceBaseUrl(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) throw new Error("Set an OpenAI-compatible base URL")
  let url: URL
  try { url = new URL(value.trim()) } catch { throw new Error("Base URL must be a valid http(s) URL") }
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
    throw new Error("Base URL must use http(s), without credentials, query parameters, or a fragment")
  }
  if (/\/(chat\/completions|models)\/?$/.test(url.pathname)) {
    throw new Error("Use the API base URL (usually ending in /v1), not /models or /chat/completions")
  }
  return url.toString().replace(/\/+$/, "")
}

export function openSourceHeaders(): Record<string, string> {
  const key = process.env.OPEN_SOURCE_MODEL_API_KEY?.trim()
  return { "Content-Type": "application/json", ...(key ? { Authorization: `Bearer ${key}` } : {}) }
}

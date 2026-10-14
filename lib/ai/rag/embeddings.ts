/**
 * Embedding provider — the vector counterpart to `lib/ai/provider.ts`.
 *
 * IMPORTANT DIFFERENCE FROM THE CHAT PROVIDER:
 * The chat model can be switched freely in the admin panel because each request
 * is independent. Embeddings are not like that — vectors from different models
 * live in different spaces and cannot be compared. Switching the embedding model
 * invalidates the entire indexed corpus and requires a full re-index.
 *
 * So the embedding model is configured separately (`EMBEDDING_PROVIDER`), and
 * every stored chunk records which model produced it. Retrieval filters on that,
 * so a mid-flight switch degrades to "no results" rather than silently returning
 * meaningless nearest neighbours.
 *
 * Both providers are normalised to 1536 dimensions:
 *   - OpenAI text-embedding-3-small is natively 1536.
 *   - gemini-embedding-001 defaults to 3072 but supports Matryoshka truncation.
 *     Google's docs are explicit that truncated vectors below 3072 are NOT
 *     pre-normalised, so we L2-normalise them ourselves — skipping this quietly
 *     corrupts cosine similarity.
 */

export const EMBEDDING_DIMENSIONS = 1536

export type EmbeddingProvider = "openai" | "gemini"

export interface EmbeddingConfig {
  provider: EmbeddingProvider
  model: string
}

const OPENAI_BASE_URL = process.env.OPENAI_BASE_URL || "https://api.openai.com/v1"
const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta"

/**
 * Read from env rather than the database, deliberately: this must not be
 * changeable with a click in the admin panel, because changing it silently
 * invalidates every stored vector.
 */
export function getEmbeddingConfig(): EmbeddingConfig {
  const provider = (process.env.EMBEDDING_PROVIDER as EmbeddingProvider) || "openai"
  const model =
    process.env.EMBEDDING_MODEL ||
    (provider === "gemini" ? "gemini-embedding-001" : "text-embedding-3-small")
  return { provider, model }
}

/** Identifier stored on each chunk and used to filter retrieval. */
export function getEmbeddingModelId(): string {
  return getEmbeddingConfig().model
}

/** L2-normalise so cosine similarity behaves. Required for truncated Gemini vectors. */
function l2Normalize(vec: number[]): number[] {
  let sum = 0
  for (const v of vec) sum += v * v
  const norm = Math.sqrt(sum)
  if (norm === 0) return vec
  return vec.map((v) => v / norm)
}

/** Task hint. Retrieval quality improves when query and document are embedded differently. */
export type EmbeddingTask = "document" | "query"

async function embedOpenAI(texts: string[], model: string): Promise<number[][]> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error("OPENAI_API_KEY is not configured")

  const res = await fetch(`${OPENAI_BASE_URL}/embeddings`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model, input: texts, dimensions: EMBEDDING_DIMENSIONS }),
  })

  if (!res.ok) throw new Error(`OpenAI embeddings failed: ${await res.text()}`)

  const data = await res.json()
  // The API does not guarantee ordering; sort by index before mapping.
  return (data.data as Array<{ index: number; embedding: number[] }>)
    .sort((a, b) => a.index - b.index)
    .map((d) => d.embedding)
}

async function embedGemini(
  texts: string[],
  model: string,
  task: EmbeddingTask,
): Promise<number[][]> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error("GEMINI_API_KEY is not configured")

  const taskType = task === "query" ? "RETRIEVAL_QUERY" : "RETRIEVAL_DOCUMENT"

  const res = await fetch(`${GEMINI_BASE_URL}/models/${encodeURIComponent(model)}:batchEmbedContents`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
    body: JSON.stringify({
      requests: texts.map((text) => ({
        model: `models/${model}`,
        content: { parts: [{ text }] },
        taskType,
        outputDimensionality: EMBEDDING_DIMENSIONS,
      })),
    }),
  })

  if (!res.ok) throw new Error(`Gemini embeddings failed: ${await res.text()}`)

  const data = await res.json()
  // Truncated Gemini vectors are not pre-normalised — do it here.
  return (data.embeddings as Array<{ values: number[] }>).map((e) => l2Normalize(e.values))
}

/** Embed a batch of texts. Returns vectors in the same order as the input. */
export async function embedTexts(
  texts: string[],
  task: EmbeddingTask = "document",
): Promise<number[][]> {
  if (texts.length === 0) return []

  const { provider, model } = getEmbeddingConfig()

  // Both APIs cap batch size; chunk to stay well inside it.
  const BATCH = 96
  const out: number[][] = []

  for (let i = 0; i < texts.length; i += BATCH) {
    const slice = texts.slice(i, i + BATCH)
    const vectors =
      provider === "gemini"
        ? await embedGemini(slice, model, task)
        : await embedOpenAI(slice, model)

    for (const v of vectors) {
      if (v.length !== EMBEDDING_DIMENSIONS) {
        throw new Error(
          `Embedding dimension mismatch: got ${v.length}, expected ${EMBEDDING_DIMENSIONS}. ` +
            `Model ${model} may not support this dimension.`,
        )
      }
      out.push(v)
    }
  }

  return out
}

/** Embed a single string. */
export async function embedText(text: string, task: EmbeddingTask = "document"): Promise<number[]> {
  const [vec] = await embedTexts([text], task)
  return vec
}

/** True when the configured embedding provider has its key set. */
export function isEmbeddingConfigured(): boolean {
  const { provider } = getEmbeddingConfig()
  return provider === "gemini" ? !!process.env.GEMINI_API_KEY : !!process.env.OPENAI_API_KEY
}

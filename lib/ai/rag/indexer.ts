/**
 * Knowledge indexer: chunk → embed → store.
 *
 * Chunking strategy: paragraph-aware with overlap. Splitting mid-sentence
 * produces chunks that retrieve poorly because the embedding captures a
 * fragment of an idea. Overlap keeps context that straddles a boundary
 * reachable from either side.
 */

import { createAdminClient } from "@/lib/supabase/admin"
import { EMBEDDING_DIMENSIONS, embedTexts, getEmbeddingModelId } from "./embeddings"

export interface IndexSourceInput {
  namespace: string
  title: string
  content: string
  ownerId?: string | null
  sourceType?: string
  uri?: string | null
  conceptId?: string | null
  metadata?: Record<string, unknown>
}

const TARGET_CHARS = 1200
const OVERLAP_CHARS = 200

/** Split text into overlapping, paragraph-aligned chunks. */
export function chunkText(text: string, targetChars = TARGET_CHARS, overlap = OVERLAP_CHARS): string[] {
  const clean = text.replace(/\r\n/g, "\n").trim()
  if (!clean) return []
  if (clean.length <= targetChars) return [clean]

  const paragraphs = clean.split(/\n\s*\n/)
  const chunks: string[] = []
  let current = ""

  const flush = () => {
    const trimmed = current.trim()
    if (trimmed) chunks.push(trimmed)
    // Carry the tail forward so cross-boundary context stays retrievable.
    current = overlap > 0 && trimmed.length > overlap ? trimmed.slice(-overlap) : ""
  }

  for (const para of paragraphs) {
    // A single oversized paragraph: split on sentence boundaries.
    if (para.length > targetChars) {
      if (current) flush()
      const sentences = para.match(/[^.!?]+[.!?]+|\S+$/g) ?? [para]
      for (const sentence of sentences) {
        if (current.length + sentence.length > targetChars) flush()
        current += sentence
      }
      continue
    }

    if (current.length + para.length + 2 > targetChars) flush()
    current += (current ? "\n\n" : "") + para
  }

  const tail = current.trim()
  if (tail) chunks.push(tail)

  return chunks.filter((c) => c.length > 20)
}

/** Cheap content hash so unchanged sources aren't re-embedded. */
function checksum(text: string): string {
  let h1 = 0xdeadbeef
  let h2 = 0x41c6ce57
  for (let i = 0; i < text.length; i++) {
    const ch = text.charCodeAt(i)
    h1 = Math.imul(h1 ^ ch, 2654435761)
    h2 = Math.imul(h2 ^ ch, 1597334677)
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909)
  return (
    (h2 >>> 0).toString(16).padStart(8, "0") +
    (h1 >>> 0).toString(16).padStart(8, "0") +
    text.length.toString(16)
  )
}

export interface IndexResult {
  sourceId: string
  chunks: number
  skipped: boolean
}

/** Index one source. Skips work entirely if identical content is already indexed. */
export async function indexSource(input: IndexSourceInput): Promise<IndexResult> {
  const admin = createAdminClient()
  const sum = checksum(input.content)
  const model = getEmbeddingModelId()

  // Already indexed with this exact content and the current model?
  const { data: existing } = await admin
    .from("knowledge_sources")
    .select("id, status")
    .eq("namespace", input.namespace)
    .eq("checksum", sum)
    .maybeSingle()

  if (existing?.status === "indexed") {
    const { count } = await admin
      .from("knowledge_chunks")
      .select("id", { count: "exact", head: true })
      .eq("source_id", existing.id)
      .eq("embedding_model", model)

    if ((count ?? 0) > 0) {
      return { sourceId: existing.id, chunks: count ?? 0, skipped: true }
    }
  }

  const { data: source, error: srcErr } = await admin
    .from("knowledge_sources")
    .upsert(
      {
        id: existing?.id,
        namespace: input.namespace,
        owner_id: input.ownerId ?? null,
        title: input.title,
        source_type: input.sourceType ?? "text",
        uri: input.uri ?? null,
        concept_id: input.conceptId ?? null,
        checksum: sum,
        status: "indexing",
        metadata: input.metadata ?? {},
      },
      { onConflict: "id" },
    )
    .select()
    .single()

  if (srcErr || !source) throw new Error(`Failed to create source: ${srcErr?.message}`)

  try {
    const pieces = chunkText(input.content)
    if (pieces.length === 0) {
      await admin
        .from("knowledge_sources")
        .update({ status: "indexed", chunk_count: 0, indexed_at: new Date().toISOString() })
        .eq("id", source.id)
      return { sourceId: source.id, chunks: 0, skipped: false }
    }

    const vectors = await embedTexts(pieces, "document")

    // Replace any stale chunks for this source under the current model.
    await admin.from("knowledge_chunks").delete().eq("source_id", source.id).eq("embedding_model", model)

    const rows = pieces.map((content, i) => ({
      source_id: source.id,
      namespace: input.namespace,
      owner_id: input.ownerId ?? null,
      concept_id: input.conceptId ?? null,
      chunk_index: i,
      content,
      token_count: Math.ceil(content.length / 4),
      embedding: vectors[i],
      embedding_model: model,
      metadata: input.metadata ?? {},
    }))

    // Insert in batches — a large syllabus can produce thousands of chunks.
    for (let i = 0; i < rows.length; i += 100) {
      const { error } = await admin.from("knowledge_chunks").insert(rows.slice(i, i + 100))
      if (error) throw new Error(`Chunk insert failed: ${error.message}`)
    }

    await admin
      .from("knowledge_sources")
      .update({
        status: "indexed",
        chunk_count: rows.length,
        error: null,
        indexed_at: new Date().toISOString(),
      })
      .eq("id", source.id)

    return { sourceId: source.id, chunks: rows.length, skipped: false }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Indexing failed"
    await admin.from("knowledge_sources").update({ status: "failed", error: message }).eq("id", source.id)
    throw err
  }
}

export interface PendingSourceResult {
  processed: number
  chunks: number
  failed: number
  errors: Array<{ sourceId: string; error: string }>
}

/**
 * Process `knowledge_sources` rows left in status='pending' by a writer that
 * only queued content — e.g. the admin curriculum uploader, which stashes raw
 * text in `metadata.content` and stops there. Chunking and embedding are
 * deliberately NOT done at write time: the admin panel doesn't own the
 * embedding provider configuration, and a bulk syllabus import can be
 * thousands of chunks — too slow for a request/response cycle.
 *
 * Unlike `indexSource()`, this updates the EXISTING row rather than creating a
 * new one via checksum lookup, since the row (and its id) already exists.
 */
export async function processPendingSources(limit = 20): Promise<PendingSourceResult> {
  const admin = createAdminClient()
  const model = getEmbeddingModelId()

  const { data: pending, error: fetchErr } = await admin
    .from("knowledge_sources")
    .select("id, namespace, owner_id, concept_id, metadata")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(limit)

  if (fetchErr) throw new Error(`Failed to fetch pending sources: ${fetchErr.message}`)

  const result: PendingSourceResult = { processed: 0, chunks: 0, failed: 0, errors: [] }
  if (!pending?.length) return result

  for (const source of pending) {
    const content = String((source.metadata as any)?.content ?? "")

    if (!content.trim()) {
      // Nothing to embed. Mark indexed-with-zero rather than leaving it
      // pending forever and being retried every run.
      await admin
        .from("knowledge_sources")
        .update({ status: "indexed", chunk_count: 0, indexed_at: new Date().toISOString() })
        .eq("id", source.id)
      result.processed++
      continue
    }

    await admin.from("knowledge_sources").update({ status: "indexing" }).eq("id", source.id)

    try {
      const pieces = chunkText(content)
      const vectors = await embedTexts(pieces, "document")

      await admin.from("knowledge_chunks").delete().eq("source_id", source.id).eq("embedding_model", model)

      const rows = pieces.map((text, i) => ({
        source_id: source.id,
        namespace: source.namespace,
        owner_id: source.owner_id ?? null,
        concept_id: source.concept_id ?? null,
        chunk_index: i,
        content: text,
        token_count: Math.ceil(text.length / 4),
        embedding: vectors[i],
        embedding_model: model,
        metadata: source.metadata ?? {},
      }))

      for (let i = 0; i < rows.length; i += 100) {
        const { error } = await admin.from("knowledge_chunks").insert(rows.slice(i, i + 100))
        if (error) throw new Error(`Chunk insert failed: ${error.message}`)
      }

      await admin
        .from("knowledge_sources")
        .update({
          status: "indexed",
          chunk_count: rows.length,
          checksum: checksum(content),
          error: null,
          indexed_at: new Date().toISOString(),
        })
        .eq("id", source.id)

      result.processed++
      result.chunks += rows.length
    } catch (err) {
      const message = err instanceof Error ? err.message : "Indexing failed"
      await admin.from("knowledge_sources").update({ status: "failed", error: message }).eq("id", source.id)
      result.failed++
      result.errors.push({ sourceId: source.id, error: message })
    }
  }

  return result
}

/** Remove a source and its chunks. */
export async function deleteSource(sourceId: string): Promise<void> {
  const admin = createAdminClient()
  await admin.from("knowledge_sources").delete().eq("id", sourceId)
}

/** Per-namespace, per-model index health. Use this to spot corpora needing re-index. */
export async function getIndexStatus() {
  const admin = createAdminClient()
  const { data } = await admin.from("knowledge_index_status").select("*")
  return { activeModel: getEmbeddingModelId(), dimensions: EMBEDDING_DIMENSIONS, namespaces: data ?? [] }
}

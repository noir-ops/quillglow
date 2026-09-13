import { NextResponse } from "next/server"
import { processPendingSources } from "@/lib/ai/rag/indexer"

export const dynamic = "force-dynamic"
export const maxDuration = 300

/**
 * Processes knowledge_sources left in status='pending' — content queued for
 * indexing (e.g. by the admin curriculum uploader) but not yet chunked and
 * embedded into knowledge_chunks.
 *
 * Same CRON_SECRET pattern as /api/events/process. Add this to the same
 * scheduler on a short interval (every 1-5 minutes) so curriculum imports
 * become searchable shortly after upload rather than staying "pending"
 * indefinitely.
 */
async function authorize(req: Request): Promise<boolean> {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  return req.headers.get("authorization") === `Bearer ${secret}`
}

export async function POST(req: Request) {
  if (!(await authorize(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  try {
    const result = await processPendingSources(20)
    return NextResponse.json(result)
  } catch (err) {
    console.error("[knowledge/process-pending] error:", err)
    return NextResponse.json({ error: "Processing failed" }, { status: 500 })
  }
}

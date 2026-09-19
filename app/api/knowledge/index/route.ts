import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { indexSource } from "@/lib/ai/rag/indexer"

export const dynamic = "force-dynamic"
export const maxDuration = 300

/**
 * Index content into the knowledge base.
 * Students may only write to their own `user_upload` namespace — global
 * namespaces (syllabi, scholarships) are admin-managed.
 */
export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { title, content, conceptId, metadata } = await req.json()

    if (!title || !content) {
      return NextResponse.json({ error: "title and content are required" }, { status: 400 })
    }
    if (typeof content !== "string" || content.length > 500_000) {
      return NextResponse.json({ error: "content too large" }, { status: 413 })
    }

    const result = await indexSource({
      namespace: "user_upload",
      ownerId: user.id, // forced — a student can never index into a global namespace
      title,
      content,
      conceptId: conceptId ?? null,
      metadata: metadata ?? {},
    })

    return NextResponse.json(result)
  } catch (err) {
    console.error("[knowledge/index] error:", err)
    return NextResponse.json({ error: "Indexing failed" }, { status: 500 })
  }
}

import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { enforceQuota } from "@/lib/services/quota"
import { streamAI } from "@/lib/ai/gateway/streaming"
import { buildPrompt } from "@/lib/ai/prompts/registry"
import { buildContextBlock, retrieve } from "@/lib/ai/rag/retriever"
import { getWeakestConcepts } from "@/lib/services/learning-graph"

export const dynamic = "force-dynamic"
export const maxDuration = 60

/**
 * Streaming Sprout endpoint — spec §25.
 *
 * Trade-off worth knowing: streaming returns free-form text, so the Socratic
 * JSON contract (§13) cannot be schema-validated mid-stream. Use this for
 * explanation-style turns where perceived latency matters most; use
 * `/api/sprout/chat` when the structured guarantee is required.
 */
export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const denied = await enforceQuota(user.id, "tutor_chat")
    if (denied) return denied

    const { message, subject, syllabus, history } = await req.json()
    if (!message || typeof message !== "string") {
      return NextResponse.json({ error: "message is required" }, { status: 400 })
    }

    const namespaces: string[] = []
    if (syllabus) namespaces.push(`syllabus_${String(syllabus).toLowerCase()}`)
    namespaces.push("user_upload")

    const [chunks, weak] = await Promise.all([
      retrieve({ query: message, namespaces, userId: user.id, limit: 6 }).catch(() => []),
      getWeakestConcepts(user.id, 5).catch(() => []),
    ])

    const masterySummary = weak.length
      ? `This student is currently weakest on: ${weak
          .slice(0, 5)
          .map((c: any) => c.learning_concepts?.name ?? c.concept_id)
          .filter(Boolean)
          .join(", ")}.`
      : ""

    const system =
      buildPrompt("interface_agent", {
        subject,
        context: buildContextBlock(chunks),
        masterySummary,
      }) +
      "\n\nRespond in plain prose, not JSON. End your reply with one question that moves the student forward."

    return await streamAI({
      task: "tutoring",
      agent: "study_ai",
      userId: user.id,
      system,
      messages: [
        ...(Array.isArray(history) ? history.slice(-10) : []),
        { role: "user", content: message },
      ],
    })
  } catch (err) {
    console.error("[sprout/stream] error:", err)
    return NextResponse.json({ error: "Failed to stream response" }, { status: 500 })
  }
}

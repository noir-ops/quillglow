import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { enforceQuota } from "@/lib/services/quota"
import { runSprout } from "@/lib/ai/orchestrator"
import { isAIConfigured } from "@/lib/ai/provider"
import { appendExchange, createSession, getSession } from "@/lib/services/sprout-sessions"

export const dynamic = "force-dynamic"
export const maxDuration = 60

/**
 * Sprout AI — the single visible assistant.
 *
 * Persists every exchange to `sprout_chat_sessions` so a returning student sees
 * their conversation history rather than starting blank each visit.
 *
 * `sessionId` is optional: omit it to start a new conversation (one is created
 * and returned), or pass one from a prior response to continue it. History is
 * loaded server-side from the session — the client no longer needs to resend
 * the whole conversation on every turn.
 */
export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const quotaDenied = await enforceQuota(user.id, "tutor_chat")
    if (quotaDenied) return quotaDenied

    if (!(await isAIConfigured())) {
      return NextResponse.json({ error: "AI provider API key not configured" }, { status: 500 })
    }

    const { message, sessionId, subject, syllabus, studentName, useRag } = await req.json()

    if (!message || typeof message !== "string") {
      return NextResponse.json({ error: "message is required" }, { status: 400 })
    }

    // Resolve the session: continue an existing one (verified to belong to this
    // user via getSession's own scoping), or start a new one.
    let session = sessionId ? await getSession(user.id, sessionId) : null
    if (!session) {
      session = await createSession(user.id, { subject: subject ?? null, syllabus: syllabus ?? null })
    }

    const history = (session.messages ?? []).slice(-10).map((m) => ({
      role: m.role,
      content: m.content,
    }))

    const result = await runSprout({
      userId: user.id,
      message,
      history,
      subject: subject ?? session.subject,
      syllabus: syllabus ?? session.syllabus,
      studentName: studentName ?? null,
      useRag: useRag !== false,
    })

    // Persist after generating — a save failure shouldn't cost the student
    // their answer, so this never blocks the response on success.
    await appendExchange(user.id, session.id, message, result.reply, result.sources)

    return NextResponse.json({ ...result, sessionId: session.id })
  } catch (err) {
    console.error("[sprout] error:", err)
    return NextResponse.json({ error: "Failed to generate response" }, { status: 500 })
  }
}

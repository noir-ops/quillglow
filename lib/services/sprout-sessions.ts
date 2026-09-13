/**
 * Sprout chat session persistence.
 *
 * The route handler (not the orchestrator) owns loading and saving — the
 * orchestrator stays a pure function of (history, message) -> reply so it can
 * be called without a session too (e.g. a future embedded widget).
 */

import { createClient } from "@/lib/supabase/server"

export interface SproutMessage {
  role: "user" | "assistant"
  content: string
  sources?: Array<{ id: number; namespace: string; snippet: string }>
  created_at: string
}

export interface SproutSession {
  id: string
  title: string
  subject: string | null
  syllabus: string | null
  messages: SproutMessage[]
  message_count: number
  updated_at: string
  created_at: string
}

function titleFromMessage(message: string): string {
  const clean = message.trim().replace(/\s+/g, " ")
  return clean.length > 48 ? clean.slice(0, 48) + "…" : clean || "New chat"
}

/** Sessions list for the history sidebar — no message bodies, keeps it light. */
export async function listSessions(userId: string, limit = 50) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("sprout_chat_sessions")
    .select("id, title, subject, syllabus, message_count, updated_at, created_at")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(limit)

  if (error) {
    console.error("[sprout-sessions] list failed:", error.message)
    return []
  }
  return data ?? []
}

export async function getSession(userId: string, sessionId: string): Promise<SproutSession | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("sprout_chat_sessions")
    .select("*")
    .eq("id", sessionId)
    .eq("user_id", userId)
    .maybeSingle()

  if (error) {
    console.error("[sprout-sessions] get failed:", error.message)
    return null
  }
  return data as SproutSession | null
}

export async function createSession(
  userId: string,
  opts: { subject?: string | null; syllabus?: string | null } = {},
): Promise<SproutSession> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("sprout_chat_sessions")
    .insert({
      user_id: userId,
      subject: opts.subject ?? null,
      syllabus: opts.syllabus ?? null,
    })
    .select()
    .single()

  if (error) throw new Error(`Failed to create session: ${error.message}`)
  return data as SproutSession
}

/**
 * Append the user message + assistant reply to a session in one write.
 * Auto-titles the session from the first user message.
 */
export async function appendExchange(
  userId: string,
  sessionId: string,
  userMessage: string,
  assistantReply: string,
  sources: SproutMessage["sources"] = [],
): Promise<void> {
  const supabase = await createClient()

  const { data: session, error: fetchErr } = await supabase
    .from("sprout_chat_sessions")
    .select("messages, title, message_count")
    .eq("id", sessionId)
    .eq("user_id", userId)
    .single()

  if (fetchErr || !session) {
    console.error("[sprout-sessions] append failed to load session:", fetchErr?.message)
    return
  }

  const now = new Date().toISOString()
  const MAX_MESSAGES_PER_SESSION = 200 // bound growth at write time, not just via the retention cron

  const newMessages: SproutMessage[] = [
    ...(session.messages ?? []),
    { role: "user", content: userMessage, created_at: now },
    { role: "assistant", content: assistantReply, sources, created_at: now },
  ].slice(-MAX_MESSAGES_PER_SESSION)

  const isFirstExchange = (session.message_count ?? 0) === 0

  const { error: updateErr } = await supabase
    .from("sprout_chat_sessions")
    .update({
      messages: newMessages,
      message_count: newMessages.length,
      title: isFirstExchange ? titleFromMessage(userMessage) : session.title,
      updated_at: now,
    })
    .eq("id", sessionId)
    .eq("user_id", userId)

  if (updateErr) console.error("[sprout-sessions] append failed to save:", updateErr.message)
}

export async function deleteSession(userId: string, sessionId: string): Promise<boolean> {
  const supabase = await createClient()
  const { error } = await supabase
    .from("sprout_chat_sessions")
    .delete()
    .eq("id", sessionId)
    .eq("user_id", userId)

  if (error) {
    console.error("[sprout-sessions] delete failed:", error.message)
    return false
  }
  return true
}

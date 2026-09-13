import { createServerClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { aiChatCompletion, isAIConfigured } from "@/lib/ai/provider"


type EchoMode = "my_knowledge" | "confusion_history" | "future_me"

const MODE_PROMPTS: Record<EchoMode, (topic: string) => string> = {
  my_knowledge: (topic) =>
    `The student wants to explain "${topic}" as if they already know it — testing their own understanding. 
Ask them to explain it first, then gently fill in gaps, correct misconceptions, and reinforce strong points.
Start with: "Go ahead — explain ${topic} in your own words. I'll listen and give you feedback."
After they explain, give structured feedback: what they got right, what was missing, and one key thing to remember.`,

  confusion_history: (topic) =>
    `The student is reviewing "${topic}" specifically because they were confused about it before.
Acknowledge that confusion is normal and part of learning.
Start with a clear, calm explanation of the concept from scratch.
Then ask: "What part of this confused you before? Let's address it directly."
Focus on the specific sticking points — don't just re-explain the whole thing.
End with a simple memory hook or analogy they can use to remember it.`,

  future_me: (topic) =>
    `The student wants to imagine they have fully mastered "${topic}" — write to them as if they are their future confident self.
Speak in second person: "You now understand..."
Describe what mastering this topic feels like and looks like in practice.
List 3 things they can now do with this knowledge.
Give them one challenging question a true expert would ask, then reveal the answer.
End with encouragement: make them feel that mastery is genuinely within reach.`,
}

function buildReferencesBlock(references: Record<string, any>): string {
  if (!references || Object.keys(references).length === 0) return ""

  const parts: string[] = []

  if (references.exams?.length) {
    parts.push("PAST GENERATED EXAMS:\n" + references.exams.map((e: any) =>
      `- "${e.subject}" exam${e.pdf_filename ? ` (${e.pdf_filename})` : ""}${e.summary ? `: ${e.summary.slice(0, 120)}` : ""}`
    ).join("\n"))
  }

  if (references.mockAttempts?.length) {
    parts.push("MOCK EXAM RESULTS:\n" + references.mockAttempts.map((a: any) =>
      `- Score: ${a.score_percentage?.toFixed(0)}% (${a.correct_answers}/${a.total_questions}) — completed ${a.completed_at ? new Date(a.completed_at).toLocaleDateString() : "recently"}`
    ).join("\n"))
  }

  if (references.decks?.length) {
    parts.push("FLASHCARD DECKS:\n" + references.decks.map((d: any) =>
      `- "${d.name}"${d.subject ? ` (${d.subject})` : ""}`
    ).join("\n"))
  }

  if (references.notes?.length) {
    parts.push("NOTES:\n" + references.notes.map((n: any) =>
      `- "${n.title}"${n.subject ? ` [${n.subject}]` : ""}${n.content ? `: ${n.content.slice(0, 120)}...` : ""}`
    ).join("\n"))
  }

  if (references.revisionNotes?.length) {
    parts.push("REVISION NOTES:\n" + references.revisionNotes.map((r: any) =>
      `- "${r.title}"${r.subject ? ` [${r.subject}]` : ""} — mode: ${r.mode ?? "standard"}, depth: ${r.depth_level ?? "normal"}`
    ).join("\n"))
  }

  if (references.essayAttempts?.length) {
    parts.push("ESSAY ATTEMPTS:\n" + references.essayAttempts.map((e: any) =>
      `- Q: "${e.question_text?.slice(0, 100)}" — Score: ${e.ai_score ?? "N/A"}/100, Words: ${e.word_count ?? "?"}`
    ).join("\n"))
  }

  if (references.tasks?.length) {
    const pending = references.tasks.filter((t: any) => !t.completed)
    const done = references.tasks.filter((t: any) => t.completed)
    if (pending.length) parts.push(`PENDING TASKS (${pending.length}):\n` + pending.slice(0, 8).map((t: any) => `- [${t.priority ?? "normal"}] ${t.title}${t.subject ? ` (${t.subject})` : ""}`).join("\n"))
    if (done.length) parts.push(`COMPLETED TASKS (${done.length} total)`)
  }

  if (references.tutorMemory?.length) {
    parts.push("AI TUTOR MEMORY (topics studied):\n" + references.tutorMemory.map((m: any) =>
      `- ${m.topic} [${m.subject}] — confidence: ${m.confidence_level ?? "?"}, asked ${m.times_asked ?? 1}x`
    ).join("\n"))
  }

  if (references.audioOverviews?.length) {
    parts.push("AUDIO OVERVIEWS CREATED:\n" + references.audioOverviews.map((a: any) =>
      `- "${a.title}"${a.subject ? ` [${a.subject}]` : ""} — ${a.study_mode ?? ""} ${a.duration_mode ?? ""}`
    ).join("\n"))
  }

  return parts.length > 0
    ? `\nSTUDENT'S PERSONAL LEARNING DATA (use this to give highly personalized, specific responses):\n${parts.join("\n\n")}\n`
    : ""
}

function buildSystemPrompt(mode: EchoMode, topic: string, context: string, references?: Record<string, any>): string {
  const modeInstruction = MODE_PROMPTS[mode](topic)
  const referencesBlock = references ? buildReferencesBlock(references) : ""

  return `You are EchoMind, a personal AI learning reflection companion inside QuillGlow.
Your purpose is not to lecture — it is to help students reflect on, consolidate, and truly own their knowledge.

You are warm, calm, and specific. You never pad responses with unnecessary text.
You speak directly to the student. You use plain language and concrete examples.
${referencesBlock ? "You have access to the student's personal learning history — use it to make responses deeply personal and relevant." : ""}

CURRENT MODE: ${mode === "my_knowledge" ? "Explain From My Knowledge" : mode === "confusion_history" ? "Where I Was Confused" : "Future Me (Mastered)"}
TOPIC: ${topic}

MODE INSTRUCTIONS:
${modeInstruction}

${context ? `ADDITIONAL CONTEXT PROVIDED BY STUDENT:\n${context}\n` : ""}${referencesBlock}

FORMATTING RULES:
- Use short paragraphs
- Use bullet points only when listing distinct items
- Bold key terms with **term**
- Never use headers like ## unless the response is very long
- Keep responses focused — quality over length
- Always end with something actionable or reflective
- When referencing the student's data (e.g. their mock exam score, a specific note), mention it naturally — it shows you know them`
}

export async function POST(request: Request) {
  try {
    if (!(await isAIConfigured())) {
      return NextResponse.json({ error: "AI provider API key not configured" }, { status: 500 })
    }

    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    // Check Genius subscription or free usage limit — MUST be plan_type = 'genius'
    const FREE_LIMIT = 3
    const { data: subscription } = await supabase
      .from("subscriptions")
      .select("status, plan_type")
      .eq("user_id", user.id)
      .eq("plan_type", "genius")
      .in("status", ["active", "trialing"])
      .limit(1)
      .maybeSingle()

    const isGenius = !!subscription

    if (!isGenius) {
      const since = new Date()
      since.setDate(since.getDate() - 30)
      const { count } = await supabase
        .from("echomind_logs")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .gte("created_at", since.toISOString())

      if ((count ?? 0) >= FREE_LIMIT) {
        return NextResponse.json(
          { error: "limit_reached", message: "You've used all your 3 EchoMind sessions this month. Exam coming up? Unlock unlimited for $4.99 — less than a coffee. ☕" },
          { status: 429 }
        )
      }
    }

    const body = await request.json()
    const { topic, mode, context = "", message, history = [], references } = body

    if (!topic || !mode) {
      return NextResponse.json({ error: "topic and mode are required" }, { status: 400 })
    }

    const systemPrompt = buildSystemPrompt(mode as EchoMode, topic, context, references)

    // Build conversation messages
    const messages: Array<{ role: string; content: string }> = [
      { role: "system", content: systemPrompt },
      ...history.slice(-10), // last 10 for context window
      { role: "user", content: message || `Let's start with "${topic}" in ${mode} mode.` },
    ]

    const response = await aiChatCompletion({
      messages,
      max_tokens: 1024,
      temperature: 0.72,
    }, { task: "summarization", agent: "study_ai" })

    if (!response.ok) {
      const errText = await response.text()
      console.error("[echomind] AI provider error:", errText)
      return NextResponse.json({ error: "AI service error" }, { status: 500 })
    }

    const data = await response.json()
    const reply = data.choices?.[0]?.message?.content ?? "No response generated."

    // Persist to echomind_logs (fire and forget — don't block response)
    supabase.from("echomind_logs").insert({
      user_id: user.id,
      query: message || topic,
      mode,
      response: reply,
      context_summary: JSON.stringify({ topic, context: context?.slice(0, 300) || null }),
    }).then(({ error }) => {
      if (error) console.error("[echomind] log insert error:", error)
    })

    return NextResponse.json({ reply })
  } catch (error) {
    console.error("[echomind] error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

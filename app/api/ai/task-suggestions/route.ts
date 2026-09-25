import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { aiChatCompletion, isAIConfigured } from "@/lib/ai/provider"

export const dynamic = "force-dynamic"

/**
 * Suggests tasks from the learner's OWN tracking data — overdue and
 * completed tasks from the last two weeks — rather than requiring pasted
 * syllabus text. This is the "based on plan and tracking data" half of the
 * AI task suggestions requirement; app/api/ai/analyze-syllabus stays the
 * syllabus-paste path this reuses the same suggestion-card UI for.
 */
export async function POST() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const twoWeeksAgo = new Date()
  twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14)
  const today = new Date().toISOString().slice(0, 10)

  const { data: recentTasks } = await supabase
    .from("tasks")
    .select("title, subject, priority, completed, due_date, is_review")
    .eq("user_id", user.id)
    .gte("due_date", twoWeeksAgo.toISOString().slice(0, 10))
    .order("due_date")

  const tasks = recentTasks ?? []
  const overdue = tasks.filter((t) => !t.completed && t.due_date && t.due_date < today && !t.is_review)
  const completed = tasks.filter((t) => t.completed && !t.is_review)

  if (tasks.length === 0) {
    return NextResponse.json({
      tasks: [],
      message: "No recent tasks to learn from yet — add a few, then check back here.",
    })
  }

  if (!(await isAIConfigured())) {
    return NextResponse.json({ error: "AI provider not configured" }, { status: 500 })
  }

  const prompt = `A student's recent study tracking data:

Overdue / not completed (${overdue.length}):
${overdue.map((t) => `- ${t.title}${t.subject ? ` (${t.subject})` : ""}`).join("\n") || "(none)"}

Completed recently (${completed.length}):
${completed.map((t) => `- ${t.title}${t.subject ? ` (${t.subject})` : ""}`).join("\n") || "(none)"}

Based on this, suggest 3-5 concrete next tasks: catch-up tasks for what's overdue (kept short and achievable), and light reinforcement for what's already done. Return ONLY JSON:
{ "tasks": [ { "title": "", "description": "", "priority": "low|medium|high", "subject": "" } ] }`

  try {
    const response = await aiChatCompletion(
      {
        messages: [
          { role: "system", content: "You are a study coach suggesting tasks from a student's actual tracking data. Return only valid JSON." },
          { role: "user", content: prompt },
        ],
        temperature: 0.6,
        max_tokens: 700,
      },
      { task: "summarization", agent: "study_ai", userId: user.id, cacheable: false },
    )

    if (!response.ok) {
      return NextResponse.json({ error: "Failed to generate suggestions" }, { status: 500 })
    }

    const data = await response.json()
    const raw = data.choices?.[0]?.message?.content?.trim() ?? "{}"
    const cleaned = raw.replace(/^```json\s*/i, "").replace(/```\s*$/, "")
    const parsed = JSON.parse(cleaned)

    return NextResponse.json({ tasks: parsed.tasks ?? [] })
  } catch (err) {
    console.error("[ai/task-suggestions] failed:", err)
    return NextResponse.json({ error: "Failed to generate suggestions" }, { status: 500 })
  }
}

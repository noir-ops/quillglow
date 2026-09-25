import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

/**
 * Creates a new, freestanding task — used by the calendar's day-detail
 * "add task" form. Never linked to a study plan (plan_goal_id/plan_id stay
 * null), since it's something the learner is adding themselves for that day.
 */
export async function POST(req: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  let body: {
    title?: string
    description?: string | null
    due_date?: string | null
    priority?: string
    subject?: string | null
    estimated_hours?: number | null
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  if (!body.title?.trim()) {
    return NextResponse.json({ error: "A title is required" }, { status: 400 })
  }

  const allowedPriorities = new Set(["low", "medium", "high"])
  const priority = allowedPriorities.has(String(body.priority)) ? body.priority : "medium"

  const { data, error } = await supabase
    .from("tasks")
    .insert({
      user_id: user.id,
      title: body.title.trim(),
      description: body.description || null,
      due_date: body.due_date || null,
      priority,
      subject: body.subject || null,
      estimated_hours: body.estimated_hours ?? null,
      completed: false,
    })
    .select()
    .single()

  if (error) {
    console.error("[tasks/post] create failed:", error.message)
    return NextResponse.json({ error: "Could not create task", detail: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, task: data })
}

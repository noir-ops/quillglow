import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

// GET all habits for the current user
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data, error } = await supabase
    .from("habits")
    .select("*, habit_completions(completed_date)")
    .eq("user_id", user.id)
    .eq("archived", false)
    .order("created_at", { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// POST create a new habit
export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const { habit_name, color, icon } = body

  if (!habit_name?.trim()) return NextResponse.json({ error: "habit_name is required" }, { status: 400 })

  const { data, error } = await supabase
    .from("habits")
    .insert({ user_id: user.id, habit_name: habit_name.trim(), color: color || "#6366f1", icon: icon || "check" })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// DELETE archive a habit
export async function DELETE(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await req.json()

  const { error } = await supabase
    .from("habits")
    .update({ archived: true })
    .eq("id", id)
    .eq("user_id", user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}

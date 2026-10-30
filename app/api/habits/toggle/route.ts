import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { habit_id, date } = await req.json()
  const completedDate = date || new Date().toISOString().split("T")[0]

  // Check if already completed today
  const { data: existing } = await supabase
    .from("habit_completions")
    .select("id")
    .eq("habit_id", habit_id)
    .eq("user_id", user.id)
    .eq("completed_date", completedDate)
    .single()

  if (existing) {
    // Un-complete — delete the row
    const { error } = await supabase
      .from("habit_completions")
      .delete()
      .eq("id", existing.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ completed: false })
  } else {
    // Complete — insert a row
    const { error } = await supabase
      .from("habit_completions")
      .insert({ habit_id, user_id: user.id, completed_date: completedDate })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ completed: true })
  }
}

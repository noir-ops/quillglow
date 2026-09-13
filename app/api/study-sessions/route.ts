import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

// GET: Fetch today's study sessions for the user
export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const { data, error } = await supabase
    .from("study_sessions")
    .select("*")
    .eq("user_id", user.id)
    .gte("start_time", today.toISOString())
    .order("start_time", { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Calculate daily total
  const totalSeconds = (data || []).reduce((sum, s) => sum + (s.duration_seconds || 0), 0)

  return NextResponse.json({
    sessions: data || [],
    todayTotal: totalSeconds,
    sessionCount: data?.length || 0,
  })
}

// POST: Save a completed study session
export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json()
  const { session_name, task_reference, start_time, end_time, duration_seconds } = body

  // Validate duration
  if (!duration_seconds || duration_seconds <= 0 || duration_seconds > 86400) {
    return NextResponse.json({ error: "Invalid duration" }, { status: 400 })
  }

  if (!start_time) {
    return NextResponse.json({ error: "Missing start_time" }, { status: 400 })
  }

  const { data, error } = await supabase
    .from("study_sessions")
    .insert({
      user_id: user.id,
      session_name: session_name?.trim() || null,
      task_reference: task_reference || null,
      start_time,
      end_time: end_time || new Date().toISOString(),
      duration_seconds,
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ session: data })
}

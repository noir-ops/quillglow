import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
export const dynamic = "force-dynamic"
const defaults = { email: true, studyReminders: true, weeklyReport: false }
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { data, error } = await supabase.from("notification_preferences").select("email_enabled,study_reminders,weekly_report").eq("user_id", user.id).maybeSingle()
  if (error) return NextResponse.json({ error: "Could not load notification preferences" }, { status: 500 })
  return NextResponse.json({ preferences: data ? { email: data.email_enabled, studyReminders: data.study_reminders, weeklyReport: data.weekly_report } : defaults })
}
export async function PUT(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const input = await request.json().catch(() => null)
  if (!input || Object.keys(defaults).some((key) => typeof input[key] !== "boolean")) return NextResponse.json({ error: "All preferences must be boolean" }, { status: 400 })
  const { error } = await supabase.from("notification_preferences").upsert({ user_id: user.id,
    email_enabled: input.email, study_reminders: input.studyReminders, weekly_report: input.weeklyReport,
    updated_at: new Date().toISOString() }, { onConflict: "user_id" })
  if (error) return NextResponse.json({ error: "Could not save notification preferences" }, { status: 500 })
  return NextResponse.json({ success: true })
}

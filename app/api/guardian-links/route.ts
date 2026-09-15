import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

/** Every adult (family or mentor) currently linked to this student. */
export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data, error } = await supabase
    .from("guardian_links")
    .select("id, link_type, status, permissions, created_at, trusted_adults:adult_user_id(full_name, contact_email)")
    .eq("student_user_id", user.id)
    .eq("status", "active")
    .order("created_at", { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ links: data ?? [] })
}

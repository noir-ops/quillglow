import { createServerClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function GET() {
  try {
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { data, error } = await supabase
      .from("echomind_logs")
      .select("id, query, mode, response, context_summary, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(200)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ logs: data ?? [] })
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

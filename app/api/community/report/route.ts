import { createServerClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function POST(request: Request) {
  try {
    const supabase = await createServerClient()

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { message_id, reason } = body

    if (!message_id || !reason) {
      return NextResponse.json({ error: "Message ID and reason required" }, { status: 400 })
    }

    const { error } = await supabase.from("community_reports").insert({
      message_id,
      reporter_id: user.id,
      reason,
    })

    if (error) {
      console.error("[v0] Error reporting message:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("[v0] Error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

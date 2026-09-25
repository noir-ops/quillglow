import { createServerClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function POST(request: Request) {
  try {
    const supabase = await createServerClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { code } = body

    if (!code || code.trim().length === 0) {
      return NextResponse.json({ error: "Invite code is required" }, { status: 400 })
    }

    // Call the join_room_by_code function
    const { data, error } = await supabase.rpc("join_room_by_code", {
      code: code.trim(),
    })

    if (error) {
      console.error("[v0] Error joining room:", error)
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ room_id: data })
  } catch (error: any) {
    console.error("[v0] Error in join POST:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

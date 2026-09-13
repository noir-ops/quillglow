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
    const { room_id } = body

    if (!room_id) {
      return NextResponse.json({ error: "Room ID is required" }, { status: 400 })
    }

    // Call the rotate_invite_code function
    const { data, error } = await supabase.rpc("rotate_invite_code", {
      room_id_param: room_id,
    })

    if (error) {
      console.error("[v0] Error rotating invite code:", error)
      return NextResponse.json({ error: error.message }, { status: 403 })
    }

    return NextResponse.json({ invite_code: data })
  } catch (error: any) {
    console.error("[v0] Error in invite POST:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

import { createServerClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function GET() {
  try {
    const supabase = await createServerClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Get rooms where user is a member
    const { data: rooms, error } = await supabase
      .from("study_rooms")
      .select(`
        id,
        name,
        description,
        subject,
        created_at,
        study_room_members!inner(role),
        study_room_messages(id, created_at, content)
      `)
      .eq("study_room_members.user_id", user.id)
      .order("created_at", { ascending: false })

    if (error) {
      console.error("[v0] Error fetching rooms:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Format rooms with member count and last message
    const formattedRooms = await Promise.all(
      (rooms || []).map(async (room: any) => {
        const { data: members } = await supabase.from("study_room_members").select("id").eq("room_id", room.id)

        const messages = room.study_room_messages || []
        const lastMessage = messages.length > 0 ? messages[messages.length - 1] : null

        return {
          id: room.id,
          name: room.name,
          description: room.description,
          subject: room.subject,
          created_at: room.created_at,
          member_count: members?.length || 0,
          last_message: lastMessage?.content || null,
          last_message_at: lastMessage?.created_at || room.created_at,
          user_role: room.study_room_members[0]?.role || "member",
        }
      }),
    )

    return NextResponse.json({ rooms: formattedRooms })
  } catch (error: any) {
    console.error("[v0] Error in rooms GET:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

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
    const { name, description, subject, max_members } = body

    if (!name || name.trim().length === 0) {
      return NextResponse.json({ error: "Room name is required" }, { status: 400 })
    }

    // Call the create_study_room function
    const { data, error } = await supabase.rpc("create_study_room", {
      room_name: name.trim(),
      room_description: description?.trim() || null,
      room_subject: subject?.trim() || null,
      room_max_members: max_members || null,
    })

    if (error) {
      console.error("[v0] Error creating room:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ room_id: data })
  } catch (error: any) {
    console.error("[v0] Error in rooms POST:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

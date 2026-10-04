import { createServerClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function GET(request: Request, context: { params: Promise<{ roomId: string }> }) {
  try {
    const { roomId } = await context.params
    const supabase = await createServerClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Get room details
    const { data: room, error: roomError } = await supabase.from("study_rooms").select("*").eq("id", roomId).single()

    if (roomError || !room) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 })
    }

    // Get user's role in room
    const { data: membership } = await supabase
      .from("study_room_members")
      .select("role")
      .eq("room_id", roomId)
      .eq("user_id", user.id)
      .single()

    if (!membership) {
      return NextResponse.json({ error: "Not a member" }, { status: 403 })
    }

    // Get members with profiles
    const { data: members } = await supabase
      .from("study_room_members")
      .select(`
        id,
        role,
        joined_at,
        user_id
      `)
      .eq("room_id", roomId)
      .order("joined_at", { ascending: true })

    // Get profile info for members
    const membersWithProfiles = await Promise.all(
      (members || []).map(async (member: any) => {
        const { data: profile } = await supabase
          .from("profiles")
          .select("display_name, avatar_url")
          .eq("id", member.user_id)
          .single()

        return {
          ...member,
          display_name: profile?.display_name || "Student",
          avatar_url: profile?.avatar_url || null,
        }
      }),
    )

    return NextResponse.json({
      room: {
        ...room,
        user_role: membership.role,
        members: membersWithProfiles,
      },
    })
  } catch (error: any) {
    console.error("[v0] Error fetching room:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

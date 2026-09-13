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
    const { their_request_id, my_request_id } = body

    if (!their_request_id || !my_request_id) {
      return NextResponse.json({ error: "Missing request IDs" }, { status: 400 })
    }

    // Get both requests
    const { data: theirRequest } = await supabase
      .from("study_buddy_requests")
      .select("*, user_public_profile!inner(display_name)")
      .eq("id", their_request_id)
      .single()

    const { data: myRequest } = await supabase.from("study_buddy_requests").select("*").eq("id", my_request_id).single()

    if (!theirRequest || !myRequest) {
      return NextResponse.json({ error: "Invalid requests" }, { status: 404 })
    }

    // Determine subject for room name
    const sharedSubjects = theirRequest.subjects.filter((s: string) => myRequest.subjects.includes(s))
    const subject = sharedSubjects[0] || theirRequest.subjects[0] || "General"

    // Create a private study room
    const { data: room, error: roomError } = await supabase
      .from("study_rooms")
      .insert({
        name: `Study Session: ${subject}`,
        description: `Matched study session for ${subject}`,
        subject,
        owner_id: user.id,
        max_members: 2,
        invite_enabled: false,
      })
      .select()
      .single()

    if (roomError) {
      console.error("[v0] Error creating room:", roomError)
      return NextResponse.json({ error: roomError.message }, { status: 500 })
    }

    // Add both users as members
    await supabase.from("study_room_members").insert([
      { room_id: room.id, user_id: user.id, role: "owner" },
      { room_id: room.id, user_id: theirRequest.user_id, role: "member" },
    ])

    // Create match record
    await supabase.from("study_buddy_matches").insert({
      request_a: my_request_id,
      request_b: their_request_id,
      room_id: room.id,
    })

    // Update both requests to matched
    await supabase
      .from("study_buddy_requests")
      .update({ status: "matched" })
      .in("id", [my_request_id, their_request_id])

    return NextResponse.json({ room_id: room.id })
  } catch (error: any) {
    console.error("[v0] Error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

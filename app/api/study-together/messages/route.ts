import { createServerClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const roomId = searchParams.get("roomId")
    const limit = Number.parseInt(searchParams.get("limit") || "50")

    if (!roomId) {
      return NextResponse.json({ error: "Room ID is required" }, { status: 400 })
    }

    const supabase = await createServerClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Verify membership
    const { data: membership } = await supabase
      .from("study_room_members")
      .select("id")
      .eq("room_id", roomId)
      .eq("user_id", user.id)
      .single()

    if (!membership) {
      return NextResponse.json({ error: "Not a member" }, { status: 403 })
    }

    const { data: messages, error } = await supabase
      .from("study_room_messages")
      .select("*")
      .eq("room_id", roomId)
      .order("created_at", { ascending: true })
      .limit(limit)

    if (error) {
      console.error("[v0] Error fetching messages:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Get sender profiles
    const messagesWithProfiles = await Promise.all(
      (messages || []).map(async (message: any) => {
        if (!message.user_id) {
          return { ...message, sender_name: "System" }
        }

        const { data: profile } = await supabase
          .from("profiles")
          .select("display_name")
          .eq("id", message.user_id)
          .single()

        return {
          ...message,
          sender_name: profile?.display_name || "Student",
        }
      }),
    )

    return NextResponse.json({ messages: messagesWithProfiles })
  } catch (error: any) {
    console.error("[v0] Error in messages GET:", error)
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
    const { room_id, content, image_url } = body

    if (!room_id || (!content && !image_url)) {
      return NextResponse.json({ error: "Invalid message" }, { status: 400 })
    }

    // Limit message length
    if (content && content.trim().length > 500) {
      return NextResponse.json({ error: "Message too long (max 500 characters)" }, { status: 400 })
    }

    // Verify membership
    const { data: membership } = await supabase
      .from("study_room_members")
      .select("id")
      .eq("room_id", room_id)
      .eq("user_id", user.id)
      .single()

    if (!membership) {
      return NextResponse.json({ error: "Not a member" }, { status: 403 })
    }

    const { data: message, error } = await supabase
      .from("study_room_messages")
      .insert({
        room_id,
        user_id: user.id,
        content: content ? content.trim() : null,
        image_url: image_url || null,
        type: "user",
      })
      .select()
      .single()

    if (error) {
      console.error("[v0] Error sending message:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ message })
  } catch (error: any) {
    console.error("[v0] Error in messages POST:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

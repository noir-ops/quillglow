import { createServerClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function GET(request: Request) {
  try {
    const supabase = await createServerClient()

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const channelId = searchParams.get("channel_id")

    if (!channelId) {
      return NextResponse.json({ error: "Channel ID required" }, { status: 400 })
    }

    const { data: messages, error } = await supabase
      .from("community_messages")
      .select("*")
      .eq("channel_id", channelId)
      .is("parent_id", null)
      .order("created_at", { ascending: true })
      .limit(100)

    if (error) {
      console.error("[v0] Error fetching messages:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const userIds = [...new Set(messages?.map((m) => m.user_id) || [])]

    let profiles: Record<string, { display_name: string; avatar_url: string | null }> = {}

    if (userIds.length > 0) {
      const { data: profilesData } = await supabase
        .from("user_public_profile")
        .select("user_id, display_name, avatar_url")
        .in("user_id", userIds)

      if (profilesData) {
        profiles = profilesData.reduce(
          (acc, p) => {
            acc[p.user_id] = { display_name: p.display_name, avatar_url: p.avatar_url }
            return acc
          },
          {} as Record<string, { display_name: string; avatar_url: string | null }>,
        )
      }
    }

    const messagesWithProfiles = messages?.map((m) => ({
      ...m,
      user_public_profile: profiles[m.user_id] || { display_name: "Anonymous", avatar_url: null },
    }))

    return NextResponse.json({ messages: messagesWithProfiles })
  } catch (error: any) {
    console.error("[v0] Error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

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
    const { channel_id, content, image_url } = body

    if (!channel_id || (!content?.trim() && !image_url)) {
      return NextResponse.json({ error: "Message must contain text or image" }, { status: 400 })
    }

    if (content && content.length > 500) {
      return NextResponse.json({ error: "Message too long (max 500 chars)" }, { status: 400 })
    }

    // Check if channel is locked
    const { data: channel } = await supabase
      .from("community_channels")
      .select("is_locked")
      .eq("id", channel_id)
      .single()

    if (channel?.is_locked) {
      return NextResponse.json({ error: "Channel is locked" }, { status: 403 })
    }

    const { data: message, error } = await supabase
      .from("community_messages")
      .insert({
        channel_id,
        user_id: user.id,
        content: content?.trim() || null,
        image_url: image_url || null,
      })
      .select("*")
      .single()

    if (error) {
      console.error("[v0] Error sending message:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const { data: profile } = await supabase
      .from("user_public_profile")
      .select("display_name, avatar_url")
      .eq("user_id", user.id)
      .single()

    const messageWithProfile = {
      ...message,
      user_public_profile: profile || { display_name: "Anonymous", avatar_url: null },
    }

    return NextResponse.json({ message: messageWithProfile })
  } catch (error: any) {
    console.error("[v0] Error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

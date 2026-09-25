import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function POST(req: Request) {
  try {
    const supabase = await createClient()

    // Check authentication
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { questId } = await req.json()

    if (!questId) {
      return NextResponse.json({ error: "Quest ID is required" }, { status: 400 })
    }

    // Check if user already started this quest
    const { data: existingProgress } = await supabase
      .from("user_quests")
      .select("*")
      .eq("user_id", user.id)
      .eq("quest_id", questId)
      .single()

    if (existingProgress) {
      return NextResponse.json({ userQuest: existingProgress })
    }

    // Create new user quest progress
    const { data: userQuest, error } = await supabase
      .from("user_quests")
      .insert({
        user_id: user.id,
        quest_id: questId,
        status: "in_progress",
      })
      .select()
      .single()

    if (error) {
      console.error("[v0] Error starting quest:", error)
      return NextResponse.json({ error: "Failed to start quest" }, { status: 500 })
    }

    return NextResponse.json({ userQuest })
  } catch (error) {
    console.error("[v0] Error in start quest:", error)
    return NextResponse.json({ error: "Failed to start quest" }, { status: 500 })
  }
}

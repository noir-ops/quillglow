import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function GET(req: Request) {
  try {
    const supabase = await createClient()

    // Check authentication
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const subject = searchParams.get("subject")
    const difficulty = searchParams.get("difficulty")

    let query = supabase.from("quests").select("*").order("created_at", { ascending: false })

    if (subject) {
      query = query.eq("subject", subject)
    }

    if (difficulty) {
      query = query.eq("difficulty", difficulty)
    }

    const { data: quests, error } = await query

    if (error) {
      console.error("[v0] Error fetching quests:", error)
      return NextResponse.json({ error: "Failed to fetch quests" }, { status: 500 })
    }

    return NextResponse.json({ quests })
  } catch (error) {
    console.error("[v0] Error in list quests:", error)
    return NextResponse.json({ error: "Failed to fetch quests" }, { status: 500 })
  }
}

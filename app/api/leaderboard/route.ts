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
    const limit = Number.parseInt(searchParams.get("limit") || "100")

    // Fetch leaderboard data
    const { data: leaderboard, error } = await supabase.from("leaderboard").select("*").limit(limit)

    if (error) {
      console.error("[v0] Error fetching leaderboard:", error)
      return NextResponse.json({ error: "Failed to fetch leaderboard" }, { status: 500 })
    }

    // Get current user's rank
    const { data: userProfile } = await supabase.from("profiles").select("xp").eq("id", user.id).single()

    let userRank = null
    if (userProfile) {
      const { count } = await supabase
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .gt("xp", userProfile.xp)

      userRank = (count || 0) + 1
    }

    return NextResponse.json({ leaderboard, userRank })
  } catch (error) {
    console.error("[v0] Error in leaderboard:", error)
    return NextResponse.json({ error: "Failed to fetch leaderboard" }, { status: 500 })
  }
}

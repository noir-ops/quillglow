import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function GET(req: Request) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Fetch all achievements
    const { data: achievements, error: achievementsError } = await supabase
      .from("achievements")
      .select("*")
      .order("requirement_value", { ascending: true })

    if (achievementsError) {
      console.error("[v0] Error fetching achievements:", achievementsError)
      return NextResponse.json({ error: "Failed to fetch achievements" }, { status: 500 })
    }

    // Fetch user's unlocked achievements
    const { data: userAchievements, error: userAchievementsError } = await supabase
      .from("user_achievements")
      .select("achievement_id, unlocked_at")
      .eq("user_id", user.id)

    if (userAchievementsError) {
      console.error("[v0] Error fetching user achievements:", userAchievementsError)
    }

    const unlockedIds = new Set(userAchievements?.map((ua) => ua.achievement_id) || [])

    const achievementsWithStatus = achievements?.map((achievement) => ({
      ...achievement,
      unlocked: unlockedIds.has(achievement.id),
      unlocked_at: userAchievements?.find((ua) => ua.achievement_id === achievement.id)?.unlocked_at,
    }))

    return NextResponse.json({ achievements: achievementsWithStatus })
  } catch (error) {
    console.error("[v0] Error in achievements:", error)
    return NextResponse.json({ error: "Failed to fetch achievements" }, { status: 500 })
  }
}

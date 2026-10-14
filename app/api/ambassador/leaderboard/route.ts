import { createServerClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  const supabase = await createServerClient()
  const { searchParams } = new URL(request.url)
  const period = searchParams.get("period") || "all" // all, month, week
  const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100)

  let query = supabase
    .from("ambassadors")
    .select("id, name, university, verified_referrals, total_referrals, created_at")
    .eq("status", "approved")
    .order("verified_referrals", { ascending: false })
    .limit(limit)

  // For time-based filtering, we'd need to aggregate referrals by date
  // For now, use total verified referrals
  if (period === "month") {
    // Filter ambassadors who joined in the last 30 days or have recent activity
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    query = query.gte("created_at", thirtyDaysAgo.toISOString())
  } else if (period === "week") {
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
    query = query.gte("created_at", sevenDaysAgo.toISOString())
  }

  const { data: ambassadors, error } = await query

  if (error) {
    console.error("Leaderboard fetch error:", error)
    return NextResponse.json({ error: "Failed to fetch leaderboard" }, { status: 500 })
  }

  // Get tier for each ambassador
  const leaderboard = (ambassadors || []).map((amb, index) => {
    let tier = "starter"
    if (amb.verified_referrals >= 100) tier = "diamond"
    else if (amb.verified_referrals >= 50) tier = "platinum"
    else if (amb.verified_referrals >= 30) tier = "gold"
    else if (amb.verified_referrals >= 15) tier = "silver"
    else if (amb.verified_referrals >= 5) tier = "bronze"

    return {
      rank: index + 1,
      name: amb.name,
      institution: amb.university,
      referrals: amb.verified_referrals,
      tier,
    }
  })

  // Get total stats
  const { count: totalAmbassadors } = await supabase
    .from("ambassadors")
    .select("*", { count: "exact", head: true })
    .eq("status", "approved")

  const { data: statsData } = await supabase
    .from("ambassadors")
    .select("verified_referrals")
    .eq("status", "approved")

  const totalReferrals = (statsData || []).reduce((sum, a) => sum + (a.verified_referrals || 0), 0)

  return NextResponse.json({
    leaderboard,
    stats: {
      totalAmbassadors: totalAmbassadors || 0,
      totalReferrals,
    },
  })
}

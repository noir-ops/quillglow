import { createServerClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

const MILESTONES = [
  { count: 15, reward: "Genius plan for 2 months", months: 2 },
  { count: 50, reward: "Genius plan for 3 months + Certificate", months: 3, certificate: true },
  { count: 100, reward: "Genius plan for 6 months + Certificate", months: 6, certificate: true },
  { count: 500, reward: "Lifetime Genius + Certificate + Gift", months: -1, certificate: true, gift: true },
]

export async function GET(req: Request) {
  try {
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Get ambassador profile
    const { data: ambassador } = await supabase
      .from("ambassadors")
      .select("*")
      .eq("user_id", user.id)
      .single()

    if (!ambassador) {
      return NextResponse.json({ error: "Not an ambassador" }, { status: 404 })
    }

    // Get referrals - source of truth for counts
    const { data: referrals } = await supabase
      .from("referrals")
      .select("id, referred_email, status, created_at, verification_date")
      .eq("ambassador_id", ambassador.id)
      .order("created_at", { ascending: false })

    // Get rewards history
    const { data: rewards } = await supabase
      .from("ambassador_rewards")
      .select("*")
      .eq("ambassador_id", ambassador.id)
      .order("created_at", { ascending: false })

    // Get certificates
    const { data: certificates } = await supabase
      .from("ambassador_certificates")
      .select("*")
      .eq("ambassador_id", ambassador.id)
      .order("created_at", { ascending: false })

    // Count directly from referrals table — never trust stale counters on ambassador row
    const allReferrals = referrals || []
    const totalCount = allReferrals.length
    const verifiedCount = allReferrals.filter((r) => r.status === "verified").length

    // Sync the ambassador row counts so they stay fresh
    await supabase
      .from("ambassadors")
      .update({ total_referrals: totalCount, verified_referrals: verifiedCount })
      .eq("id", ambassador.id)

    // Calculate current tier and next milestone
    let currentTier = 0
    let nextMilestone: typeof MILESTONES[0] | null = MILESTONES[0]

    for (let i = 0; i < MILESTONES.length; i++) {
      if (verifiedCount >= MILESTONES[i].count) {
        currentTier = i + 1
        nextMilestone = MILESTONES[i + 1] || null
      } else {
        nextMilestone = MILESTONES[i]
        break
      }
    }

    return NextResponse.json({
      ambassador: {
        id: ambassador.id,
        name: ambassador.name,
        university: ambassador.university,
        referral_code: ambassador.referral_code,
        referral_link: ambassador.referral_link,
        total_referrals: totalCount,
        verified_referrals: verifiedCount,
        reward_level: ambassador.reward_level || 0,
        status: ambassador.status,
        created_at: ambassador.created_at,
      },
      referrals: referrals || [],
      rewards: rewards || [],
      certificates: certificates || [],
      currentTier,
      nextMilestone,
      milestones: MILESTONES,
    })
  } catch (error) {
    console.error("Ambassador stats error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

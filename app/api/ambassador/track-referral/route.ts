import { createServerClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

const MILESTONES = [
  { count: 15, months: 2 },
  { count: 50, months: 3, certificate: true },
  { count: 100, months: 6, certificate: true },
  { count: 500, months: -1, certificate: true, gift: true },
]

async function checkAndApplyRewards(supabase: any, ambassadorId: string, verifiedCount: number) {
  // Get ambassador
  const { data: ambassador } = await supabase
    .from("ambassadors")
    .select("user_id, reward_level, name, university")
    .eq("id", ambassadorId)
    .single()

  if (!ambassador) return

  const currentRewardLevel = ambassador.reward_level || 0

  // Check which milestones have been reached
  for (let i = 0; i < MILESTONES.length; i++) {
    const milestone = MILESTONES[i]
    if (verifiedCount >= milestone.count && currentRewardLevel < i + 1) {
      // This milestone was just reached! Apply rewards
      
      // Calculate plan expiration
      let periodEnd = null
      if (milestone.months > 0) {
        periodEnd = new Date()
        periodEnd.setMonth(periodEnd.getMonth() + milestone.months)
      }

      // Update subscription to Genius
      const subscriptionUpdate: any = {
        plan_type: "genius",
        status: "active",
        current_period_start: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
      
      if (milestone.months === -1) {
        // Lifetime - set far future date
        subscriptionUpdate.current_period_end = new Date("2099-12-31").toISOString()
      } else if (periodEnd) {
        subscriptionUpdate.current_period_end = periodEnd.toISOString()
      }

      await supabase
        .from("subscriptions")
        .upsert({
          user_id: ambassador.user_id,
          ...subscriptionUpdate,
        }, { onConflict: "user_id" })

      // Record the reward
      await supabase.from("ambassador_rewards").insert({
        ambassador_id: ambassadorId,
        milestone: milestone.count,
        reward_type: milestone.months === -1 ? "lifetime_genius" : `genius_${milestone.months}mo`,
        reward_description: milestone.months === -1 
          ? "Lifetime Genius Plan" 
          : `Genius Plan for ${milestone.months} months`,
        issued: true,
        issued_at: new Date().toISOString(),
      })

      // Generate certificate if applicable
      if (milestone.certificate) {
        const certId = `QG-AMB-${new Date().getFullYear()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`
        
        await supabase.from("ambassador_certificates").insert({
          ambassador_id: ambassadorId,
          milestone: milestone.count,
          certificate_data: {
            certificate_id: certId,
            name: ambassador.name,
            university: ambassador.university,
            milestone: milestone.count,
            date_issued: new Date().toISOString(),
          },
        })
      }

      // Update ambassador reward level
      await supabase
        .from("ambassadors")
        .update({ reward_level: i + 1, updated_at: new Date().toISOString() })
        .eq("id", ambassadorId)
    }
  }
}

export async function POST(req: Request) {
  try {
    const supabase = await createServerClient()
    
    let body
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
    }
    
    const { referralCode, referredUserId, referredEmail } = body

    if (!referralCode || !referredUserId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    // Find ambassador by referral code
    const { data: ambassador, error: ambassadorError } = await supabase
      .from("ambassadors")
      .select("id, user_id")
      .eq("referral_code", referralCode)
      .eq("status", "approved")
      .single()

    if (ambassadorError || !ambassador) {
      // Return success even if code invalid - don't break signup flow
      return NextResponse.json({ success: true, tracked: false, reason: "invalid_code" })
    }

    // Prevent self-referral
    if (ambassador.user_id === referredUserId) {
      return NextResponse.json({ success: true, tracked: false, reason: "self_referral" })
    }

    // Check if this user was already referred
    const { data: existingReferral } = await supabase
      .from("referrals")
      .select("id")
      .eq("referred_user_id", referredUserId)
      .maybeSingle()

    if (existingReferral) {
      return NextResponse.json({ success: true, tracked: false, reason: "already_referred" })
    }

    // Create referral record — mark as verified immediately since the user just signed up
    const now = new Date().toISOString()
    const { error: referralError } = await supabase.from("referrals").insert({
      ambassador_id: ambassador.id,
      referral_code: referralCode,
      referred_user_id: referredUserId,
      referred_email: referredEmail || null,
      status: "verified",
      verification_date: now,
    })

    if (referralError) {
      console.error("Referral creation error:", referralError)
      return NextResponse.json({ success: true, tracked: false, reason: "db_error" })
    }

    // Count fresh from the referrals table and sync ambassador row
    const { data: allReferrals } = await supabase
      .from("referrals")
      .select("id, status")
      .eq("ambassador_id", ambassador.id)

    const totalCount = allReferrals?.length || 1
    const verifiedCount = allReferrals?.filter((r) => r.status === "verified").length || 1

    await supabase
      .from("ambassadors")
      .update({
        total_referrals: totalCount,
        verified_referrals: verifiedCount,
        updated_at: now,
      })
      .eq("id", ambassador.id)

    // Try to update profile if it exists
    await supabase
      .from("profiles")
      .update({ referred_by: referralCode })
      .eq("id", referredUserId)

    // Check and apply milestone rewards based on fresh verified count
    await checkAndApplyRewards(supabase, ambassador.id, verifiedCount)

    return NextResponse.json({ success: true, tracked: true, verified_count: verifiedCount })
  } catch (error) {
    console.error("Track referral error:", error)
    // Return success anyway - don't break signup flow
    return NextResponse.json({ success: true, tracked: false, reason: "exception" })
  }
}

// Verify referral (called when user verifies email)
export async function PUT(req: Request) {
  try {
    const supabase = await createServerClient()
    const body = await req.json()
    const { referredUserId } = body

    if (!referredUserId) {
      return NextResponse.json({ error: "Missing user ID" }, { status: 400 })
    }

    // Find pending referral for this user
    const { data: referral } = await supabase
      .from("referrals")
      .select("id, ambassador_id")
      .eq("referred_user_id", referredUserId)
      .eq("status", "pending")
      .single()

    if (!referral) {
      return NextResponse.json({ error: "No pending referral found" }, { status: 404 })
    }

    // Mark referral as verified
    await supabase
      .from("referrals")
      .update({ 
        status: "verified", 
        verification_date: new Date().toISOString() 
      })
      .eq("id", referral.id)

    // Update verified referrals count
    const { data: ambassador } = await supabase
      .from("ambassadors")
      .select("verified_referrals")
      .eq("id", referral.ambassador_id)
      .single()

    const newVerifiedCount = (ambassador?.verified_referrals || 0) + 1

    await supabase
      .from("ambassadors")
      .update({ 
        verified_referrals: newVerifiedCount,
        updated_at: new Date().toISOString()
      })
      .eq("id", referral.ambassador_id)

    // Update user profile
    await supabase
      .from("profiles")
      .update({ referral_verified: true })
      .eq("id", referredUserId)

    // Check and apply milestone rewards
    await checkAndApplyRewards(supabase, referral.ambassador_id, newVerifiedCount)

    return NextResponse.json({ success: true, verified_count: newVerifiedCount })
  } catch (error) {
    console.error("Verify referral error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

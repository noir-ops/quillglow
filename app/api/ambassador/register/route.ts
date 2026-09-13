import { createServerClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

function generateReferralCode(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
  let code = ""
  for (let i = 0; i < 9; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return code
}

export async function POST(req: Request) {
  try {
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await req.json()
    const { name, email, university, country, message } = body

    if (!name || !email || !university) {
      return NextResponse.json({ error: "Name, email, and university are required" }, { status: 400 })
    }

    // Check if user already is an ambassador
    const { data: existing } = await supabase
      .from("ambassadors")
      .select("id, status, referral_code")
      .eq("user_id", user.id)
      .single()

    if (existing) {
      if (existing.status === "approved") {
        return NextResponse.json({ 
          error: "You are already an approved ambassador",
          referral_code: existing.referral_code 
        }, { status: 400 })
      }
      return NextResponse.json({ 
        error: "You already have a pending ambassador application" 
      }, { status: 400 })
    }

    // Generate unique referral code
    let referralCode = generateReferralCode()
    let attempts = 0
    while (attempts < 10) {
      const { data: codeExists } = await supabase
        .from("ambassadors")
        .select("id")
        .eq("referral_code", referralCode)
        .single()
      
      if (!codeExists) break
      referralCode = generateReferralCode()
      attempts++
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://www.quillglow.com"
    const referralLink = `${baseUrl}/auth/signup?ref=${referralCode}`

    // Create ambassador record - auto-approve for now
    const { data: ambassador, error } = await supabase
      .from("ambassadors")
      .insert({
        user_id: user.id,
        name,
        email,
        university,
        country: country || null,
        message: message || null,
        referral_code: referralCode,
        referral_link: referralLink,
        status: "approved", // Auto-approve
        total_referrals: 0,
        verified_referrals: 0,
        reward_level: 0,
      })
      .select()
      .single()

    if (error) {
      console.error("Ambassador registration error:", error)
      return NextResponse.json({ error: "Failed to register as ambassador" }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      ambassador: {
        id: ambassador.id,
        name: ambassador.name,
        referral_code: ambassador.referral_code,
        referral_link: ambassador.referral_link,
        status: ambassador.status,
      }
    })
  } catch (error) {
    console.error("Ambassador registration error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function GET(req: Request) {
  try {
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data: ambassador } = await supabase
      .from("ambassadors")
      .select("*")
      .eq("user_id", user.id)
      .single()

    if (!ambassador) {
      return NextResponse.json({ ambassador: null })
    }

    return NextResponse.json({ ambassador })
  } catch (error) {
    console.error("Ambassador fetch error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

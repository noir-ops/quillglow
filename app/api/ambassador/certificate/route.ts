import { createServerClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { nanoid } from "nanoid"

// Only 3 certificate-eligible milestones: 50, 100, 500
const MILESTONES = [
  { count: 50, tier: "silver", title: "Silver Ambassador", reward: "Genius 3 Months + Certificate" },
  { count: 100, tier: "gold", title: "Gold Ambassador", reward: "Genius 6 Months + Certificate" },
  { count: 500, tier: "diamond", title: "Diamond Ambassador", reward: "Lifetime Genius + Certificate + Gift" },
]

// GET - Fetch certificates for an ambassador
export async function GET() {
  const supabase = await createServerClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Get ambassador profile
  const { data: ambassador } = await supabase
    .from("ambassadors")
    .select("id, verified_referrals")
    .eq("user_id", user.id)
    .single()

  if (!ambassador) {
    return NextResponse.json({ error: "Not an ambassador" }, { status: 403 })
  }

  // Get existing certificates
  const { data: certificates } = await supabase
    .from("ambassador_certificates")
    .select("*")
    .eq("ambassador_id", ambassador.id)
    .order("created_at", { ascending: true })

  // Parse certificate_data for each certificate
  const parsedCertificates = (certificates || []).map(cert => ({
    id: cert.id,
    milestone: cert.milestone,
    certificateData: cert.certificate_data,
    createdAt: cert.created_at,
  }))

  // Check for new eligible milestones
  const earnedMilestones = new Set((certificates || []).map(c => c.milestone))
  const eligibleMilestones = MILESTONES.filter(
    m => (ambassador.verified_referrals || 0) >= m.count && !earnedMilestones.has(m.count)
  )

  return NextResponse.json({
    certificates: parsedCertificates,
    eligibleMilestones,
    verifiedReferrals: ambassador.verified_referrals || 0,
  })
}

// POST - Generate a new certificate
export async function POST(request: Request) {
  const supabase = await createServerClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json()
  const { milestone } = body

  if (!milestone) {
    return NextResponse.json({ error: "Milestone is required" }, { status: 400 })
  }

  const milestoneData = MILESTONES.find(m => m.count === milestone)
  if (!milestoneData) {
    return NextResponse.json({ error: "Invalid milestone" }, { status: 400 })
  }

  // Get ambassador profile with correct column names
  const { data: ambassador } = await supabase
    .from("ambassadors")
    .select("id, name, university, verified_referrals")
    .eq("user_id", user.id)
    .single()

  if (!ambassador) {
    return NextResponse.json({ error: "Not an ambassador" }, { status: 403 })
  }

  // Check eligibility
  const verifiedCount = ambassador.verified_referrals || 0
  if (verifiedCount < milestoneData.count) {
    return NextResponse.json({ 
      error: `Need ${milestoneData.count} verified referrals for ${milestoneData.title}. You have ${verifiedCount}.` 
    }, { status: 400 })
  }

  // Check if already earned
  const { data: existing } = await supabase
    .from("ambassador_certificates")
    .select("id")
    .eq("ambassador_id", ambassador.id)
    .eq("milestone", milestoneData.count)
    .maybeSingle()

  if (existing) {
    return NextResponse.json({ error: "Certificate already earned" }, { status: 400 })
  }

  // Generate unique certificate ID: QG-TIER-RANDOM
  const uniqueId = `QG-${milestoneData.tier.toUpperCase()}-${nanoid(8).toUpperCase()}`

  // Certificate data stored as JSONB
  const certificateData = {
    unique_id: uniqueId,
    tier: milestoneData.tier,
    title: milestoneData.title,
    ambassador_name: ambassador.name,
    university: ambassador.university,
    referral_count: verifiedCount,
    issued_at: new Date().toISOString(),
    founder_signature: "Malshan Dissanayaka",
    founder_title: "Founder of QuillGlow",
  }

  // Create certificate using actual DB columns
  const { data: certificate, error: insertError } = await supabase
    .from("ambassador_certificates")
    .insert({
      ambassador_id: ambassador.id,
      milestone: milestoneData.count,
      certificate_data: certificateData,
      certificate_url: `/ambassador/certificate/${uniqueId}`,
    })
    .select()
    .single()

  if (insertError) {
    console.error("Failed to create certificate:", insertError)
    return NextResponse.json({ error: "Failed to generate certificate" }, { status: 500 })
  }

  return NextResponse.json({ 
    certificate: {
      id: certificate.id,
      uniqueId,
      ...certificateData,
    }
  })
}

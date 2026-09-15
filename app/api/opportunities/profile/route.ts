import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getProfile, refreshOpportunityScores, upsertProfile } from "@/lib/services/opportunities"

export const dynamic = "force-dynamic"

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  return NextResponse.json({ profile: await getProfile(user.id) })
}

export async function POST(req: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const body = await req.json()
    const profile = await upsertProfile(user.id, {
      country: body.country ?? null,
      date_of_birth: body.dateOfBirth ?? null,
      education_level: body.educationLevel ?? null,
      gender: body.gender ?? null,
      syllabus: body.syllabus ?? null,
      target_subjects: body.targetSubjects ?? null,
      household_income_band: body.householdIncomeBand ?? null,
    })
    // Profile completeness is 35% of Scholarship Readiness — refresh immediately.
    await refreshOpportunityScores(user.id)
    return NextResponse.json({ profile })
  } catch (err) {
    console.error("[opportunities/profile]", err)
    return NextResponse.json({ error: "Failed to save profile" }, { status: 500 })
  }
}

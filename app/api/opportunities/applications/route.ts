import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { listApplications, refreshOpportunityScores, saveApplication } from "@/lib/services/opportunities"

export const dynamic = "force-dynamic"

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  return NextResponse.json({ applications: await listApplications(user.id) })
}

export async function POST(req: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const { opportunityId, status, notes } = await req.json()
    if (!opportunityId) {
      return NextResponse.json({ error: "opportunityId is required" }, { status: 400 })
    }
    const application = await saveApplication(user.id, opportunityId, status ?? "saved", notes)
    void refreshOpportunityScores(user.id)
    return NextResponse.json({ application })
  } catch (err) {
    console.error("[opportunities/applications]", err)
    return NextResponse.json({ error: "Failed to save application" }, { status: 500 })
  }
}

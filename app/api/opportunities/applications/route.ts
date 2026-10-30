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
    // A bookmark must never reset an application or erase its essay. Conflict
    // DO NOTHING also protects against an Apply/Save race across browser tabs.
    if (!status || status === "saved") {
      const { data: created, error } = await supabase.from("opportunity_applications")
        .upsert({ user_id: user.id, opportunity_id: opportunityId, status: "saved", notes: typeof notes === "string" ? notes : null },
          { onConflict: "user_id,opportunity_id", ignoreDuplicates: true })
        .select("id, status").maybeSingle()
      if (error) throw new Error(error.message)
      if (created) return NextResponse.json({ application: created })
      const { data: existing, error: readError } = await supabase.from("opportunity_applications")
        .select("id, status").eq("user_id", user.id).eq("opportunity_id", opportunityId).maybeSingle()
      if (readError || !existing) throw new Error("Could not save application")
      return NextResponse.json({ application: existing })
    }
    const application = await saveApplication(user.id, opportunityId, status ?? "saved", notes)
    void refreshOpportunityScores(user.id)
    return NextResponse.json({ application })
  } catch (err) {
    console.error("[opportunities/applications]", err)
    return NextResponse.json({ error: "Failed to save application" }, { status: 500 })
  }
}

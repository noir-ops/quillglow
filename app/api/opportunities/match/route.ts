import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { matchOpportunities, refreshOpportunityScores } from "@/lib/services/opportunities"

export const dynamic = "force-dynamic"

/** Ranked opportunities this student is eligible for. */
export async function GET(req: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const url = new URL(req.url)
  const limit = Number(url.searchParams.get("limit") ?? 20)
  const types = url.searchParams
    .get("type")
    ?.split(",")
    .map((t) => t.trim())
    .filter(Boolean)

  try {
    let matches = await matchOpportunities(user.id, Math.min(limit, 50))

    // Filter after matching rather than inside match_opportunities(), so the
    // eligibility rules stay defined in exactly one place.
    if (types?.length) matches = matches.filter((m) => types.includes(m.opportunity_type))

    // Scores depend on the match set, so refresh them alongside — cheap, no LLM.
    void refreshOpportunityScores(user.id)

    return NextResponse.json({ matches })
  } catch (err) {
    // A real failure now returns a real error status instead of a silent
    // 200 with an empty array — the frontend needs to be able to tell the
    // difference between "you're not eligible for anything" and "this broke."
    console.error("[api/opportunities/match]", err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load opportunities" },
      { status: 500 },
    )
  }
}

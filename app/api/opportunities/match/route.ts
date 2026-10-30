import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { matchOpportunities, refreshOpportunityScores } from "@/lib/services/opportunities"
import { publicListingExtras } from "@/lib/opportunities/presentation"

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

    // Preserve the SQL matching rules; add only approved display details and
    // this student's own application state (never another applicant's data).
    if (matches.length) {
      const ids = matches.map(m => m.opportunity_id)
      const [listings, applications] = await Promise.all([
        supabase.from("opportunities")
          .select("id, description, award_currency, covers, is_rolling, requires_essay, requires_recommendation, metadata")
          .in("id", ids).eq("status", "active").eq("review_status", "approved"),
        supabase.from("opportunity_applications").select("id, opportunity_id, status")
          .eq("user_id", user.id).in("opportunity_id", ids),
      ])
      if (listings.error || applications.error) throw new Error("Could not load scholarship details")
      const details = new Map((listings.data ?? []).map(o => [o.id, o]))
      const ownApps = new Map((applications.data ?? []).map(a => [a.opportunity_id, { id: a.id, status: a.status }]))
      matches = matches.filter(m => details.has(m.opportunity_id)).map(m => {
        const detail = details.get(m.opportunity_id)!
        const { metadata, ...display } = detail
        return { ...m, ...display, ...publicListingExtras(metadata), application: ownApps.get(m.opportunity_id) ?? null }
      })
    }

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

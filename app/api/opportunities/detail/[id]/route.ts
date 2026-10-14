import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { publicListingExtras } from "@/lib/opportunities/presentation"

export const dynamic = "force-dynamic"

/** Public detail for the Apply dialog — only approved+active listings, matching the same visibility RLS students already get on the list. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data, error } = await supabase
    .from("opportunities")
    .select("id, title, provider, opportunity_type, description, award_amount, award_currency, covers, countries, education_level, subjects, requires_essay, requires_recommendation, deadline, is_rolling, metadata")
    .eq("id", id)
    .eq("status", "active")
    .eq("review_status", "approved")
    .single()

  if (error || !data) return NextResponse.json({ error: "Not found" }, { status: 404 })
  const { data: application, error: appError } = await supabase.from("opportunity_applications")
    .select("id, status").eq("opportunity_id", id).eq("user_id", user.id).maybeSingle()
  if (appError) return NextResponse.json({ error: "Could not load application status" }, { status: 500 })
  const { metadata, ...listing } = data
  return NextResponse.json({ opportunity: { ...listing, ...publicListingExtras(metadata) }, application })
}

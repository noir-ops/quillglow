import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { normaliseForm, validateApplication } from "@/lib/applications/form"

export const dynamic = "force-dynamic"

/**
 * Submit an in-progress application for review.
 *
 * Two layers of checks, in order:
 *  1. The full application form (lib/applications/form.ts) — every required
 *     field and upload across all seven sections. Same validator the form
 *     page uses for live feedback, so the rules can't drift apart. Run on
 *     the server against what's actually STORED, never against what the
 *     browser claims.
 *  2. submit_application() in the database — the opportunity's own
 *     requirements (essay, recommendation) and the status transition.
 */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: app } = await supabase
    .from("opportunity_applications")
    .select("id, status, form_data, opportunities(requires_recommendation)")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle()
  if (!app) return NextResponse.json({ error: "Application not found" }, { status: 404 })

  const { data: docs } = await supabase
    .from("secure_documents")
    .select("document_type")
    .eq("resource_type", "opportunity_application")
    .eq("resource_id", id)
    .is("deleted_at", null)

  const opp = (Array.isArray(app.opportunities) ? app.opportunities[0] : app.opportunities) as
    | { requires_recommendation: boolean | null }
    | null

  const result = validateApplication(normaliseForm(app.form_data), {
    uploadedTypes: (docs ?? []).map((d) => d.document_type),
    requiresRecommendation: !!opp?.requires_recommendation,
  })
  if (!result.valid) {
    return NextResponse.json(
      { error: "Please complete every required field before submitting.", errors: result.errors },
      { status: 400 },
    )
  }

  const { data, error } = await supabase.rpc("submit_application", {
    p_user_id: user.id,
    p_application_id: id,
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  const row = Array.isArray(data) ? data[0] : data
  return NextResponse.json({ status: row?.status, submittedAt: row?.submitted_at })
}

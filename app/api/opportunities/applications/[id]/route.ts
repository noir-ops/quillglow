import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { normaliseForm } from "@/lib/applications/form"

export const dynamic = "force-dynamic"

/**
 * One application with everything the form page needs: the saved answers,
 * the scholarship's details (auto-loaded into Section 3), and the documents
 * already uploaded against it.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: app, error } = await supabase
    .from("opportunity_applications")
    .select(
      "id, status, form_data, created_at, submitted_at, screened_at, decided_at, archived_at, opportunities(id, title, provider, opportunity_type, description, award_amount, award_currency, deadline, is_rolling, requires_essay, requires_recommendation)",
    )
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  if (!app) return NextResponse.json({ error: "Application not found" }, { status: 404 })

  const { data: documents } = await supabase
    .from("secure_documents")
    .select("id, document_type, original_filename, verification_status, created_at")
    .eq("resource_type", "opportunity_application")
    .eq("resource_id", id)
    .is("deleted_at", null)
    .order("created_at")

  const opportunity = Array.isArray(app.opportunities) ? app.opportunities[0] : app.opportunities
  return NextResponse.json({
    application: { ...app, opportunities: undefined, form_data: normaliseForm(app.form_data) },
    opportunity,
    documents: documents ?? [],
  })
}

/**
 * Update a draft application (essay text, answers, etc.).
 *
 * Deliberately restricted to 'saved' / 'in_progress'. Once an application
 * is submitted it becomes a record a benefactor may already be reviewing —
 * editing it out from under them would be wrong, and withdrawing is the
 * correct action at that point instead.
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: "Invalid request body" }, { status: 400 })

  const { data: existing, error: fetchError } = await supabase
    .from("opportunity_applications")
    .select("id, status")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle()

  if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 400 })
  if (!existing) return NextResponse.json({ error: "Application not found" }, { status: 404 })
  if (!["saved", "in_progress"].includes(existing.status)) {
    return NextResponse.json(
      { error: "Only draft applications can be edited. Withdraw it first if you need to make changes." },
      { status: 400 },
    )
  }

  // Whitelist the editable fields explicitly — never spread the request
  // body into an update, or a caller could set status/award_amount/
  // payment_status on their own application. Only `notes` and `documents`
  // exist on this table (019); there is no essay/answers column, despite
  // the apply dialog's wording.
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (typeof body.notes === "string") updates.notes = body.notes
  if (Array.isArray(body.documents)) updates.documents = body.documents

  // The full application form (064). Normalised so only known sections and
  // fields are stored, never arbitrary keys from the request.
  if (body.form_data && typeof body.form_data === "object") {
    const form = normaliseForm(body.form_data)
    if (JSON.stringify(form).length > 100_000) {
      return NextResponse.json({ error: "Application is too large to save" }, { status: 400 })
    }
    updates.form_data = form
    // The personal statement is mirrored into `notes`, which is what the
    // existing submit_application() essay check and the review screens read.
    updates.notes = form.statement.text
    if (existing.status === "saved") updates.status = "in_progress"
  }

  if (Object.keys(updates).length === 1) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 })
  }

  const { data, error } = await supabase
    .from("opportunity_applications")
    .update(updates)
    .eq("id", id)
    .eq("user_id", user.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ application: data })
}

/**
 * Delete a draft application outright.
 *
 * Same restriction as PATCH, for the same reason: a submitted application
 * is part of a benefactor's review queue and shouldn't silently disappear.
 * Withdrawing (which leaves a 'withdrawn' record) is the right action
 * there; deleting is only for drafts the student never submitted.
 */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: existing, error: fetchError } = await supabase
    .from("opportunity_applications")
    .select("id, status")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle()

  if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 400 })
  if (!existing) return NextResponse.json({ error: "Application not found" }, { status: 404 })
  if (!["saved", "in_progress"].includes(existing.status)) {
    return NextResponse.json(
      { error: "Only draft applications can be deleted. Use Withdraw for a submitted application." },
      { status: 400 },
    )
  }

  const { error } = await supabase
    .from("opportunity_applications")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ success: true })
}

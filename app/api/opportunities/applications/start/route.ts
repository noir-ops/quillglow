import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { emptyForm } from "@/lib/applications/form"

export const dynamic = "force-dynamic"

/**
 * Start (or resume) an application for an opportunity, returning its id so
 * the form page can open it.
 *
 * Deliberately NOT the upsert in saveApplication(): that overwrites status
 * and notes on conflict, so clicking "Apply" on a scholarship you'd already
 * submitted would silently turn it back into a draft and erase the essay.
 * Here an existing application is always reused untouched; only a
 * bookmark ('saved') is promoted to 'in_progress'.
 */
export async function POST(req: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json().catch(() => null)
  const opportunityId = body?.opportunityId
  if (!opportunityId) return NextResponse.json({ error: "opportunityId is required" }, { status: 400 })

  const { data: opp } = await supabase.from("opportunities").select("id").eq("id", opportunityId).maybeSingle()
  if (!opp) return NextResponse.json({ error: "Opportunity not found" }, { status: 404 })

  const { data: existing } = await supabase
    .from("opportunity_applications")
    .select("id, status")
    .eq("user_id", user.id)
    .eq("opportunity_id", opportunityId)
    .maybeSingle()

  if (existing) {
    if (existing.status === "saved") {
      await supabase.from("opportunity_applications").update({ status: "in_progress" }).eq("id", existing.id)
    }
    return NextResponse.json({ applicationId: existing.id })
  }

  // Pre-fill what we already know, so the learner isn't retyping it.
  const { data: profile } = await supabase.from("profiles").select("display_name").eq("id", user.id).maybeSingle()
  const form = emptyForm()
  form.personal.fullName = profile?.display_name ?? ""
  form.personal.email = user.email ?? ""

  const { data: created, error } = await supabase
    .from("opportunity_applications")
    .insert({ user_id: user.id, opportunity_id: opportunityId, status: "in_progress", form_data: form })
    .select("id")
    .single()

  if (error || !created) {
    console.error("[applications/start] insert failed:", error?.message)
    return NextResponse.json({ error: "Could not start application", detail: error?.message }, { status: 500 })
  }

  return NextResponse.json({ applicationId: created.id })
}

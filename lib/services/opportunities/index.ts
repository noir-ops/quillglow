/**
 * Opportunities service — scholarships, competitions, grants.
 *
 * Matching runs against the Learning Graph, so improving in a subject
 * immediately changes which opportunities surface. No duplicate eligibility
 * logic lives here; the SQL function is authoritative.
 */

import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"

export interface OpportunityMatch {
  opportunity_id: string
  title: string
  provider: string | null
  opportunity_type: string
  award_amount: number | null
  deadline: string | null
  match_score: number
  reasons: {
    strong_concepts: number
    exam_readiness: number
    days_left: number | null
    subject_match: string[] | null
  }
}

export interface OpportunityProfile {
  country?: string | null
  date_of_birth?: string | null
  education_level?: string | null
  gender?: string | null
  syllabus?: string | null
  target_subjects?: string[] | null
  household_income_band?: string | null
}

export type ApplicationStatus =
  | "saved"
  | "in_progress"
  | "submitted"
  | "shortlisted"
  | "awarded"
  | "rejected"
  | "withdrawn"

/** Ranked, eligibility-filtered opportunities for a student. */
export async function matchOpportunities(userId: string, limit = 20): Promise<OpportunityMatch[]> {
  const admin = createAdminClient()
  const { data, error } = await admin.rpc("match_opportunities", { p_user_id: userId, p_limit: limit })
  if (error) {
    // Was silently swallowed into an empty array — indistinguishable from a
    // genuine zero-match result at every layer above this one, including the
    // browser. A real RPC failure (missing migration, bad function signature)
    // looked identical to "you're just not eligible for anything yet."
    console.error("[opportunities] match failed:", error.message)
    throw new Error(`Matching failed: ${error.message}`)
  }
  return (data ?? []) as OpportunityMatch[]
}

export async function getProfile(userId: string) {
  const admin = createAdminClient()
  const { data } = await admin
    .from("student_opportunity_profiles")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle()
  return data
}

export async function upsertProfile(userId: string, profile: OpportunityProfile) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("student_opportunity_profiles")
    .upsert({ user_id: userId, ...profile, updated_at: new Date().toISOString() }, { onConflict: "user_id" })
    .select()
    .single()
  if (error) throw new Error(error.message)
  return data
}

export async function listApplications(userId: string) {
  const admin = createAdminClient()
  const { data } = await admin
    .from("opportunity_applications")
    .select("*, opportunities(title, provider, deadline, award_amount, url)")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
  return data ?? []
}

export async function saveApplication(
  userId: string,
  opportunityId: string,
  status: ApplicationStatus = "saved",
  notes?: string,
) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("opportunity_applications")
    .upsert(
      {
        user_id: userId,
        opportunity_id: opportunityId,
        status,
        notes: notes ?? null,
        submitted_at: status === "submitted" ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,opportunity_id" },
    )
    .select()
    .single()
  if (error) throw new Error(error.message)
  return data
}

/** Recompute Scholarship Readiness™ and Opportunity Score™. */
export async function refreshOpportunityScores(userId: string) {
  const admin = createAdminClient()
  const [sr, os] = await Promise.all([
    admin.rpc("compute_scholarship_readiness", { p_user_id: userId }),
    admin.rpc("compute_opportunity_score", { p_user_id: userId }),
  ])
  return {
    scholarshipReadiness: Number(sr.data ?? 0),
    opportunityScore: Number(os.data ?? 0),
  }
}

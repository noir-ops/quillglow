/**
 * Recommendation Engine — named as a component in Section C of the proposal,
 * and the mechanism behind Section E:
 *
 *   "If a student improves in physics, the scholarship engine immediately
 *    recommends STEM scholarships without duplicate logic."
 *
 * The "without duplicate logic" part is the important constraint. This service
 * does NOT reimplement eligibility rules — it calls the same
 * `match_opportunities()` function the Opportunities page uses, so there is one
 * definition of who qualifies for what.
 */

import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"

export interface Recommendation {
  id: number
  kind: string
  target_type: string | null
  target_id: string | null
  title: string
  reason: string | null
  score: number | null
  surfaced_at: string | null
  created_at: string
}

/**
 * Generate opportunity recommendations for a student. Idempotent — repeat calls
 * don't duplicate, so this is safe to trigger on every mastery change.
 */
export async function generateOpportunityRecommendations(
  userId: string,
  limit = 5,
): Promise<number> {
  try {
    const admin = createAdminClient()
    const { data, error } = await admin.rpc("generate_opportunity_recommendations", {
      p_user_id: userId,
      p_limit: limit,
    })
    if (error) {
      console.error("[recommendation] generate failed:", error.message)
      return 0
    }
    return Number(data ?? 0)
  } catch (err) {
    console.error("[recommendation] generate threw:", err)
    return 0
  }
}

/** Active (undismissed) recommendations for a student. */
export async function listRecommendations(userId: string, limit = 20): Promise<Recommendation[]> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from("recommendations")
    .select("id, kind, target_type, target_id, title, reason, score, surfaced_at, created_at")
    .eq("user_id", userId)
    .is("dismissed_at", null)
    .order("score", { ascending: false, nullsFirst: false })
    .limit(limit)

  if (error) {
    console.error("[recommendation] list failed:", error.message)
    return []
  }
  return (data ?? []) as Recommendation[]
}

export async function dismissRecommendation(userId: string, id: number): Promise<boolean> {
  const supabase = await createClient()
  const { error } = await supabase
    .from("recommendations")
    .update({ dismissed_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", userId)
  return !error
}

/**
 * Fire-and-forget hook for Section E. Called after mastery changes so improving
 * in a subject surfaces the opportunities that improvement unlocks, without
 * making the student wait for it.
 */
export function refreshRecommendations(userId: string): void {
  void generateOpportunityRecommendations(userId)
}

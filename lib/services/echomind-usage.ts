import { createAdminClient } from "@/lib/supabase/admin"

/**
 * EchoMind free-plan allowance: 3 sessions in any rolling 30 days, unlimited
 * on Genius. One place for the rule, used by the chat route, the weekly
 * review test and the usage display, so they can never disagree.
 *
 * Counts SESSION STARTS in echomind_usage (migration 065), not message rows
 * in echomind_logs — counting messages meant a free learner's "3 sessions"
 * was really 3 replies, and counting deletable history would have let
 * learners reset their allowance by deleting sessions.
 */
export const ECHOMIND_FREE_LIMIT = 3
const WINDOW_DAYS = 30

export interface EchoMindAllowance {
  isGenius: boolean
  unlimited: boolean
  used: number
  limit: number | null
  remaining: number | null
  resetDate: string | null
  allowed: boolean
}

export async function getEchoMindAllowance(supabase: any, userId: string): Promise<EchoMindAllowance> {
  const { data: subscription } = await supabase
    .from("subscriptions")
    .select("status, plan_type")
    .eq("user_id", userId)
    .eq("plan_type", "genius")
    .in("status", ["active", "trialing"])
    .limit(1)
    .maybeSingle()

  if (subscription) {
    return { isGenius: true, unlimited: true, used: 0, limit: null, remaining: null, resetDate: null, allowed: true }
  }

  const since = new Date(Date.now() - WINDOW_DAYS * 86_400_000).toISOString()
  const { data: rows, error } = await supabase
    .from("echomind_usage")
    .select("created_at")
    .eq("user_id", userId)
    .gte("created_at", since)
    .order("created_at", { ascending: true })

  // Table not created yet (migration 065 not run): fail open rather than lock
  // every free learner out of EchoMind, and say so in the logs.
  if (error) {
    console.error("[echomind-usage] could not read usage (has migration 065 been run?):", error.message)
    return {
      isGenius: false,
      unlimited: false,
      used: 0,
      limit: ECHOMIND_FREE_LIMIT,
      remaining: ECHOMIND_FREE_LIMIT,
      resetDate: null,
      allowed: true,
    }
  }

  const used = rows?.length ?? 0
  const remaining = Math.max(0, ECHOMIND_FREE_LIMIT - used)
  // A slot frees up 30 days after the oldest session in the window.
  const resetDate = rows && rows.length > 0
    ? new Date(new Date(rows[0].created_at).getTime() + WINDOW_DAYS * 86_400_000).toISOString()
    : null

  return { isGenius: false, unlimited: false, used, limit: ECHOMIND_FREE_LIMIT, remaining, resetDate, allowed: remaining > 0 }
}

/** Records one session start. Written with the service role — learners can't write this table. */
export async function recordEchoMindSession(userId: string, kind: "session" | "weekly_review" = "session") {
  try {
    const { error } = await createAdminClient().from("echomind_usage").insert({ user_id: userId, kind })
    if (error) console.error("[echomind-usage] record failed:", error.message)
  } catch (err) {
    console.error("[echomind-usage] record failed:", err)
  }
}

export const LIMIT_REACHED_MESSAGE =
  "You've used all your 3 EchoMind sessions this month. Exam coming up? Unlock unlimited for $4.99 — less than a coffee. ☕"

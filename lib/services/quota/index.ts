/**
 * AI quota service.
 *
 * Wraps every AI route so that usage is checked *and* consumed atomically
 * before the model is called, and refunded if the call fails.
 *
 * Why not the old `incrementUsage()`:
 *   - it did SELECT-then-UPDATE in JS, so concurrent requests raced and quota
 *     leaked (verified: 20 parallel requests against a limit of 10 let ~17 through)
 *   - it only counted; nothing ever blocked
 *   - it was applied to 2 of 78 routes
 *
 * All enforcement lives in the `consume_ai_quota` Postgres function so it can't
 * be raced or bypassed from the client.
 */

import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { FEATURE_INFO } from "@/lib/billing/usage"

/**
 * Feature keys. Must match rows in `plan_limits`.
 * An unknown key falls back to the umbrella `ai_total` cap.
 */
export type AIFeature =
  | "ai_total"
  | "flashcards"
  | "study_plan"
  | "syllabus_analysis"
  | "revision_notes"
  | "mind_map"
  | "mock_exam"
  | "essay"
  | "exam_questions"
  | "audio_overview"
  | "echomind"
  | "quilly_chat"
  | "tutor_chat"
  | "study_agent"
  | "writereal"
  | "search_summary"
  | "quest_generation"
  | "stress_relief"
  // 066: per-feature entitlements
  | "writereal_detect"
  | "writereal_grammar"
  | "writereal_humanize"
  | "writereal_paraphrase"
  | "task_suggestions"
  | "weekly_review"

export interface QuotaResult {
  allowed: boolean
  used: number
  limit: number // -1 = unlimited
  remaining: number // -1 = unlimited
  plan: string
}

/**
 * Atomically check and consume quota. Returns `allowed: false` without
 * incrementing when the cap would be exceeded.
 */
export async function consumeQuota(
  userId: string,
  feature: AIFeature,
  amount = 1,
): Promise<QuotaResult> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc("consume_ai_quota", {
    p_user_id: userId,
    p_feature: feature,
    p_amount: amount,
  })

  if (error) {
    console.error("[quota] consume failed:", error.message)
    // Fail open: a broken quota check should not take the product down.
    // It is logged loudly so the failure is visible.
    return { allowed: true, used: 0, limit: -1, remaining: -1, plan: "unknown" }
  }

  const row = Array.isArray(data) ? data[0] : data
  return {
    allowed: row?.allowed ?? true,
    used: row?.used ?? 0,
    limit: row?.limit ?? -1,
    remaining: row?.remaining ?? -1,
    plan: row?.plan ?? "scholar",
  }
}

/**
 * Give back a consumed unit. Call when the AI request fails *after* quota was
 * taken, so users aren't charged for our errors. Uses the service role because
 * refunds are deliberately not grantable to end users.
 */
export async function refundQuota(userId: string, feature: AIFeature, amount = 1): Promise<void> {
  try {
    const admin = createAdminClient()
    await admin.rpc("refund_ai_quota", {
      p_user_id: userId,
      p_feature: feature,
      p_amount: amount,
    })
  } catch (err) {
    console.error("[quota] refund failed:", err)
  }
}

/** Read-only usage snapshot, for dashboards and upgrade prompts. */
export async function getQuotaStatus(userId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc("get_ai_quota_status", { p_user_id: userId })
  if (error) {
    console.error("[quota] status failed:", error.message)
    return []
  }
  return data ?? []
}

export interface QuotaContext {
  userId: string
  quota: QuotaResult
  /** Call to refund this request's quota (already bound to user + feature). */
  refund: () => Promise<void>
}

/**
 * Route wrapper: authenticates, consumes quota, runs the handler, and refunds
 * automatically if the handler throws or returns a 5xx.
 *
 * Usage:
 *
 *   export const POST = withQuota("mock_exam", async (req, { userId }) => {
 *     // ...business logic. Quota is already consumed.
 *     return NextResponse.json({ ok: true })
 *   })
 */
export function withQuota(
  feature: AIFeature,
  handler: (req: Request, ctx: QuotaContext) => Promise<Response>,
  options: { amount?: number; refundOnError?: boolean; refundOnClientError?: boolean } = {},
) {
  const amount = options.amount ?? 1
  const refundOnError = options.refundOnError ?? true

  return async (req: Request): Promise<Response> => {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const quota = await consumeQuota(user.id, feature, amount)

    if (!quota.allowed) {
      return NextResponse.json(
        deniedBody(feature, quota),
        { status: 429 },
      )
    }

    const refund = () => refundQuota(user.id, feature, amount)

    try {
      const res = await handler(req, { userId: user.id, quota, refund })

      // The model call failed — don't bill the user for our outage.
      // Also refunds a rejected request (4xx other than the limit itself) when
      // asked to, so bad input never costs a learner a use.
      const clientError = options.refundOnClientError && res.status >= 400 && res.status < 500 && res.status !== 429
      if (refundOnError && (res.status >= 500 || clientError)) {
        await refund()
      }

      // Surface remaining balance to the client for UI hints.
      if (quota.limit >= 0) {
        res.headers.set("X-Quota-Remaining", String(quota.remaining))
        res.headers.set("X-Quota-Limit", String(quota.limit))
      }
      return res
    } catch (err) {
      if (refundOnError) await refund()
      throw err
    }
  }
}

/**
 * Lightweight inline guard for existing routes that already do their own auth
 * and have multiple HTTP methods (so wrapping the whole export isn't practical).
 *
 * Returns a 429 `Response` to return immediately, or `null` to proceed.
 *
 *   const denied = await enforceQuota(user.id, "mock_exam")
 *   if (denied) return denied
 *
 * On failure paths, call `refundQuota(user.id, "mock_exam")` so users aren't
 * billed for our errors.
 */
export async function enforceQuota(
  userId: string,
  feature: AIFeature,
  amount = 1,
): Promise<Response | null> {
  const quota = await consumeQuota(userId, feature, amount)
  if (quota.allowed) return null

  return NextResponse.json(
    deniedBody(feature, quota),
    { status: 429 },
  )
}

/**
 * The body every limit refusal returns — names the feature and its number
 * (each feature has its own visible limit now, scripts/066). The app-wide
 * QuotaListener turns it into an upgrade prompt.
 */
export function deniedBody(feature: AIFeature, quota: QuotaResult) {
  const info = FEATURE_INFO[feature]
  const label = info?.label ?? "this feature"
  const unit = info?.unit ?? "uses"
  const message =
    quota.limit === 0
      ? `${label} is part of the Genius plan.`
      : quota.plan === "genius"
        ? `You've reached this month's fair-use limit for ${label} (${quota.limit} ${unit}). It resets on the 1st.`
        : `You've used all ${quota.limit} ${unit} of ${label} on the free plan this month. Upgrade to Genius for more, or it resets on the 1st.`
  return {
    error: "monthly_limit_reached",
    message,
    feature,
    label,
    used: quota.used,
    limit: quota.limit,
    plan: quota.plan,
    upgradeUrl: "/upgrade",
  }
}

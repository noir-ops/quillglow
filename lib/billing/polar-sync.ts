/**
 * Turns a Polar subscription object into QuillGlow's subscription row.
 * Used by the webhook (POST /api/webhooks/polar) and the nightly
 * reconciliation job (/api/cron/polar-reconcile), so both apply exactly the
 * same rules. Whether a row means "Genius" is then decided in one place: the
 * database function user_plan (scripts/066).
 */

export interface PolarSubscription {
  id: string
  status: string // incomplete | incomplete_expired | trialing | active | past_due | canceled | unpaid
  current_period_start?: string | null
  current_period_end?: string | null
  cancel_at_period_end?: boolean
  ended_at?: string | null
  past_due_at?: string | null
  paused_at?: string | null
  resumes_at?: string | null
  modified_at?: string | null
  created_at?: string | null
  customer_id?: string | null
  product_id?: string | null
  checkout_id?: string | null
  recurring_interval?: string | null
  metadata?: Record<string, unknown> | null
  customer?: { id?: string; external_id?: string | null; email?: string | null } | null
}

export type SyncOutcome =
  | "duplicate"
  | "applied"
  | "stale" // an older event than the one already applied
  | "unmatched" // no QuillGlow learner found for this subscription
  | "other_product" // not a Genius product (e.g. a shop item)
  | "other_subscription" // an old subscription's event; the learner has a newer one
  | "dry_run"

export interface SyncResult {
  outcome: SyncOutcome
  userId: string | null
  before?: { plan_type: string; status: string } | null
  after?: { plan_type: string; status: string }
}

/** Explicit Genius product allowlist; missing configuration fails closed. */
export function geniusProductIds(): string[] {
  return [
    process.env.POLAR_PRODUCT_ID_GENIUS,
    process.env.POLAR_PRODUCT_ID_GENIUS_ANNUAL,
    ...(process.env.POLAR_GENIUS_PRODUCT_IDS ?? "").split(","),
  ]
    .map((s) => (s ?? "").trim())
    .filter(Boolean)
}

/** Includes draft products so sandbox verification can prove sync before launch. */
export async function getGeniusProductIds(admin: any): Promise<string[]> {
  const { data, error } = await admin.from("billing_rollout").select("legacy_product_id,monthly_product_id,annual_product_id").eq("id", true).maybeSingle()
  if (error && !["42P01", "PGRST205"].includes(error.code)) throw new Error("Product allowlist unavailable")
  return [...new Set([...geniusProductIds(), data?.legacy_product_id, data?.monthly_product_id, data?.annual_product_id].filter((id): id is string => typeof id === "string" && id.length > 0))]
}

/** Polar status → our row. `now` is injectable for tests. */
export function mapPolarStatus(sub: PolarSubscription, now = new Date()): { plan_type: "genius" | "scholar"; status: string } {
  const future = (d?: string | null) => !!d && new Date(d).getTime() > now.getTime()
  const paused = !!sub.paused_at && (!sub.resumes_at || future(sub.resumes_at))
  if (paused) return { plan_type: "genius", status: "paused" } // user_plan → Scholar while paused

  switch (sub.status) {
    case "active":
      return { plan_type: "genius", status: sub.cancel_at_period_end ? "canceling" : "active" }
    case "trialing":
      return { plan_type: "genius", status: sub.cancel_at_period_end ? "canceling" : "trialing" }
    case "past_due":
    case "unpaid":
      return { plan_type: "genius", status: "past_due" } // 3-day grace, then Scholar (user_plan)
    case "canceled":
      // Cancelled at period end and not yet ended → keep access until then.
      return (!sub.ended_at || future(sub.ended_at)) && future(sub.current_period_end)
        ? { plan_type: "genius", status: "canceling" }
        : { plan_type: "scholar", status: "canceled" }
    case "incomplete":
      return { plan_type: "genius", status: "incomplete" } // not paid yet → Scholar (user_plan)
    case "incomplete_expired":
    default:
      return { plan_type: "scholar", status: "canceled" }
  }
}

/**
 * Finds the learner, then writes the row. `admin` must be the service-role
 * client (writes across learners; the webhook has no signed-in user).
 */
export async function applyPolarSubscription(
  admin: any,
  sub: PolarSubscription,
  { dryRun = false, now = new Date(), expectedUserId, webhookId, eventType }: { dryRun?: boolean; now?: Date; expectedUserId?: string; webhookId?: string; eventType?: string } = {},
): Promise<SyncResult> {
  const products = await getGeniusProductIds(admin)
  if (!products.length) throw new Error("Genius product allowlist is not configured")
  if (!sub.product_id || !products.includes(sub.product_id)) {
    return { outcome: "other_product", userId: null }
  }

  // ── Match the learner, most specific first ────────────────────────────────
  const byColumn = async (col: string, value: unknown) => {
    if (!value || typeof value !== "string") return null
    const { data, error } = await admin.from("subscriptions").select("*").eq(col, value).limit(1).maybeSingle()
    if (error) throw new Error(`subscription lookup failed: ${error.message}`)
    return data ?? null
  }
  let row = await byColumn("polar_subscription_id", sub.id)
  const owner = [sub.metadata?.user_id, sub.customer?.external_id].find(
    id => typeof id === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id),
  )
  // Provider identity outranks a legacy local binding, which the former
  // checkout verifier allowed an unrelated learner to claim.
  let userId: string | null = typeof owner === "string" ? owner : row?.user_id ?? null

  if (!userId) row = await byColumn("polar_checkout_id", sub.checkout_id) // learners whose subscription id was never saved
  if (!userId && !row) row = await byColumn("polar_customer_id", sub.customer_id ?? sub.customer?.id)
  if (!userId && row) userId = row.user_id
  if (!userId) return { outcome: "unmatched", userId: null }

  if (expectedUserId && expectedUserId !== userId) throw new Error("Subscription owner mismatch")
  // The database atomically checks ordering and duplicate deliveries, writes
  // the subscription, and records the event. No read-then-write race.
  const { data, error } = await admin.rpc("sync_polar_subscription", {
    p_user_id: userId, p_snapshot: sub, p_dry_run: dryRun,
    p_webhook_id: webhookId ?? null, p_event_type: eventType ?? null,
  })
  if (error || !data) throw new Error("Subscription sync failed: " + (error?.message || "empty result"))
  return data as SyncResult
}

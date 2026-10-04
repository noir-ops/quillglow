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

/** Genius product IDs. Unset → every subscription is treated as Genius (QuillGlow sells only Genius as a subscription). */
export function geniusProductIds(): string[] {
  return [
    process.env.POLAR_PRODUCT_ID_GENIUS,
    process.env.POLAR_PRODUCT_ID_GENIUS_ANNUAL,
    ...(process.env.POLAR_GENIUS_PRODUCT_IDS ?? "").split(","),
  ]
    .map((s) => (s ?? "").trim())
    .filter(Boolean)
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
      return !sub.ended_at && future(sub.current_period_end)
        ? { plan_type: "genius", status: "canceling" }
        : { plan_type: "scholar", status: "canceled" }
    case "incomplete":
      return { plan_type: "genius", status: "incomplete" } // not paid yet → Scholar (user_plan)
    case "incomplete_expired":
    default:
      return { plan_type: "scholar", status: "canceled" }
  }
}

const isLive = (status: string) => status === "active" || status === "trialing"

/**
 * Finds the learner, then writes the row. `admin` must be the service-role
 * client (writes across learners; the webhook has no signed-in user).
 */
export async function applyPolarSubscription(
  admin: any,
  sub: PolarSubscription,
  { dryRun = false, now = new Date() }: { dryRun?: boolean; now?: Date } = {},
): Promise<SyncResult> {
  const products = geniusProductIds()
  if (products.length > 0 && sub.product_id && !products.includes(sub.product_id)) {
    return { outcome: "other_product", userId: null }
  }

  // ── Match the learner, most specific first ────────────────────────────────
  const byColumn = async (col: string, value: unknown) => {
    if (!value || typeof value !== "string") return null
    const { data } = await admin.from("subscriptions").select("*").eq(col, value).limit(1).maybeSingle()
    return data ?? null
  }
  let row = await byColumn("polar_subscription_id", sub.id)
  let userId: string | null = row?.user_id ?? null

  if (!userId) {
    // Checkout metadata (set by create-checkout), then Polar's external id.
    const meta = sub.metadata?.user_id
    const ext = sub.customer?.external_id
    for (const candidate of [meta, ext]) {
      if (typeof candidate === "string" && /^[0-9a-f-]{36}$/i.test(candidate)) {
        userId = candidate
        break
      }
    }
  }
  if (!userId) row = await byColumn("polar_checkout_id", sub.checkout_id) // learners whose subscription id was never saved
  if (!userId && !row) row = await byColumn("polar_customer_id", sub.customer_id ?? sub.customer?.id)
  if (!userId && row) userId = row.user_id
  if (!userId) return { outcome: "unmatched", userId: null }

  if (!row) row = await byColumn("user_id", userId)

  // An event for an OLD subscription must not overwrite a newer one —
  // unless it is itself a live subscription taking over.
  if (row?.polar_subscription_id && row.polar_subscription_id !== sub.id && !isLive(sub.status)) {
    return { outcome: "other_subscription", userId }
  }

  // Out-of-order delivery: never let an older state replace a newer one.
  const incomingAt = sub.modified_at ?? sub.created_at ?? null
  if (
    row?.polar_subscription_id === sub.id &&
    row?.polar_modified_at &&
    incomingAt &&
    new Date(incomingAt).getTime() < new Date(row.polar_modified_at).getTime()
  ) {
    return { outcome: "stale", userId }
  }

  const mapped = mapPolarStatus(sub, now)
  const before = row ? { plan_type: row.plan_type, status: row.status } : null
  const fields = {
    plan_type: mapped.plan_type,
    status: mapped.status,
    polar_subscription_id: sub.id,
    polar_customer_id: sub.customer_id ?? sub.customer?.id ?? row?.polar_customer_id ?? null,
    polar_product_id: sub.product_id ?? row?.polar_product_id ?? null,
    polar_checkout_id: row?.polar_checkout_id ?? sub.checkout_id ?? null,
    current_period_start: sub.current_period_start ?? null,
    current_period_end: sub.current_period_end ?? null,
    cancel_at_period_end: !!sub.cancel_at_period_end,
    past_due_at: mapped.status === "past_due" ? sub.past_due_at ?? row?.past_due_at ?? now.toISOString() : null,
    ended_at: sub.ended_at ?? null,
    recurring_interval: sub.recurring_interval ?? null,
    polar_modified_at: incomingAt,
    updated_at: now.toISOString(),
  }

  if (dryRun) return { outcome: "dry_run", userId, before, after: mapped }

  const { error } = row
    ? await admin.from("subscriptions").update(fields).eq("user_id", userId)
    : await admin.from("subscriptions").insert({ user_id: userId, ...fields })
  if (error) throw new Error(`subscription write failed: ${error.message}`)

  return { outcome: "applied", userId, before, after: mapped }
}

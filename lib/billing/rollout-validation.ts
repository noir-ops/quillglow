import type { BillingRollout } from "@/lib/billing/pricing"
import { polarFetch, getPolarCheckout, getPolarSubscription } from "@/lib/polar"

export function polarEnvironment(): "sandbox" | "production" {
  return (process.env.POLAR_BASE_URL ?? "").includes("sandbox-api.polar.sh") ? "sandbox" : "production"
}
export function assertProduct(product: any, id: string, cents: number, interval: "month" | "year") {
  if (!product || product.id !== id || product.is_archived || product.is_recurring !== true) throw new Error("Product must be an active recurring product")
  const prices = (product.prices ?? []).filter((p: any) => !p.is_archived)
  if (prices.length !== 1 || prices[0].amount_type !== "fixed" || prices[0].price_amount !== cents || prices[0].price_currency !== "usd" ||
    (product.recurring_interval ?? prices[0].recurring_interval) !== interval || (product.recurring_interval_count ?? prices[0].recurring_interval_count ?? 1) !== 1) {
    throw new Error(`Product does not match the configured USD amount and ${interval} interval`)
  }
}
export async function verifyProduct(id: string | null, cents: number, interval: "month" | "year") {
  if (!id) throw new Error("Configure the Polar product IDs first")
  const response = await polarFetch(`/products/${encodeURIComponent(id)}`)
  if (!response.ok) throw new Error("Could not read the configured Polar product")
  assertProduct(await response.json(), id, cents, interval)
}
export async function verifyProducts(r: BillingRollout) {
  if (new Set([r.legacy_product_id, r.monthly_product_id, r.annual_product_id]).size !== 3) throw new Error("Use distinct legacy, monthly and annual products")
  await Promise.all([verifyProduct(r.legacy_product_id, r.legacy_monthly_cents, "month"),
    verifyProduct(r.monthly_product_id, r.monthly_cents, "month"), verifyProduct(r.annual_product_id, r.annual_cents, "year")])
}
async function syncedOwner(admin: any, sub: any, canceled: boolean) {
  const { data: local, error } = await admin.from("subscriptions").select("*").eq("polar_subscription_id", sub.id).maybeSingle()
  const owner = sub.customer?.external_id ?? sub.metadata?.user_id
  if (error || !local || !owner || owner !== local.user_id) throw new Error("Subscription ownership is not synchronized")
  const { data: events, error: eventError } = await admin.from("polar_webhook_events").select("webhook_id")
    .eq("polar_subscription_id", sub.id).eq("outcome", "applied").limit(1)
  if (eventError || !events?.length) throw new Error("No successful signed webhook application exists for this subscription")
  const { data: plan, error: planError } = await admin.rpc("user_plan", { p_user_id: local.user_id })
  if (planError || plan !== (canceled ? "scholar" : "genius")) throw new Error("Effective access does not match the provider lifecycle")
  if (sub.current_period_end && new Date(local.current_period_end).getTime() !== Date.parse(sub.current_period_end)) throw new Error("Billing-period end is not synchronized")
  return local.user_id as string
}
export async function collectRolloutEvidence(admin: any, r: BillingRollout, input: any) {
  await verifyProducts(r)
  const mainSite = new URL(process.env.NEXT_PUBLIC_MAIN_SITE_URL || "https://www.quillglow.com")
  if (mainSite.protocol !== "https:" && !["localhost", "127.0.0.1"].includes(mainSite.hostname)) throw new Error("Invalid main site URL")
  const loggedOut = await Promise.all(["/api/ai/generate-study-plan", "/api/ai/analyze-syllabus", "/api/stress-relief-chat",
    "/api/ai/generate-flashcards", "/api/ai/task-suggestions", "/api/writereal", "/api/echomind", "/api/study-agent"].map(async (path) => {
      const response = await fetch(`${mainSite.origin}${path}`, { method: "POST", credentials: "omit", redirect: "manual",
        headers: { "Content-Type": "application/json" }, body: "{}", signal: AbortSignal.timeout(8000) })
      if (response.status !== 401) throw new Error(`Logged-out protection failed for ${path} (${response.status})`)
      return { path, status: response.status }
    }))
  const evidence: { kind: string; evidence: object }[] = []
  const users: string[] = []
  for (const [kind, id, expected, amount] of [
    ["monthly_buy", input.monthlyCheckoutId, r.monthly_product_id, r.monthly_cents],
    ["annual_buy", input.annualCheckoutId, r.annual_product_id, r.annual_cents],
    ["discount_buy", input.discountCheckoutId, r.monthly_product_id, r.monthly_cents],
  ] as const) {
    if (typeof id !== "string" || !id || id.length > 200) throw new Error("Supply all three successful test checkout IDs")
    const checkout: any = await getPolarCheckout(id)
    if (checkout.status !== "succeeded" || checkout.product_id !== expected || checkout.currency !== "usd" ||
      checkout.amount !== amount || !checkout.subscription_id) throw new Error(`The ${kind} checkout does not match this rollout`)
    if (kind === "discount_buy" && (!checkout.discount_id || !(checkout.discount_amount > 0))) throw new Error("The discount test must actually apply a discount")
    const sub = await getPolarSubscription(checkout.subscription_id)
    if (sub.product_id !== expected || !["active", "trialing"].includes(sub.status) || !sub.current_period_end || Date.parse(sub.current_period_end) <= Date.now()) throw new Error("Test subscription must have current access and the expected product")
    const user = await syncedOwner(admin, sub, false)
    users.push(user)
    evidence.push({ kind, evidence: { checkoutId: checkout.id, subscriptionId: sub.id, userId: user, netAmount: checkout.net_amount } })
  }
  if (new Set([input.monthlyCheckoutId, input.annualCheckoutId, input.discountCheckoutId]).size !== 3) throw new Error("Use distinct checkout tests")
  if (typeof input.canceledSubscriptionId !== "string" || !input.canceledSubscriptionId) throw new Error("Supply the ended cancellation test subscription")
  const canceled = await getPolarSubscription(input.canceledSubscriptionId)
  if (![r.legacy_product_id, r.monthly_product_id, r.annual_product_id].includes(canceled.product_id) ||
    canceled.status !== "canceled" || (canceled.current_period_end && Date.parse(canceled.current_period_end) > Date.now() && !canceled.ended_at)) throw new Error("Cancellation test must have ended, not just be scheduled")
  const canceledUser = await syncedOwner(admin, canceled, true)
  evidence.push({ kind: "cancel", evidence: { subscriptionId: canceled.id, userId: canceledUser } })
  const { data: jobs, error } = await admin.from("billing_job_state").select("job_name,last_completed_at,last_error,last_summary")
  if (error || !["polar-local", "polar-discovery", "expiry"].every((name) => {
    const job = jobs?.find((j: any) => j.job_name === name)
    return job?.last_completed_at && Date.now() - Date.parse(job.last_completed_at) < 36 * 3600000 &&
      !job.last_error && !job.last_summary?.errors && !job.last_summary?.unmatched
  })) throw new Error("Reconciliation and expiry must have recent successful scheduled runs")
  evidence.push({ kind: "sync_health", evidence: { jobs, loggedOutRoutes: loggedOut } })
  if (input.phase1Confirmed !== true) throw new Error("Review the staging pages against their enforced allowances first")
  const { data: caps, error: capsError } = await admin.from("plan_limits").select("plan_type,feature,monthly_limit")
  if (capsError || !caps?.length) throw new Error("Plan limits unavailable")
  for (const uid of [users[0], canceledUser]) {
    const { data: usage, error: usageError } = await admin.rpc("get_ai_quota_status", { p_user_id: uid })
    if (usageError || !usage?.length || usage.some((u: any) => !caps.some((c: any) => c.plan_type === u.plan && c.feature === u.feature && c.monthly_limit === u.limit))) throw new Error("Quota status and plan configuration disagree")
  }
  evidence.push({ kind: "phase1_review", evidence: { operatorAttestedPageReview: true, quotaStatusCompared: true } })
  return evidence
}

import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { getPolarCheckout, getPolarSubscription } from "@/lib/polar"
import { applyPolarSubscription } from "@/lib/billing/polar-sync"

export const dynamic = "force-dynamic"
export const maxDuration = 300

const BATCH = 200

/**
 * Nightly backstop for the webhook: re-reads every Polar-backed Genius
 * subscription from Polar and applies the same sync rules.
 *
 * Its FIRST run also repairs existing data — learners who cancelled before
 * the webhook existed, and rows whose subscription id was never saved (found
 * through their checkout). Run it with ?dryRun=1 first to see what it would
 * change without changing anything.
 *
 * Auth: Vercel Cron sends "Authorization: Bearer $CRON_SECRET" automatically.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const dryRun = new URL(req.url).searchParams.get("dryRun") === "1"
  const admin = createAdminClient()

  const { data: rows, error } = await admin
    .from("subscriptions")
    .select("user_id, plan_type, status, polar_subscription_id, polar_checkout_id")
    .eq("plan_type", "genius")
    .or("polar_subscription_id.not.is.null,polar_checkout_id.not.is.null")
    .order("updated_at", { ascending: true })
    .limit(BATCH)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const changes: any[] = []
  const counts: Record<string, number> = {}
  for (const row of rows ?? []) {
    try {
      let subId: string | null = row.polar_subscription_id
      if (!subId && row.polar_checkout_id) subId = (await getPolarCheckout(row.polar_checkout_id))?.subscription_id ?? null
      if (!subId) {
        counts.no_subscription_found = (counts.no_subscription_found ?? 0) + 1
        continue
      }
      const sub = await getPolarSubscription(subId)
      const result = await applyPolarSubscription(admin, sub, { dryRun })
      counts[result.outcome] = (counts[result.outcome] ?? 0) + 1
      if (result.before && result.after && (result.before.status !== result.after.status || result.before.plan_type !== result.after.plan_type)) {
        changes.push({ userId: result.userId, from: result.before, to: result.after })
      }
    } catch (err) {
      counts.errors = (counts.errors ?? 0) + 1
      console.error("[polar-reconcile]", row.user_id, err)
    }
  }

  return NextResponse.json({ dryRun, checked: rows?.length ?? 0, counts, changes })
}

import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { verifyPolarWebhook, PolarWebhookError } from "@/lib/billing/polar-webhook"
import { applyPolarSubscription, type PolarSubscription } from "@/lib/billing/polar-sync"
import { getPolarSubscription } from "@/lib/polar"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

/**
 * Polar → QuillGlow subscription sync.
 *
 * Before this existed nothing told QuillGlow when a learner cancelled in
 * Polar or a renewal failed, so they kept Genius indefinitely.
 *
 * Set up in Polar → Settings → Webhooks:
 *   URL     https://<your-domain>/api/webhooks/polar
 *   Format  Raw
 *   Events  all subscription.* events
 *   Secret  → env POLAR_WEBHOOK_SECRET
 *
 * Responses: 401 bad signature; 200 for anything handled, ignored or already
 * seen (so Polar doesn't retry it); 500 only when our database write failed
 * (so Polar retries).
 */
export async function POST(req: Request) {
  const raw = await req.text()

  try {
    verifyPolarWebhook(raw, req.headers, process.env.POLAR_WEBHOOK_SECRET ?? "")
  } catch (err) {
    const msg = err instanceof PolarWebhookError ? err.message : "Invalid signature"
    console.warn("[polar-webhook] rejected:", msg)
    return NextResponse.json({ error: msg }, { status: 401 })
  }

  let event: { type?: string; data?: any }
  try {
    event = JSON.parse(raw)
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const webhookId = req.headers.get("webhook-id") as string
  const type = String(event.type ?? "")
  const admin = createAdminClient()

  // Redelivery of an event we already processed → nothing to do.
  const { data: seen, error: readError } = await admin.from("polar_webhook_events").select("webhook_id").eq("webhook_id", webhookId).maybeSingle()
  if (readError) return NextResponse.json({ error: "Event log unavailable" }, { status: 503 })
  if (seen) return NextResponse.json({ ok: true, duplicate: true })

  if (!type.startsWith("subscription.") || !event.data?.id) {
    const { error } = await admin.from("polar_webhook_events").upsert({ webhook_id: webhookId, event_type: type, outcome: "ignored" }, { onConflict: "webhook_id", ignoreDuplicates: true })
    if (error) return NextResponse.json({ error: "Event log unavailable" }, { status: 503 })
    return NextResponse.json({ ok: true, ignored: type })
  }

  try {
    const snapshot = await getPolarSubscription(event.data.id)
    const result = await applyPolarSubscription(admin, snapshot as PolarSubscription, { webhookId, eventType: type })
    if (result.outcome === "unmatched") return NextResponse.json({ error: "Subscription owner not yet matched" }, { status: 503 })
    if (result.outcome === "other_product") {
      const { error } = await admin.from("polar_webhook_events").upsert({ webhook_id: webhookId, event_type: type, outcome: "other_product" }, { onConflict: "webhook_id", ignoreDuplicates: true })
      if (error) throw new Error(error.message)
    }
    return NextResponse.json({ ok: true, outcome: result.outcome })
  } catch (err) {
    console.error("[polar-webhook] sync failed:", err)
    return NextResponse.json({ error: "Sync failed" }, { status: 500 })
  }
}

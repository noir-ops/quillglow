import { NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { createPolarCheckout, createSubscriptionCheckout, getPolarSubscription } from "@/lib/polar"
import { publicPricing, readBillingRollout } from "@/lib/billing/pricing"
import { verifyProduct } from "@/lib/billing/rollout-validation"
export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const body = await request.json().catch(() => null)
  const interval = body?.interval ?? "month"
  if (!body || !["month", "year"].includes(interval) || (body.planName && body.planName !== "genius")) {
    return NextResponse.json({ error: "Choose a valid Genius billing interval" }, { status: 400 })
  }
  try {
    const { data: plan, error: planError } = await supabase.rpc("my_plan")
    if (planError || !["scholar", "genius"].includes(plan)) throw new Error("Could not check existing subscription")
    if (plan === "genius") return NextResponse.json({ error: "You already have Genius. Your existing subscription and rate are preserved." }, { status: 409 })
    const { data: local, error: localError } = await supabase.from("subscriptions").select("polar_subscription_id").eq("user_id", user.id).maybeSingle()
    if (localError) throw new Error("Could not check existing subscription")
    if (local?.polar_subscription_id) {
      const existing = await getPolarSubscription(local.polar_subscription_id)
      if (!["canceled", "incomplete_expired"].includes(existing.status)) return NextResponse.json({ error: "An existing subscription needs attention. Manage it before starting another." }, { status: 409 })
    }
    const config = await readBillingRollout(), pricing = publicPricing(config)
    if (interval === "year" && !pricing.annualAvailable) return NextResponse.json({ error: "Annual billing is not available yet" }, { status: 409 })
    const cents = interval === "year" ? pricing.annualCents : pricing.monthlyCents
    if ((pricing.live || body.expectedAmountCents !== undefined) && body.expectedAmountCents !== cents) return NextResponse.json({ error: "Pricing changed. Refresh the offer before continuing." }, { status: 409 })
    const productId = pricing.live ? (interval === "year" ? config.annual_product_id : config.monthly_product_id) : (config.legacy_product_id || process.env.POLAR_PRODUCT_ID_GENIUS)
    if (!productId) throw new Error("Polar product is not configured")
    let site = new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://www.quillglow.com")
    if (site.protocol !== "https:" && !["localhost", "127.0.0.1"].includes(site.hostname)) throw new Error("Invalid site URL")
    const successUrl = `${site.origin}/upgrade/success?checkout_id={CHECKOUT_ID}`
    if (pricing.live) await verifyProduct(productId, cents!, interval)
    const checkout = pricing.live
      ? await createSubscriptionCheckout(productId, user.id, user.email, successUrl, interval)
      : await createPolarCheckout({ product_id: productId, success_url: successUrl, customer_email: user.email, metadata: { user_id: user.id, plan_name: "genius" } })
    // Analytics must never turn a successfully-created checkout into an error/retry.
    if (pricing.phase3Enabled) {
      try { await createAdminClient().rpc("record_billing_funnel_event", { p_user: user.id, p_kind: "checkout_started", p_feature: "upgrade", p_reference: checkout.id }) } catch (err) { console.error("[billing] event unavailable", err) }
    }
    return NextResponse.json({ sessionId: checkout.id, checkoutId: checkout.id, url: checkout.url, checkoutUrl: checkout.url })
  } catch (err) {
    console.error("[billing/create-checkout]", err)
    return NextResponse.json({ error: "Could not start checkout. Please try again shortly." }, { status: 503 })
  }
}

import { NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { getPolarCheckout, getPolarSubscription } from "@/lib/polar"
import { applyPolarSubscription, getGeniusProductIds } from "@/lib/billing/polar-sync"

export async function POST(request: Request) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const body = await request.json().catch(() => null)
  const id = body?.checkoutId || body?.sessionId
  if (typeof id !== "string" || !id || id.length > 200) return NextResponse.json({ error: "Checkout ID is required" }, { status: 400 })
  try {
    const admin = createAdminClient()
    const products = await getGeniusProductIds(admin)
    if (!products.length) throw new Error("Genius product allowlist is not configured")
    const checkout = await getPolarCheckout(id)
    const owner = checkout.metadata?.user_id || checkout.external_customer_id || checkout.customer_external_id || checkout.customer?.external_id
    // A legacy local checkout ID is not ownership proof: the old verifier
    // let any learner claim it. Require the provider's identity binding.
    if (owner && owner !== user.id)
      return NextResponse.json({ error: "Checkout does not belong to this account" }, { status: 403 })
    if (checkout.status !== "succeeded" || !checkout.subscription_id)
      return NextResponse.json({ error: "Subscription payment is not complete" }, { status: 400 })
    const sub = await getPolarSubscription(checkout.subscription_id)
    if (!sub.product_id || !products.includes(sub.product_id))
      return NextResponse.json({ error: "This checkout is not a Genius subscription" }, { status: 400 })
    const subOwner = sub.metadata?.user_id || sub.customer?.external_id
    if ((!owner && !subOwner) || (subOwner && subOwner !== user.id))
      return NextResponse.json({ error: "Subscription owner mismatch" }, { status: 403 })
    const result = await applyPolarSubscription(admin, { ...sub, checkout_id: id,
      metadata: { ...sub.metadata, user_id: user.id } }, { expectedUserId: user.id })
    if (!["applied", "stale"].includes(result.outcome))
      return NextResponse.json({ error: "Subscription could not be activated", outcome: result.outcome }, { status: 409 })
    const { data: subscription, error: readError } = await supabase.from("subscriptions").select("*").eq("user_id", user.id)
    if (readError) throw new Error(readError.message)
    return NextResponse.json({ success: true, subscription })
  } catch (error) {
    console.error("[billing/verify]", error)
    return NextResponse.json({ error: "Could not verify this payment. Please retry shortly." }, { status: 503 })
  }
}

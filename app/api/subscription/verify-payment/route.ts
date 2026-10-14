import { NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase/server"
import { getPolarCheckout } from "@/lib/polar"

export async function POST(request: Request) {
  try {
    console.log("[v0] Starting Polar payment verification...")

    const polarAccessToken = process.env.POLAR_ACCESS_TOKEN
    if (!polarAccessToken) {
      console.error("[v0] POLAR_ACCESS_TOKEN is not configured")
      return NextResponse.json({ error: "Polar is not configured" }, { status: 500 })
    }

    const supabase = await createServerClient()

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      console.error("[v0] User authentication failed:", userError)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    console.log("[v0] User authenticated:", user.id)

    const { checkoutId, sessionId } = await request.json()
    const checkoutIdToUse = checkoutId || sessionId
    
    if (!checkoutIdToUse) {
      return NextResponse.json({ error: "Checkout ID is required" }, { status: 400 })
    }

    console.log("[v0] Verifying Polar checkout:", checkoutIdToUse)

    // Retrieve the checkout session from Polar
    const checkout = await getPolarCheckout(checkoutIdToUse)

    console.log("[v0] Checkout retrieved. Status:", checkout.status)

    if (checkout.status !== "succeeded") {
      console.error("[v0] Payment not completed. Status:", checkout.status)
      return NextResponse.json({ error: "Payment not completed" }, { status: 400 })
    }

    console.log("[v0] Polar subscription ID:", checkout.subscription_id)
    console.log("[v0] Polar customer ID:", checkout.customer_id)

    // Update user's subscription in database with Polar details
    const updateData = {
      plan_type: "genius",
      polar_subscription_id: checkout.subscription_id || null,
      polar_customer_id: checkout.customer_id || null,
      polar_product_id: checkout.product_id,
      polar_checkout_id: checkoutIdToUse,
      status: "active",
      current_period_start: new Date().toISOString(),
      current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days from now
      updated_at: new Date().toISOString(),
    }

    console.log("[v0] Updating subscription with data:", updateData)

    // Check if subscription record exists
    const { data: existingSub } = await supabase
      .from("subscriptions")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle()

    let result
    if (existingSub) {
      // Update existing record
      result = await supabase
        .from("subscriptions")
        .update(updateData)
        .eq("user_id", user.id)
        .select()
    } else {
      // Insert new record
      result = await supabase
        .from("subscriptions")
        .insert({
          user_id: user.id,
          ...updateData,
        })
        .select()
    }

    if (result.error) {
      console.error("[v0] Error updating subscription:", result.error)
      return NextResponse.json({ error: "Failed to update subscription", details: result.error }, { status: 500 })
    }

    console.log("[v0] Subscription updated successfully:", result.data)

    return NextResponse.json({ success: true, subscription: result.data })
  } catch (error: any) {
    console.error("[v0] Error verifying Polar payment:", error)
    return NextResponse.json({ error: "Failed to verify payment", details: error?.message }, { status: 500 })
  }
}

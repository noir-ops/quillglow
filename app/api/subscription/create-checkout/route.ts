import { NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase/server"
import { createPolarCheckout } from "@/lib/polar"

export async function POST(request: Request) {
  try {
    const polarAccessToken = process.env.POLAR_ACCESS_TOKEN
    if (!polarAccessToken) {
      console.error("[v0] POLAR_ACCESS_TOKEN is not configured in environment variables")
      return NextResponse.json(
        { error: "Polar is not configured. Please add POLAR_ACCESS_TOKEN to your environment variables." },
        { status: 500 }
      )
    }

    const supabase = await createServerClient()

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { priceId, planName } = await request.json()

    // Use the Polar product ID for Genius plan
    const productId = process.env.POLAR_PRODUCT_ID_GENIUS

    if (!productId) {
      console.error("[v0] POLAR_PRODUCT_ID_GENIUS is not configured")
      return NextResponse.json(
        { error: "Polar product is not configured. Please add POLAR_PRODUCT_ID_GENIUS to your environment variables." },
        { status: 500 }
      )
    }

    console.log("[v0] Creating Polar checkout session for user:", user.id)

    // Build success URL with checkout_id placeholder
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || request.headers.get("origin") || "http://localhost:3000"
    const successUrl = `${siteUrl}/upgrade/success?checkout_id={CHECKOUT_ID}`

    // Create Polar checkout session
    const checkout = await createPolarCheckout({
      product_id: productId,
      success_url: successUrl,
      customer_email: user.email,
      metadata: {
        user_id: user.id,
        plan_name: planName || "genius",
      },
    })

    console.log("[v0] Polar checkout session created:", checkout.id)

    return NextResponse.json({ 
      sessionId: checkout.id, 
      url: checkout.url,
      checkoutId: checkout.id,
      checkoutUrl: checkout.url,
    })
  } catch (error: any) {
    console.error("[v0] Error creating Polar checkout session:", error)
    return NextResponse.json(
      { error: error?.message || "Failed to create checkout session" },
      { status: 500 }
    )
  }
}

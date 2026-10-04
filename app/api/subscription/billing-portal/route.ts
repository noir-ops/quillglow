import { NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase/server"
import { polarFetch } from "@/lib/polar"

export async function POST() {
  try {
    const polarToken = process.env.POLAR_ACCESS_TOKEN
    if (!polarToken) {
      console.error("[v0] POLAR_ACCESS_TOKEN is not configured")
      return NextResponse.json({ error: "Polar is not configured" }, { status: 500 })
    }

    const supabase = await createServerClient()

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Get Polar customer ID from subscription
    const { data: subscription, error: subError } = await supabase
      .from("subscriptions")
      .select("polar_customer_id, polar_subscription_id")
      .eq("user_id", user.id)
      .single()

    if (subError || !subscription?.polar_customer_id) {
      console.error("[v0] No Polar customer found for user:", user.id)
      return NextResponse.json({ error: "No subscription found" }, { status: 404 })
    }

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://quillglow.vercel.app"

    // Create Polar customer portal session
    // Polar uses a customer session token approach
    const response = await polarFetch("/customer-sessions", {
      method: "POST",
      body: JSON.stringify({
        customer_id: subscription.polar_customer_id,
      }),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      console.error("[v0] Polar customer session error:", errorData)
      
      // Fallback: redirect to Polar's customer portal with email
      // Polar allows customers to access their portal via email link
      const portalUrl = `https://polar.sh/purchases`
      return NextResponse.json({ url: portalUrl })
    }

    const sessionData = await response.json()
    
    // If Polar returns a portal URL, use it
    if (sessionData.customer_portal_url) {
      return NextResponse.json({ url: sessionData.customer_portal_url })
    }

    // Otherwise construct the portal URL with the session token
    const baseUrl = process.env.POLAR_BASE_URL?.includes("sandbox") 
      ? "https://sandbox.polar.sh" 
      : "https://polar.sh"
    
    const portalUrl = sessionData.token 
      ? `${baseUrl}/purchases?token=${sessionData.token}`
      : `${baseUrl}/purchases`

    return NextResponse.json({ url: portalUrl })
  } catch (error: any) {
    console.error("[v0] Error creating billing portal session:", error)
    // Fallback to general purchases page
    const baseUrl = process.env.POLAR_BASE_URL?.includes("sandbox") 
      ? "https://sandbox.polar.sh" 
      : "https://polar.sh"
    return NextResponse.json({ url: `${baseUrl}/purchases` })
  }
}

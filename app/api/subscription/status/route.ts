import { createServerClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function GET() {
  try {
    const supabase = await createServerClient()

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data: subscription, error: subError } = await supabase
      .from("subscriptions")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle()

    if (subError) {
      console.error("[v0] Error fetching subscription:", subError)
      return NextResponse.json({ error: "Failed to fetch subscription" }, { status: 500 })
    }

    const defaultSubscription = {
      user_id: user.id,
      plan_type: "scholar",
      status: "active",
      polar_customer_id: null,
      polar_subscription_id: null,
      polar_product_id: null,
      current_period_start: new Date().toISOString(),
      current_period_end: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    // Get current month usage
    const currentMonth = new Date().toISOString().slice(0, 7) // YYYY-MM
    const { data: usage, error: usageError } = await supabase
      .from("usage_tracking")
      .select("*")
      .eq("user_id", user.id)
      .eq("month_year", currentMonth)
      .maybeSingle()

    if (usageError && usageError.code !== "PGRST116") {
      // PGRST116 = no rows
      console.error("[v0] Error fetching usage:", usageError)
    }

    const { count: flashcardsCount } = await supabase
      .from("flashcards")
      .select("*, flashcard_decks!inner(user_id)", { count: "exact", head: true })
      .eq("flashcard_decks.user_id", user.id)

    const { count: notesCount } = await supabase
      .from("notes")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)

    console.log("[v0] Usage data:", {
      flashcardsCount,
      notesCount,
      usage: usage || { tasks_created: 0, ai_generations_used: 0 },
    })

    return NextResponse.json({
      subscription: subscription || defaultSubscription,
      usage: usage || { tasks_created: 0, ai_generations_used: 0 },
      counts: {
        flashcards: flashcardsCount || 0,
        notes: notesCount || 0,
      },
    })
  } catch (error) {
    console.error("[v0] Error in subscription status:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

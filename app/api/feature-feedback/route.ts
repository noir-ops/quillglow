import { createServerClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function POST(request: Request) {
  try {
    const supabase = await createServerClient()

    // Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { feature_name, selected_option } = await request.json()

    // Validate input
    if (!feature_name || !selected_option) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    // Check if user already submitted feedback for this feature
    const { data: existing } = await supabase
      .from("feature_feedback")
      .select("id")
      .eq("user_id", user.id)
      .eq("feature_name", feature_name)
      .maybeSingle()

    if (existing) {
      return NextResponse.json({ error: "Feedback already submitted" }, { status: 400 })
    }

    // Insert feedback
    const { error: insertError } = await supabase.from("feature_feedback").insert({
      user_id: user.id,
      feature_name,
      selected_option,
    })

    if (insertError) {
      console.error("[v0] Feature feedback insert error:", insertError)
      return NextResponse.json({ error: "Failed to save feedback" }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[v0] Feature feedback error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function GET(request: Request) {
  try {
    const supabase = await createServerClient()

    // Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const feature_name = searchParams.get("feature_name")

    if (!feature_name) {
      return NextResponse.json({ error: "Missing feature_name" }, { status: 400 })
    }

    // Check if user already submitted feedback
    const { data } = await supabase
      .from("feature_feedback")
      .select("selected_option")
      .eq("user_id", user.id)
      .eq("feature_name", feature_name)
      .maybeSingle()

    return NextResponse.json({ hasSubmitted: !!data, selectedOption: data?.selected_option })
  } catch (error) {
    console.error("[v0] Feature feedback check error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

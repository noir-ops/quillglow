import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const email = searchParams.get("email")

    if (!email) {
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    const { data: orders, error } = await supabase
      .from("study_tracker_orders")
      .select("id, product_name, amount, currency, email, name, status, tracker_file_url, created_at")
      .eq("email", email)
      .eq("status", "completed")
      .order("created_at", { ascending: false })

    if (error) {
      return NextResponse.json(
        { error: "Failed to fetch orders" },
        { status: 500 }
      )
    }

    return NextResponse.json({ orders })
  } catch (error) {
    console.error("[v0] Orders search error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

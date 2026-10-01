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

    const { data: channels, error } = await supabase.from("community_channels").select("*").order("slug")

    if (error) {
      console.error("[v0] Error fetching channels:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ channels })
  } catch (error: any) {
    console.error("[v0] Error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

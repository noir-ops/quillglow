import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function GET() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ theme: null })
    }

    const { data, error } = await supabase.from("user_themes").select("theme").eq("user_id", user.id).maybeSingle()

    if (error) {
      console.error("[v0] Error fetching user theme:", error)
      return NextResponse.json({ theme: null })
    }

    return NextResponse.json({ theme: data?.theme || null })
  } catch (error) {
    console.error("[v0] Error in GET /api/user-theme:", error)
    return NextResponse.json({ theme: null })
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { theme } = await request.json()

    const { error } = await supabase.from("user_themes").upsert(
      {
        user_id: user.id,
        theme,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    )

    if (error) {
      console.error("[v0] Error saving user theme:", error)
      return NextResponse.json({ error: "Failed to save theme" }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[v0] Error in POST /api/user-theme:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function DELETE() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { error } = await supabase.from("user_themes").delete().eq("user_id", user.id)

    if (error) {
      console.error("[v0] Error deleting user theme:", error)
      return NextResponse.json({ error: "Failed to reset theme" }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[v0] Error in DELETE /api/user-theme:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

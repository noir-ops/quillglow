import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data, error } = await supabase.from("profiles").select("study_together_enabled").eq("id", user.id).single()

    if (error) throw error

    return NextResponse.json({ enabled: data?.study_together_enabled ?? true })
  } catch (error) {
    console.error("[v0] Error fetching study-together preference:", error)
    return NextResponse.json({ error: "Failed to fetch preference" }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { enabled } = await req.json()

    if (typeof enabled !== "boolean") return NextResponse.json({ error: "enabled must be boolean" }, { status: 400 })
    const { data, error } = await supabase.from("profiles").update({ study_together_enabled: enabled }).eq("id", user.id).select("id").single()

    if (error) throw error

    return NextResponse.json({ success: true, enabled })
  } catch (error) {
    console.error("[v0] Error updating study-together preference:", error)
    return NextResponse.json({ error: "Failed to update preference" }, { status: 500 })
  }
}

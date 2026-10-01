import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { NextResponse } from "next/server"

export async function GET() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data: history, error } = await supabase
      .from("search_history")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50)

    if (error) throw error

    return NextResponse.json({ history })
  } catch (error) {
    console.error("[v0] Fetch history error:", error)
    return NextResponse.json({ error: "Failed to fetch history" }, { status: 500 })
  }
}

/**
 * Records a question asked in Study AI so it shows up under "Recent searches".
 *
 * Browse used to write these rows itself (inside /api/search/web). Browse was
 * merged into Study AI and questions no longer go through that route, so
 * without this the Recent searches list would never get a new entry.
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const body = await request.json().catch(() => null)
    const query = typeof body?.query === "string" ? body.query.trim().slice(0, 200) : ""
    if (!query) return NextResponse.json({ error: "query is required" }, { status: 400 })

    // "all" is the value Browse always wrote — kept so nothing that reads or
    // constrains this column sees a value it hasn't seen before.
    const { error } = await supabase.from("search_history").insert({ user_id: user.id, query, search_type: "all" })
    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[search/history] record failed:", error)
    return NextResponse.json({ error: "Failed to record search" }, { status: 500 })
  }
}

/**
 * DELETE /api/search/history            → clears the learner's whole history (unchanged)
 * DELETE /api/search/history?query=...  → removes every entry with that exact query
 * DELETE /api/search/history?id=...     → removes one entry
 *
 * The single-entry forms use the service-role client with an explicit user_id
 * filter. search_history was created outside this repo's migrations, so its
 * row-level-security delete rules can't be verified here; under RLS a blocked
 * delete removes zero rows and still looks like success, which would leave
 * the "deleted" search sitting in the list.
 */
export async function DELETE(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const params = new URL(request.url).searchParams
    const id = params.get("id")
    const query = params.get("query")

    if (id || query) {
      const admin = createAdminClient()
      let q = admin.from("search_history").delete().eq("user_id", user.id)
      q = id ? q.eq("id", id) : q.eq("query", query as string)
      const { error } = await q
      if (error) throw error
      return NextResponse.json({ success: true })
    }

    const { error } = await supabase.from("search_history").delete().eq("user_id", user.id)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[v0] Clear history error:", error)
    return NextResponse.json({ error: "Failed to clear history" }, { status: 500 })
  }
}

import { createServerClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { NextResponse } from "next/server"

export async function GET() {
  try {
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { data, error } = await supabase
      .from("echomind_logs")
      .select("id, query, mode, response, context_summary, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(200)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ logs: data ?? [] })
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/**
 * Delete EchoMind history entries — one whole session at a time (the client
 * sends every message id in the session it's deleting).
 *
 * Uses the service-role client with an explicit user_id filter rather than
 * the signed-in client: echomind_logs was created outside the migrations in
 * this repo, so its row-level-security delete rules can't be verified here.
 * Under RLS a blocked delete doesn't error — it quietly removes zero rows and
 * looks like success. The user_id filter keeps this strictly to the caller's
 * own rows, and the returned row count means a delete that removed nothing is
 * reported as a failure instead of a silent success.
 */
export async function DELETE(req: Request) {
  try {
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const body = await req.json().catch(() => null)
    const ids: unknown = body?.ids
    if (
      !Array.isArray(ids) ||
      ids.length === 0 ||
      ids.length > 500 ||
      !ids.every((id) => typeof id === "string" && id.length > 0)
    ) {
      return NextResponse.json({ error: "ids must be a non-empty array of strings" }, { status: 400 })
    }

    const admin = createAdminClient()
    const { data, error } = await admin
      .from("echomind_logs")
      .delete()
      .eq("user_id", user.id)
      .in("id", ids as string[])
      .select("id")

    if (error) {
      console.error("[echomind/history] delete failed:", error.message)
      return NextResponse.json({ error: "Could not delete" }, { status: 500 })
    }
    if (!data || data.length === 0) {
      return NextResponse.json({ error: "Nothing was deleted" }, { status: 404 })
    }

    return NextResponse.json({ deleted: data.length })
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

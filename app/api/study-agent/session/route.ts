import { createServerClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get("id")
    if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 })

    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { data, error } = await supabase
      .from("study_agent_sessions")
      .select("*")
      .eq("id", id)
      .eq("user_id", user.id)
      .single()

    if (error || !data) return NextResponse.json({ error: "Session not found" }, { status: 404 })
    return NextResponse.json({ session: data })
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/**
 * Delete a generated study system.
 *
 * Scoped to the signed-in user via the user_id filter, so a session id from
 * another account can't be deleted even if guessed. Flashcard decks already
 * exported from a session are deliberately left alone — once saved they're
 * the learner's own material, not part of the session.
 */
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get("id")
    if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 })

    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { error } = await supabase
      .from("study_agent_sessions")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id)

    if (error) {
      console.error("[study-agent/session] delete failed:", error.message)
      return NextResponse.json({ error: "Could not delete", detail: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

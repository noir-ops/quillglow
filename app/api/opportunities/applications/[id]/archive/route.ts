import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

/**
 * Move an application between the dashboard's Active and Archived tabs.
 * Purely the learner's own view preference — it doesn't change the
 * application's status or hide it from reviewers, so it's allowed at any
 * stage (unlike editing, which is draft-only).
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const archived = body?.archived !== false

  const { error } = await supabase
    .from("opportunity_applications")
    .update({ archived_at: archived ? new Date().toISOString() : null })
    .eq("id", id)
    .eq("user_id", user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true, archived })
}

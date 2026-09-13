import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { deleteSession, getSession } from "@/lib/services/sprout-sessions"

export const dynamic = "force-dynamic"

/**
 * Full session with message history.
 *
 * params is a Promise in Next 16 and must be awaited — this route was
 * destructuring it synchronously, so params.id was undefined and every
 * session lookup silently returned "Not found". That's why Sprout
 * conversations appeared unsaved: they WERE being written to
 * sprout_chat_sessions, but could never be read back.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const session = await getSession(user.id, id)
  if (!session) return NextResponse.json({ error: "Not found" }, { status: 404 })

  return NextResponse.json({ session })
}

/** Same awaited-params fix as GET above — deletes were failing for the identical reason. */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const ok = await deleteSession(user.id, id)
  return ok ? NextResponse.json({ success: true }) : NextResponse.json({ error: "Failed to delete" }, { status: 500 })
}

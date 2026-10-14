import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createSession, listSessions } from "@/lib/services/sprout-sessions"

export const dynamic = "force-dynamic"

/** Chat history list, for the sidebar. */
export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  return NextResponse.json({ sessions: await listSessions(user.id) })
}

/** Start a new conversation. */
export async function POST(req: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const session = await createSession(user.id, { subject: body.subject, syllabus: body.syllabus })
  return NextResponse.json({ session })
}

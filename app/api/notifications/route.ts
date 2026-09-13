import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { listNotifications, markRead, unreadCount } from "@/lib/services/notifications"

export const dynamic = "force-dynamic"

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const [notifications, unread] = await Promise.all([
    listNotifications(user.id),
    unreadCount(user.id),
  ])
  return NextResponse.json({ notifications, unread })
}

/** Mark notifications read. */
export async function POST(req: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { ids } = await req.json()
  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: "ids array is required" }, { status: 400 })
  }

  await markRead(user.id, ids.map(Number).filter(Number.isFinite))
  return NextResponse.json({ success: true })
}

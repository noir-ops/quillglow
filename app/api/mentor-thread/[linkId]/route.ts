import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

/**
 * Student side of the message thread — mirrors quillglow_guardian-main's
 * /api/messages/[linkId] exactly. Same table (guardian_messages, 045),
 * same RLS ("link participants read/send messages" already covers
 * whichever side of the link auth.uid() is on), so a message sent from
 * either app appears in both.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ linkId: string }> }) {
  const { linkId } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data, error } = await supabase
    .from("guardian_messages")
    .select("*")
    .eq("guardian_link_id", linkId)
    .order("created_at", { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ messages: data ?? [] })
}

export async function POST(req: Request, { params }: { params: Promise<{ linkId: string }> }) {
  const { linkId } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json().catch(() => null)
  const messageBody = (body?.body as string | undefined)?.trim()
  if (!messageBody) return NextResponse.json({ error: "body is required" }, { status: 400 })

  const { data, error } = await supabase
    .from("guardian_messages")
    .insert({ guardian_link_id: linkId, sender_user_id: user.id, body: messageBody })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ message: data })
}

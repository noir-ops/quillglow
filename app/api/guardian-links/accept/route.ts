import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

/**
 * Student redeems a code a guardian or mentor generated on their portal.
 * Same RPC as the guardian side (accept_guardian_link_invite, 044) —
 * it resolves which party is the adult and which is the student from the
 * invite row itself, so this route doesn't need to know or care which
 * direction the invite came from.
 */
export async function POST(req: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json().catch(() => null)
  const inviteCode = (body?.inviteCode as string | undefined)?.trim()
  if (!inviteCode) return NextResponse.json({ error: "inviteCode is required" }, { status: 400 })

  const { data, error } = await supabase.rpc("accept_guardian_link_invite", { p_invite_code: inviteCode })
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  const row = Array.isArray(data) ? data[0] : data
  return NextResponse.json({ linkId: row?.out_link_id, linkType: row?.out_link_type })
}

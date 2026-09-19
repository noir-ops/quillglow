import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

/**
 * The student side of the family/mentor linking flow — mirrors
 * quillglow_guardian-main's /api/relationships/invite exactly, just with
 * created_by_role='student' instead of 'adult'. Same RPC
 * (create_guardian_link_invite, 044), same invite-code mechanism, so a
 * code generated here and one generated on the guardian portal are
 * interchangeable — either side can start the link.
 */
export async function POST(req: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json().catch(() => null)
  const linkType = body?.linkType as string

  if (!["family", "mentor"].includes(linkType)) {
    return NextResponse.json({ error: "linkType must be 'family' or 'mentor'" }, { status: 400 })
  }

  const { data, error } = await supabase.rpc("create_guardian_link_invite", {
    p_created_by_role: "student",
    p_link_type: linkType,
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  const row = Array.isArray(data) ? data[0] : data
  return NextResponse.json({ inviteCode: row?.out_invite_code })
}

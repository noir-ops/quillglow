import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getQuotaStatus } from "@/lib/services/quota"

export const dynamic = "force-dynamic"

/** Current month's AI usage for the signed-in user. */
export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const status = await getQuotaStatus(user.id)
  return NextResponse.json({ usage: status })
}

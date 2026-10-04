import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getUserAccess } from "@/lib/services/access"

export const dynamic = "force-dynamic"

/**
 * The signed-in user's roles, permissions, plan and entitlements.
 * The UI may use this to hide features, but every protected route re-checks
 * server-side — hiding a button is not authorization (§21).
 */
export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  return NextResponse.json({ access: await getUserAccess(user.id) })
}

import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

/**
 * Submit a saved/in-progress application for review. Validation (essay length
 * if required, documents attached if required) happens in submit_application()
 * itself — the single source of truth, so a future second write path can't
 * bypass it.
 */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data, error } = await supabase.rpc("submit_application", {
    p_user_id: user.id,
    p_application_id: id,
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  const row = Array.isArray(data) ? data[0] : data
  return NextResponse.json({ status: row?.status, submittedAt: row?.submitted_at })
}

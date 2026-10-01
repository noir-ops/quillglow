import { createServerClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { getEchoMindAllowance } from "@/lib/services/echomind-usage"

/**
 * Free-plan usage for the EchoMind header. Counts session starts (see
 * lib/services/echomind-usage) — the same rule the chat and weekly review
 * routes enforce, so the number shown always matches what's allowed.
 */
export async function GET() {
  try {
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { allowed: _allowed, ...usage } = await getEchoMindAllowance(supabase, user.id)
    return NextResponse.json(usage)
  } catch (error) {
    console.error("[echomind/usage]", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

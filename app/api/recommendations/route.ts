import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { dismissRecommendation, listRecommendations } from "@/lib/services/recommendation"

export const dynamic = "force-dynamic"

/** Active recommendations for the signed-in student. */
export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  return NextResponse.json({ recommendations: await listRecommendations(user.id) })
}

/** Dismiss a recommendation. */
export async function POST(req: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await req.json()
  if (!Number.isFinite(Number(id))) {
    return NextResponse.json({ error: "id is required" }, { status: 400 })
  }

  const ok = await dismissRecommendation(user.id, Number(id))
  return ok ? NextResponse.json({ success: true }) : NextResponse.json({ error: "Failed" }, { status: 500 })
}

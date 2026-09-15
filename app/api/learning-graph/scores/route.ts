import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getIntelligenceScores } from "@/lib/services/learning-graph"

export const dynamic = "force-dynamic"

/** Intelligence Scores for the signed-in student. */
export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  return NextResponse.json({ scores: await getIntelligenceScores(user.id) })
}

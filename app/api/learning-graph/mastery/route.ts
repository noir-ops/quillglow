import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getDueForReview, getMastery, getWeakestConcepts } from "@/lib/services/learning-graph"

export const dynamic = "force-dynamic"

/**
 * Mastery view for the signed-in student.
 *   ?view=all      full mastery map (default)
 *   ?view=weak     weakest concepts — what to study next
 *   ?view=due      concepts due for spaced review
 */
export async function GET(req: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const view = new URL(req.url).searchParams.get("view") ?? "all"

  if (view === "weak") return NextResponse.json({ concepts: await getWeakestConcepts(user.id) })
  if (view === "due") return NextResponse.json({ concepts: await getDueForReview(user.id) })
  return NextResponse.json({ mastery: await getMastery(user.id) })
}

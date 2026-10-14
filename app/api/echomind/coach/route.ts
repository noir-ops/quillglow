import { NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase/server"
import { getStudyCoachSnapshot } from "@/lib/services/study-coach"

export const dynamic = "force-dynamic"

/** The learner's Study Planner + syllabus coverage snapshot, for the coach UI. */
export async function GET() {
  try {
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    return NextResponse.json({ snapshot: await getStudyCoachSnapshot(supabase, user.id) })
  } catch (error) {
    console.error("[echomind/coach]", error)
    return NextResponse.json({ error: "Could not load your study progress" }, { status: 500 })
  }
}

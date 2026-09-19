import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getLearnerSyllabus, listAvailableSyllabi, setLearnerSyllabus } from "@/lib/services/syllabus"

export const dynamic = "force-dynamic"

/** Available syllabi + the learner's current selection. */
export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const [available, selection] = await Promise.all([listAvailableSyllabi(), getLearnerSyllabus(user.id)])

  return NextResponse.json({ available, selection })
}

export async function PUT(req: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  let body: { primary?: string | null; secondary?: string | null }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const result = await setLearnerSyllabus(body.primary ?? null, body.secondary ?? null)
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 })
  }

  return NextResponse.json({ ok: true, selection: await getLearnerSyllabus(user.id) })
}

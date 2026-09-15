import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { listSubjectsForLearner, setSelectedSubjects, type SelectedSubject } from "@/lib/services/syllabus"

export const dynamic = "force-dynamic"

/**
 * Subjects offered by the learner's chosen syllabi, each flagged with whether
 * they've selected it. Empty when no syllabus is chosen yet.
 */
export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  return NextResponse.json({ subjects: await listSubjectsForLearner(user.id) })
}

export async function PUT(req: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  let body: { subjects?: SelectedSubject[] }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const subjects = Array.isArray(body.subjects) ? body.subjects : []
  if (subjects.some((s) => !s || typeof s.syllabus !== "string" || typeof s.subject !== "string")) {
    return NextResponse.json({ error: "Each subject needs a syllabus and subject" }, { status: 400 })
  }

  const result = await setSelectedSubjects(subjects)
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 })

  return NextResponse.json({ ok: true, subjects: await listSubjectsForLearner(user.id) })
}

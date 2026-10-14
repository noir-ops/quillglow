import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { computeExamReadiness, getIntelligenceScores } from "@/lib/services/learning-graph"
import { getLearnerSyllabus } from "@/lib/services/syllabus"

export const dynamic = "force-dynamic"

/**
 * Intelligence Scores for the signed-in student.
 *
 * Exam Readiness is shown as exactly two cards: one for the learner's
 * PRIMARY syllabus and one for their SECONDARY. No "overall" card.
 *
 * Why it's computed here, on every load: nothing else ever computed a
 * syllabus-scoped score. Every caller of refreshScores() (essay, mock exam,
 * quests) passes no syllabus, so the scoring RPC ran unscoped and only ever
 * wrote the 'global' row. A newly selected syllabus (e.g. SAT) therefore
 * never got a row at all, and whatever card showed was a stale leftover
 * from a past selection. compute_exam_readiness is a cheap SQL aggregate
 * that upserts its row, so recomputing both on load guarantees the cards
 * always match the CURRENT selection — change the syllabus in settings and
 * the next visit shows the new one.
 */
export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { primary, secondary } = await getLearnerSyllabus(user.id).catch(() => ({
    primary: null as string | null,
    secondary: null as string | null,
  }))

  // Fresh, scoped computation for exactly the current selection.
  await Promise.all([
    primary ? computeExamReadiness(user.id, primary) : null,
    secondary ? computeExamReadiness(user.id, secondary) : null,
  ])

  const all = await getIntelligenceScores(user.id)

  const readinessFor = (scope: string | null, role: "primary" | "secondary") => {
    if (!scope) return null
    const row = all.find((s) => s.score_type === "exam_readiness" && s.scope === scope)
    return row ? { ...row, role } : null
  }

  const mockExam = await computeMockExamScore(supabase, user.id)
  const learningRisk = all.find((s) => s.score_type === "learning_risk") ?? null

  // Display order: Primary readiness, Secondary readiness, Learning Risk,
  // Mock Exam Score — then any remaining account-wide scores (consistency,
  // growth, etc., shown on Grow). The 'global' Exam Readiness row is dropped.
  const scores = [
    readinessFor(primary, "primary"),
    readinessFor(secondary, "secondary"),
    learningRisk,
    mockExam,
    ...all.filter((s) => s.score_type !== "exam_readiness" && s.score_type !== "learning_risk"),
  ].filter(Boolean)

  return NextResponse.json({ scores, primary, secondary })
}

/**
 * Mock Exam Score — the average of every scored exam taken on the account:
 *  - mock exams, including saved Practice/StudyPilot exams sat via "Take
 *    Exam" (those save to mock_exam_attempts too)
 *  - practice exam MCQ sets, once every question is answered
 *  - essays, graded 0-100 by AI
 * Each exam counts equally, regardless of type or length.
 *
 * Computed live rather than cached in intelligence_scores: it's three small
 * reads, and live means a just-finished exam shows up immediately.
 */
async function computeMockExamScore(supabase: any, userId: string) {
  const [mock, practice, essays] = await Promise.all([
    supabase
      .from("mock_exam_attempts")
      .select("score_percentage, completed_at")
      .eq("user_id", userId)
      .eq("status", "completed")
      .not("score_percentage", "is", null),
    supabase
      .from("practice_exam_scores")
      .select("score_percentage, created_at")
      .eq("user_id", userId),
    supabase
      .from("essay_attempts")
      .select("ai_score, updated_at")
      .eq("user_id", userId)
      .not("ai_score", "is", null),
  ])

  // practice_exam_scores won't exist until migration 063 runs — its error is
  // simply treated as "no practice scores yet" rather than breaking the page.
  const entries: { score: number; at: string }[] = [
    ...(mock.data ?? []).map((r: any) => ({ score: Number(r.score_percentage), at: r.completed_at })),
    ...(practice.error ? [] : practice.data ?? []).map((r: any) => ({ score: Number(r.score_percentage), at: r.created_at })),
    ...(essays.data ?? []).map((r: any) => ({ score: Number(r.ai_score), at: r.updated_at })),
  ].filter((e) => Number.isFinite(e.score))

  const count = entries.length
  const average = count ? entries.reduce((sum, e) => sum + e.score, 0) / count : 0
  const latest = [...entries].sort((a, b) => String(b.at).localeCompare(String(a.at)))[0]
  const best = count ? Math.max(...entries.map((e) => e.score)) : 0

  return {
    score_type: "mock_exam",
    scope: "global",
    value: Math.round(average * 100) / 100,
    breakdown: {
      exams_taken: count,
      latest_score: latest ? `${Math.round(latest.score)}%` : "—",
      best_score: count ? `${Math.round(best)}%` : "—",
    },
    computed_at: new Date().toISOString(),
  }
}

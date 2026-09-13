import "server-only"
import { createClient } from "@/lib/supabase/server"

/**
 * Learner syllabus selection.
 *
 * Single source of truth for "what curriculum is this learner working to".
 * Every AI surface (Sprout, Study Agent, EchoMind, planner, readiness) reads
 * from here instead of taking a syllabus argument that nobody supplied.
 *
 * Primary vs secondary:
 *   - `primary` scopes Exam Readiness, the study planner, and the default
 *     concept graph. Scoring against two syllabi at once produces a number
 *     that means nothing, so exactly one drives it.
 *   - `secondary` is additive for RETRIEVAL only — its RAG namespace is
 *     searched too, so a learner sitting both WAEC and JAMB gets grounded
 *     answers from both, without muddying their readiness score.
 */

export interface SyllabusOption {
  syllabus: string
  conceptCount: number
  subjectCount: number
  subjects: string[]
}

export interface LearnerSyllabus {
  primary: string | null
  secondary: string | null
}

/**
 * Syllabi that actually have seeded concepts. Derived from the curriculum
 * that's been indexed, so newly-uploaded curriculum JSON shows up in the
 * picker with no code change — currently 2 options, and it grows on its own.
 */
export async function listAvailableSyllabi(): Promise<SyllabusOption[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("available_syllabi")
    .select("syllabus, concept_count, subject_count, subjects")

  if (error || !data) return []

  return data.map((row: any) => ({
    syllabus: row.syllabus,
    conceptCount: Number(row.concept_count ?? 0),
    subjectCount: Number(row.subject_count ?? 0),
    subjects: row.subjects ?? [],
  }))
}

/** The signed-in learner's saved selection. Both null until they choose. */
export async function getLearnerSyllabus(userId?: string): Promise<LearnerSyllabus> {
  const supabase = await createClient()

  let id = userId
  if (!id) {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return { primary: null, secondary: null }
    id = user.id
  }

  const { data } = await supabase
    .from("profiles")
    .select("primary_syllabus, secondary_syllabus")
    .eq("id", id)
    .maybeSingle()

  return {
    primary: data?.primary_syllabus ?? null,
    secondary: data?.secondary_syllabus ?? null,
  }
}

/**
 * Both syllabi as a list, primary first, nulls dropped — the shape most
 * callers want for retrieval scoping.
 */
export async function getLearnerSyllabusList(userId?: string): Promise<string[]> {
  const { primary, secondary } = await getLearnerSyllabus(userId)
  return [primary, secondary].filter((s): s is string => !!s)
}

export interface SaveResult {
  ok: boolean
  error?: string
}

/**
 * Saves the learner's selection. Validates against seeded curriculum rather
 * than a hardcoded list, so this stays correct as new syllabi are indexed.
 */
export async function setLearnerSyllabus(primary: string | null, secondary: string | null): Promise<SaveResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: "Not signed in" }

  if (secondary && !primary) {
    return { ok: false, error: "Choose a primary syllabus before adding a secondary one" }
  }
  if (primary && secondary && primary === secondary) {
    return { ok: false, error: "Primary and secondary syllabus must be different" }
  }

  if (primary || secondary) {
    const available = await listAvailableSyllabi()
    const valid = new Set(available.map((s) => s.syllabus))
    for (const choice of [primary, secondary]) {
      if (choice && !valid.has(choice)) {
        return { ok: false, error: `"${choice}" isn't an available syllabus` }
      }
    }
  }

  const { error } = await supabase
    .from("profiles")
    .update({ primary_syllabus: primary, secondary_syllabus: secondary })
    .eq("id", user.id)

  if (error) {
    console.error("[syllabus] save failed:", error.message)
    return { ok: false, error: "Could not save your selection" }
  }

  return { ok: true }
}

/**
 * A short line describing the learner's curriculum, for injecting into AI
 * system prompts. Returns null when nothing is selected so callers can omit
 * the section entirely rather than saying "no syllabus selected".
 */
export function describeSyllabusForPrompt(sel: LearnerSyllabus): string | null {
  if (!sel.primary && !sel.secondary) return null
  if (sel.primary && sel.secondary) {
    return `This learner is studying for ${sel.primary} (primary) and ${sel.secondary} (secondary). Align explanations, terminology, notation and exam technique with ${sel.primary} first; mention ${sel.secondary} where the two differ in a way that matters. Do not teach topics outside these syllabi unless the learner explicitly asks.`
  }
  const only = sel.primary ?? sel.secondary
  return `This learner is studying for ${only}. Align explanations, terminology, notation and exam technique with the ${only} syllabus, and don't drift into topics outside it unless the learner explicitly asks.`
}

// ── Subjects ────────────────────────────────────────────────────────────────
//
// A syllabus can carry many subjects and a learner rarely sits all of them.
// These narrow the learner's world to the subjects they actually study, so
// the Study Agent, planner and readiness don't offer or score irrelevant ones.

export interface SubjectOption {
  syllabus: string
  subject: string
  conceptCount: number
  topicCount: number
  /** True when the learner has this subject selected. */
  selected: boolean
}

/**
 * Every subject offered by the learner's chosen syllabi, flagged with whether
 * they've selected it. Returns [] when no syllabus is chosen — there's nothing
 * meaningful to offer until then.
 */
export async function listSubjectsForLearner(userId?: string): Promise<SubjectOption[]> {
  const supabase = await createClient()

  let id = userId
  if (!id) {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return []
    id = user.id
  }

  const syllabi = await getLearnerSyllabusList(id)
  if (syllabi.length === 0) return []

  const [{ data: offered }, { data: chosen }] = await Promise.all([
    supabase.from("available_subjects").select("syllabus, subject, concept_count, topic_count").in("syllabus", syllabi),
    supabase.from("learner_subjects").select("syllabus, subject").eq("user_id", id),
  ])

  const selectedKeys = new Set((chosen ?? []).map((r: any) => `${r.syllabus}::${r.subject}`))

  return (offered ?? []).map((row: any) => ({
    syllabus: row.syllabus,
    subject: row.subject,
    conceptCount: Number(row.concept_count ?? 0),
    topicCount: Number(row.topic_count ?? 0),
    selected: selectedKeys.has(`${row.syllabus}::${row.subject}`),
  }))
}

export interface SelectedSubject {
  syllabus: string
  subject: string
}

/** Just the learner's chosen subjects. */
export async function getSelectedSubjects(userId?: string): Promise<SelectedSubject[]> {
  const supabase = await createClient()

  let id = userId
  if (!id) {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return []
    id = user.id
  }

  const { data } = await supabase
    .from("learner_subjects")
    .select("syllabus, subject")
    .eq("user_id", id)
    .order("syllabus")
    .order("subject")

  return (data ?? []).map((r: any) => ({ syllabus: r.syllabus, subject: r.subject }))
}

/**
 * Replaces the learner's subject selection wholesale.
 *
 * Validates against both the curriculum AND the learner's own syllabi — a
 * stale tab shouldn't be able to save a subject from a syllabus they've since
 * switched away from.
 */
export async function setSelectedSubjects(subjects: SelectedSubject[]): Promise<SaveResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: "Not signed in" }

  if (subjects.length > 0) {
    const offered = await listSubjectsForLearner(user.id)
    const valid = new Set(offered.map((o) => `${o.syllabus}::${o.subject}`))
    for (const s of subjects) {
      if (!valid.has(`${s.syllabus}::${s.subject}`)) {
        return { ok: false, error: `"${s.subject}" isn't available under your selected syllabus` }
      }
    }
  }

  // Replace rather than merge: the UI sends the complete set, so a removed
  // subject must actually disappear.
  const { error: delError } = await supabase.from("learner_subjects").delete().eq("user_id", user.id)
  if (delError) {
    console.error("[syllabus] subject clear failed:", delError.message)
    return { ok: false, error: "Could not save your subjects" }
  }

  if (subjects.length > 0) {
    const { error } = await supabase
      .from("learner_subjects")
      .insert(subjects.map((s) => ({ user_id: user.id, syllabus: s.syllabus, subject: s.subject })))
    if (error) {
      console.error("[syllabus] subject save failed:", error.message)
      return { ok: false, error: "Could not save your subjects" }
    }
  }

  return { ok: true }
}

/**
 * Full curriculum directive for AI prompts: syllabus scoping plus the
 * learner's subjects. Null when nothing is selected, so callers can omit the
 * section rather than asserting "no syllabus".
 */
export async function describeCurriculumForPrompt(userId?: string): Promise<string | null> {
  const [selection, subjects] = await Promise.all([getLearnerSyllabus(userId), getSelectedSubjects(userId)])

  const base = describeSyllabusForPrompt(selection)
  if (!base) return null
  if (subjects.length === 0) return base

  const grouped = subjects.reduce<Record<string, string[]>>((acc, s) => {
    ;(acc[s.syllabus] ??= []).push(s.subject)
    return acc
  }, {})

  const lines = Object.entries(grouped).map(([syl, subs]) => `${syl}: ${subs.join(", ")}`)

  return `${base}\n\nThe learner studies these subjects specifically — stay within them unless asked otherwise:\n${lines.join("\n")}`
}

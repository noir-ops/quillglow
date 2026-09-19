import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

/**
 * Export a Study Agent session into the app's own sections.
 *
 * The agent generates a study plan, revision notes and a practice exam, but
 * they only ever lived on the session row — a learner couldn't open their plan
 * in the planner or edit the notes alongside their own. This copies the
 * generated content into the real tables so it behaves like anything else they
 * made.
 *
 * Practice exams are deliberately NOT handled here: they're already read
 * straight from the session by /api/study-agent/exams, so copying them would
 * duplicate the same questions into a second place.
 *
 * POST body: { sessionId: string, target: "planner" | "notes" }
 */
export async function POST(req: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  let body: { sessionId?: string; target?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const { sessionId, target } = body
  if (!sessionId || !target) {
    return NextResponse.json({ error: "sessionId and target are required" }, { status: 400 })
  }
  if (target !== "planner" && target !== "notes" && target !== "exam" && target !== "flashcards") {
    return NextResponse.json(
      { error: "target must be 'planner', 'notes', 'exam' or 'flashcards'" },
      { status: 400 },
    )
  }

  // Scoped to the signed-in user, so a session id from elsewhere can't be
  // exported into this account.
  const { data: session, error: sessionError } = await supabase
    .from("study_agent_sessions")
    .select("id, input_text, subject, study_plan, generated_notes, generated_exam, mind_map_data")
    .eq("id", sessionId)
    .eq("user_id", user.id)
    .maybeSingle()

  if (sessionError || !session) {
    return NextResponse.json({ error: "Study session not found" }, { status: 404 })
  }

  const subject: string | null = session.subject ?? null
  const label = (session.input_text ?? "").slice(0, 60) || "Study Agent session"

  // ── Planner ───────────────────────────────────────────────────────────────
  if (target === "planner") {
    const plan = session.study_plan
    const schedule: any[] = Array.isArray(plan?.schedule) ? plan.schedule : []

    if (schedule.length === 0) {
      return NextResponse.json({ error: "This session has no study plan to export" }, { status: 400 })
    }

    const totalDays = Number(plan?.totalDays) || schedule.length
    const startDate = new Date()
    const endDate = new Date(startDate)
    endDate.setDate(endDate.getDate() + Math.max(totalDays - 1, 0))

    const { data: createdPlan, error: planError } = await supabase
      .from("study_plans")
      .insert({
        user_id: user.id,
        title: `${subject ? `${subject}: ` : ""}${label}`,
        subject,
        duration: `${totalDays} day${totalDays === 1 ? "" : "s"}`,
        start_date: startDate.toISOString().slice(0, 10),
        end_date: endDate.toISOString().slice(0, 10),
        // goals_text and tips are both text[] (scripts/008_create_study_plans.sql).
        // A plain string was sent here for goals_text, same bug as tips below —
        // PostgREST tries to parse a bare string as a Postgres array literal
        // and rejects it as malformed on any normal sentence.
        goals_text: plan?.dailyGoal ? [plan.dailyGoal] : null,
        tips: Array.isArray(plan?.keyMilestones) && plan.keyMilestones.length > 0 ? plan.keyMilestones : null,
      })
      .select("id")
      .single()

    if (planError || !createdPlan) {
      console.error("[study-agent/export] plan insert failed:", planError?.message)
      return NextResponse.json(
        { error: "Could not create the study plan", detail: planError?.message },
        { status: 500 },
      )
    }

    // Each scheduled day becomes a goal, dated forward from today so the plan
    // lands on a real calendar rather than abstract "Day 1..n".
    //
    // Two more schema mismatches fixed here:
    //  - study_plan_goals.title is NOT NULL with no default. It was never
    //    set, so this insert would fail on the very first row regardless of
    //    the array issue above.
    //  - priority has CHECK (priority IN ('low','medium','high')), but the
    //    agent's prompt never constrains what it returns for that field. A
    //    single multi-row insert is atomic, so one out-of-range value (or a
    //    different case, e.g. "High") would silently fail ALL seven goals at
    //    once. Normalised here rather than trusting the model's output.
    const allowedPriorities = new Set(["low", "medium", "high"])
    const normalisePriority = (p: unknown) => {
      const v = String(p ?? "").toLowerCase().trim()
      return allowedPriorities.has(v) ? v : "medium"
    }

    const goals = schedule.map((item: any, i: number) => {
      const due = new Date(startDate)
      due.setDate(due.getDate() + i)
      const subtopics = Array.isArray(item?.subtopics) ? item.subtopics.join(", ") : ""
      return {
        plan_id: createdPlan.id,
        title: item?.topic || `Day ${i + 1}`,
        description: subtopics || null,
        due_date: due.toISOString().slice(0, 10),
        // estimated_hours is INTEGER (scripts/008_create_study_plans.sql), so
        // it must be whole. Rounding to 1dp sent "1.5" for a 90-minute day,
        // which Postgres rejects. Minimum 1 so a short session isn't stored
        // as 0 hours.
        estimated_hours: item?.timeMinutes
          ? Math.max(1, Math.round(Number(item.timeMinutes) / 60))
          : null,
        priority: normalisePriority(item?.priority),
      }
    })

    const { error: goalsError } = await supabase.from("study_plan_goals").insert(goals)
    if (goalsError) {
      console.error("[study-agent/export] goals insert failed:", goalsError.message)
      // The plan itself exists, so report partial success rather than
      // pretending nothing happened.
      return NextResponse.json(
        { error: "Plan created, but its daily goals could not be saved", detail: goalsError.message },
        { status: 500 },
      )
    }

    return NextResponse.json({ ok: true, target, planId: createdPlan.id, goalCount: goals.length })
  }

  // ── Exam ──────────────────────────────────────────────────────────────────
  if (target === "exam") {
    const mcqs: any[] = Array.isArray(session.generated_exam?.mcqs) ? session.generated_exam.mcqs : []

    if (mcqs.length === 0) {
      return NextResponse.json({ error: "This session has no practice exam to export" }, { status: 400 })
    }

    // The two features store questions differently: the Study Agent emits
    // correctIndex (0-3), while mock exams expect a correctAnswer LETTER.
    // Converting here is what makes the exported paper actually sittable and
    // gradeable rather than just readable.
    const questions = mcqs
      .filter((q: any) => q?.question && Array.isArray(q?.options) && q.options.length > 0)
      .map((q: any) => {
        const idx = Number(q?.correctIndex)
        const safeIdx = Number.isInteger(idx) && idx >= 0 && idx < q.options.length ? idx : 0
        return {
          question: String(q.question),
          options: q.options.map((o: any) => String(o)),
          type: "single",
          correctAnswer: String.fromCharCode(65 + safeIdx),
          explanation: q?.explanation ? String(q.explanation) : "",
          difficulty: q?.difficulty ?? "medium",
        }
      })

    if (questions.length === 0) {
      return NextResponse.json({ error: "The exam in this session has no usable questions" }, { status: 400 })
    }

    const { data: attempt, error: attemptError } = await supabase
      .from("mock_exam_attempts")
      .insert({
        user_id: user.id,
        document_ids: [],
        total_questions: questions.length,
        difficulty: "mixed",
        // Untimed: this came from a study session, not a timed sitting.
        time_limit_minutes: null,
        questions,
        user_answers: [],
        status: "in_progress",
        started_at: new Date().toISOString(),
        subject,
        syllabus: null,
      })
      .select("id")
      .single()

    if (attemptError || !attempt) {
      console.error("[study-agent/export] exam insert failed:", attemptError?.message)
      return NextResponse.json(
        { error: "Could not save the exam", detail: attemptError?.message },
        { status: 500 },
      )
    }

    return NextResponse.json({ ok: true, target, attemptId: attempt.id, questionCount: questions.length })
  }

  // ── Flashcards ────────────────────────────────────────────────────────────
  if (target === "flashcards") {
    // Flashcards live in the mind_map_data column — it was reused for the
    // flashcard set when that step replaced mind maps, to avoid a migration.
    const cards: any[] = Array.isArray(session.mind_map_data?.cards) ? session.mind_map_data.cards : []

    if (cards.length === 0) {
      return NextResponse.json({ error: "This session has no flashcards to export" }, { status: 400 })
    }

    const deckName = `${subject ? `${subject}: ` : ""}${label}`.slice(0, 120)

    const { data: deck, error: deckError } = await supabase
      .from("flashcard_decks")
      .insert({ user_id: user.id, name: deckName, subject })
      .select("id")
      .single()

    if (deckError || !deck) {
      console.error("[study-agent/export] deck create failed:", deckError?.message)
      return NextResponse.json(
        { error: "Could not create the flashcard deck", detail: deckError?.message },
        { status: 500 },
      )
    }

    const rows = cards
      .filter((c: any) => c?.question && c?.answer)
      .map((c: any) => {
        // difficulty is INTEGER 1-5 in the schema; clamp rather than trusting
        // whatever the model returned.
        const raw = Math.round(Number(c?.difficulty))
        const difficulty = Number.isFinite(raw) ? Math.min(5, Math.max(1, raw)) : 3
        return {
          deck_id: deck.id,
          question: String(c.question),
          answer: String(c.answer),
          difficulty,
          tags: subject ? [subject, "study-agent"] : ["study-agent"],
        }
      })

    if (rows.length === 0) {
      return NextResponse.json({ error: "No usable flashcards in this session" }, { status: 400 })
    }

    const { error: cardsError } = await supabase.from("flashcards").insert(rows)
    if (cardsError) {
      console.error("[study-agent/export] cards insert failed:", cardsError.message)
      // The deck exists but is empty — say so rather than reporting success.
      return NextResponse.json(
        { error: "Deck created, but its cards could not be saved", detail: cardsError.message },
        { status: 500 },
      )
    }

    return NextResponse.json({ ok: true, target, deckId: deck.id, cardCount: rows.length })
  }

  // ── Notes ─────────────────────────────────────────────────────────────────
  const notes = session.generated_notes
  const sections: any[] = Array.isArray(notes?.sections) ? notes.sections : []

  if (sections.length === 0) {
    return NextResponse.json({ error: "This session has no revision notes to export" }, { status: 400 })
  }

  // Flatten the structured JSON into markdown so it's editable in the notes
  // editor like any hand-written note, rather than a read-only blob.
  const content = sections
    .map((s: any) => {
      const parts: string[] = [`## ${s?.title ?? "Section"}`]

      if (Array.isArray(s?.keyPoints) && s.keyPoints.length) {
        parts.push("", "**Key points**", ...s.keyPoints.map((p: string) => `- ${p}`))
      }
      if (Array.isArray(s?.definitions) && s.definitions.length) {
        parts.push("", "**Definitions**", ...s.definitions.map((d: any) => `- **${d?.term}** — ${d?.definition}`))
      }
      if (Array.isArray(s?.examTips) && s.examTips.length) {
        parts.push("", "**Exam tips**", ...s.examTips.map((t: string) => `- ${t}`))
      }
      if (Array.isArray(s?.mnemonics) && s.mnemonics.length) {
        parts.push("", "**Mnemonics**", ...s.mnemonics.map((m: string) => `- ${m}`))
      }
      return parts.join("\n")
    })
    .join("\n\n")

  const { data: createdNote, error: noteError } = await supabase
    .from("notes")
    .insert({
      user_id: user.id,
      title: `${subject ? `${subject}: ` : ""}${label}`,
      subject,
      content,
      source: "study-agent",
      tags: ["study-agent", ...(subject ? [subject] : [])],
    })
    .select("id")
    .single()

  if (noteError || !createdNote) {
    console.error("[study-agent/export] note insert failed:", noteError?.message)
    return NextResponse.json(
      { error: "Could not create the note", detail: noteError?.message },
      { status: 500 },
    )
  }

  return NextResponse.json({ ok: true, target, noteId: createdNote.id })
}

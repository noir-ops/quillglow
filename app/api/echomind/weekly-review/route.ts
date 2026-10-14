import { NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase/server"
import { aiChatCompletion, isAIConfigured } from "@/lib/ai/provider"
import { describeCurriculumForPrompt, getLearnerSyllabus } from "@/lib/services/syllabus"
import { addDays, isoDay } from "@/lib/services/study-coach"
import { enforceQuota, refundQuota } from "@/lib/services/quota"

export const dynamic = "force-dynamic"

const QUESTION_COUNT = 10
const TIME_LIMIT_MINUTES = 20
const LETTERS = ["A", "B", "C", "D"]

interface Topic {
  title: string
  description: string | null
}

/**
 * Generates a Weekly Review test.
 *
 *   { goalId }  — a weekly review checkpoint from a study plan. The test
 *                 covers that plan's sessions in the 7 days the review closes.
 *   {}          — no plan: covers whatever the learner completed in the
 *                 planner in the last 7 days.
 *
 * The test is saved as a mock exam attempt, so it runs in the normal exam
 * screen, is graded on the server, and its score counts toward the Mock Exam
 * Score. Answers are never sent to the browser before grading.
 */
async function handlePost(req: Request, onCharge: (userId: string) => void) {
  try {
    if (!(await isAIConfigured())) {
      return NextResponse.json({ error: "AI provider not configured" }, { status: 500 })
    }
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const body = await req.json().catch(() => ({}))
    const goalId: string | null = typeof body?.goalId === "string" ? body.goalId : null

    // Its own monthly pool (plan_limits.weekly_review), separate from
    // EchoMind sessions so taking a weekly test never uses up EchoMind.
    const denied = await enforceQuota(user.id, "weekly_review")
    if (denied) return denied
    onCharge(user.id)

    let topics: Topic[] = []
    let subject: string | null = null
    let label = "Your last 7 days"

    if (goalId) {
      const { data: goal } = await supabase
        .from("study_plan_goals")
        .select("id, plan_id, title, due_date, is_review, study_plans!inner(id, title, subject, user_id)")
        .eq("id", goalId)
        .eq("study_plans.user_id", user.id)
        .maybeSingle()
      if (!goal) return NextResponse.json({ error: "Weekly review not found" }, { status: 404 })

      const plan = Array.isArray(goal.study_plans) ? goal.study_plans[0] : goal.study_plans
      subject = plan?.subject ?? null
      label = `${goal.title}${plan?.title ? ` — ${plan.title}` : ""}`
      const end = goal.due_date ? String(goal.due_date).slice(0, 10) : isoDay(new Date())

      const { data: week } = await supabase
        .from("study_plan_goals")
        .select("title, description")
        .eq("plan_id", goal.plan_id)
        .eq("is_review", false)
        .gte("due_date", addDays(end, -6))
        .lte("due_date", end)
        .order("due_date")
      topics = week ?? []

      // Nothing scheduled in that exact week (e.g. an edited plan): fall back
      // to the plan's most recent sessions up to the review date.
      if (topics.length === 0) {
        const { data: recent } = await supabase
          .from("study_plan_goals")
          .select("title, description")
          .eq("plan_id", goal.plan_id)
          .eq("is_review", false)
          .lte("due_date", end)
          .order("due_date", { ascending: false })
          .limit(7)
        topics = recent ?? []
      }
    } else {
      const since = addDays(isoDay(new Date()), -7)
      const { data: done } = await supabase
        .from("tasks")
        .select("title, description, subject")
        .eq("user_id", user.id)
        .eq("completed", true)
        .eq("is_review", false)
        .gte("completed_at", since)
        .order("completed_at", { ascending: false })
        .limit(10)
      topics = (done ?? []).map((t: any) => ({ title: t.title, description: t.description }))
      subject = (done ?? []).find((t: any) => t.subject)?.subject ?? null
    }

    // De-duplicate (a 4-week plan repeats the same topics each week).
    const seen = new Set<string>()
    topics = topics.filter((t) => {
      const k = String(t.title ?? "").toLowerCase().trim()
      if (!k || seen.has(k)) return false
      seen.add(k)
      return true
    })

    if (topics.length === 0) {
      return NextResponse.json(
        { error: "nothing_to_review", message: "There's nothing to review yet — complete a few planner sessions first." },
        { status: 400 },
      )
    }

    const [curriculum, sel] = await Promise.all([
      describeCurriculumForPrompt(user.id).catch(() => null),
      getLearnerSyllabus(user.id).catch(() => ({ primary: null, secondary: null })),
    ])

    const prompt = `Write a ${QUESTION_COUNT}-question multiple-choice weekly review test${subject ? ` for ${subject}` : ""}.

It must test ONLY these topics the student studied this week (spread questions across all of them):
${topics.map((t, i) => `${i + 1}. ${t.title}${t.description ? ` — ${String(t.description).slice(0, 300)}` : ""}`).join("\n")}

Mix recall, understanding and application questions, mostly medium difficulty.

Return ONLY JSON in exactly this shape:
{ "questions": [ { "question": "", "options": ["", "", "", ""], "type": "single", "correctAnswer": "A", "explanation": "", "difficulty": "medium", "topic": "" } ] }

Rules:
- Exactly 4 options, each the full answer text. Never letters alone, never prefixed with "A)" etc.
- "correctAnswer" is the LETTER of the correct option by position (first option = "A").
- "explanation" says in one or two sentences why the answer is right.
- "topic" is the topic number's title from the list above.`

    const response = await aiChatCompletion(
      {
        messages: [
          {
            role: "system",
            content: `${curriculum ? curriculum + "\n\n" : ""}You write accurate, syllabus-appropriate exam questions. Return only valid JSON.`,
          },
          { role: "user", content: prompt },
        ],
        temperature: 0.6,
        max_tokens: 4000,
        response_format: { type: "json_object" },
      },
      // Every learner's week differs; a cached test would be for someone else's topics.
      { task: "exam_generation", agent: "study_ai", userId: user.id, cacheable: false },
    )
    if (!response.ok) {
      console.error("[weekly-review] AI error:", await response.text())
      return NextResponse.json({ error: "Could not generate the review test. Please try again." }, { status: 502 })
    }

    const data = await response.json()
    const raw = String(data.choices?.[0]?.message?.content ?? "").trim().replace(/^```json\s*/i, "").replace(/```\s*$/, "")
    let parsed: any = null
    try {
      parsed = JSON.parse(raw)
    } catch {
      parsed = null
    }

    // Validate every question — a malformed one would be ungradable.
    const questions = (Array.isArray(parsed?.questions) ? parsed.questions : [])
      .map((q: any) => ({
        question: typeof q?.question === "string" ? q.question.trim() : "",
        options: Array.isArray(q?.options)
          ? q.options.map((o: any) => String(o ?? "").replace(/^\s*[A-D][).:\-]\s+/, "").trim())
          : [],
        type: "single",
        correctAnswer: typeof q?.correctAnswer === "string" ? q.correctAnswer.trim().toUpperCase().slice(0, 1) : "",
        explanation: typeof q?.explanation === "string" ? q.explanation.trim() : "",
        difficulty: typeof q?.difficulty === "string" ? q.difficulty : "medium",
        topic: typeof q?.topic === "string" ? q.topic : null,
      }))
      .filter(
        (q: any) =>
          q.question &&
          q.options.length === 4 &&
          q.options.every((o: string) => o.length > 1) &&
          LETTERS.includes(q.correctAnswer),
      )
      .slice(0, QUESTION_COUNT)

    if (questions.length < 5) {
      console.error("[weekly-review] too few valid questions:", questions.length)
      return NextResponse.json({ error: "Could not generate the review test. Please try again." }, { status: 502 })
    }

    const { data: attempt, error: attemptError } = await supabase
      .from("mock_exam_attempts")
      .insert({
        user_id: user.id,
        document_ids: [],
        total_questions: questions.length,
        difficulty: "medium",
        time_limit_minutes: TIME_LIMIT_MINUTES,
        subject,
        syllabus: sel.primary ?? null,
        questions,
        user_answers: [],
        status: "in_progress",
        started_at: new Date().toISOString(),
      })
      .select("id")
      .single()
    if (attemptError || !attempt) {
      console.error("[weekly-review] attempt insert failed:", attemptError?.message)
      return NextResponse.json({ error: "Could not save the review test" }, { status: 500 })
    }


    return NextResponse.json({
      attemptId: attempt.id,
      goalId,
      label,
      topics: topics.map((t) => t.title),
      questions: questions.map((q: any, i: number) => ({ id: i, question: q.question, options: q.options, type: "single", difficulty: q.difficulty })),
      totalQuestions: questions.length,
      timeLimit: TIME_LIMIT_MINUTES,
    })
  } catch (error) {
    console.error("[echomind/weekly-review]", error)
    return NextResponse.json({ error: "Could not generate the review test" }, { status: 500 })
  }
}

/**
 * Quota is taken where the old allowance check was (before any AI work) and
 * given back if the request then fails for any reason — bad input, an AI
 * error or a failed save — so a learner is only charged for a result.
 */
export async function POST(req: Request) {
  let chargedUser: string | null = null
  const res = await handlePost(req, (uid) => {
    chargedUser = uid
  })
  if (chargedUser && res.status >= 400 && res.status !== 429) await refundQuota(chargedUser, "weekly_review")
  return res
}

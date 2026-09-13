import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { aiChatCompletion, isAIConfigured } from "@/lib/ai/provider"
import { enforceQuota, refundQuota } from "@/lib/services/quota"
import { emitLearningEvent, recordLearningEvents, refreshScores } from "@/lib/services/learning-graph"

// ==========================
// POST - Generate Mock Exam
// ==========================
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }


    // Enforce AI quota (atomic: checks and consumes in one statement)

    const quotaDenied = await enforceQuota(user.id, "mock_exam")

    if (quotaDenied) return quotaDenied

    const body = await req.json()

    // ==========================
    // RETAKE FLOW
    // ==========================
    if (body.retake) {
      const {
        questions = [],
        totalQuestions = 0,
        difficulty = "mixed",
        timeLimit = null,
        userAnswers = [],
        correctAnswers = 0,
        scorePercentage = 0,
        timeTaken = 0,
      } = body

      const safeScore =
        typeof scorePercentage === "number"
          ? scorePercentage
          : parseFloat(scorePercentage || "0") || 0

      const { error: retakeError } = await supabase.from("mock_exam_attempts").insert({
        user_id: user.id,
        document_ids: [],
        total_questions: totalQuestions,
        difficulty,
        time_limit_minutes: timeLimit,
        questions,
        user_answers: userAnswers,
        correct_answers: Number(correctAnswers || 0),
        score_percentage: Number(safeScore.toFixed(2)),
        time_taken_seconds: timeTaken || 0,
        status: "completed",
        started_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
      })

      if (retakeError) {
        console.error("[POST RETAKE ERROR]", retakeError)
        return NextResponse.json({ error: "Failed to save retake attempt" }, { status: 500 })
      }

      return NextResponse.json({ success: true })
    }

    // ==========================
    // VALIDATION
    // ==========================
    const {
      documentText,
      documentIds,
      questionCount = 10,
      difficulty = "medium",
      timeLimit = null,
      mcqType = "mixed",
      fromSyllabus = false,
      subject,
      syllabus,
      topicFocus,
    } = body

    // Two valid sources: an uploaded document, or the learner's syllabus.
    if (!fromSyllabus && (!documentText || documentText.trim().length === 0)) {
      return NextResponse.json({ error: "No document content provided" }, { status: 400 })
    }
    if (fromSyllabus && !subject) {
      return NextResponse.json({ error: "A subject is required to generate from your syllabus" }, { status: 400 })
    }

    if (!(await isAIConfigured())) {
      return NextResponse.json({ error: "AI provider API key not configured" }, { status: 500 })
    }

    // ==========================
    // PROMPT ENGINEERING
    // ==========================
    const difficultyInstruction: Record<string, string> = {
      easy: "Focus on basic recall.",
      medium: "Focus on application.",
      hard: "Focus on analysis.",
      exam: "Simulate real exam difficulty.",
      mixed: "Mix easy, medium, hard.",
    }

    const singleRatio =
      mcqType === "single"
        ? questionCount
        : mcqType === "multiple"
          ? 0
          : Math.round(questionCount * 0.6)

    const multipleRatio = questionCount - singleRatio

    const mcqTypeInstruction =
      mcqType === "single"
        ? `All ${questionCount} questions are single-answer.`
        : mcqType === "multiple"
          ? `All ${questionCount} questions are multiple-answer.`
          : `Mix ${singleRatio} single and ${multipleRatio} multiple questions.`

    // When generating from the syllabus there's no source document — the
    // curriculum itself is the grounding, so the model is told what to cover
    // rather than given text to draw from.
    const contentBlock = fromSyllabus
      ? `SYLLABUS: ${syllabus ?? "the learner's syllabus"}
SUBJECT: ${subject}
${topicFocus ? `TOPIC FOCUS: ${topicFocus}` : "Cover a representative spread of the subject's topics."}

Write questions in the style, terminology, notation and marking conventions of this syllabus. Match the difficulty and phrasing a student would meet in a real ${syllabus ?? ""} ${subject} paper.`
      : `CONTENT:
${(documentText ?? "").substring(0, 12000)}`

    const prompt = `
Generate ${questionCount} MCQ questions.

${contentBlock}

${difficultyInstruction[difficulty]}

${mcqTypeInstruction}

Return ONLY JSON:
{
  "questions": [
    {
      "question": "",
      "options": ["A", "B", "C", "D"],
      "type": "single",
      "correctAnswer": "A",
      "explanation": "",
      "difficulty": "easy"
    }
  ]
}
`

    // ==========================
    // AI PROVIDER CALL
    // ==========================
    const response = await aiChatCompletion({
      messages: [
        {
          role: "system",
          content: "Return ONLY valid JSON. No markdown.",
        },
        { role: "user", content: prompt },
      ],
      temperature: difficulty === "exam" ? 0.5 : 0.7,
      max_tokens: 6000,
    }, { task: "exam_generation", agent: "study_ai" })

    if (!response.ok) {
      const err = await response.text()
      console.error("[AI PROVIDER ERROR]", err)
      return NextResponse.json({ error: "AI API error" }, { status: 500 })
    }

    const data = await response.json()
    const textResponse = data?.choices?.[0]?.message?.content

    if (!textResponse || textResponse.trim().length === 0) {
      console.error("[EMPTY AI RESPONSE]", data)
      return NextResponse.json({ error: "Empty AI response" }, { status: 500 })
    }

    // ==========================
    // SAFE JSON PARSE
    // ==========================
    let result
    try {
      let cleaned = textResponse.trim()
      cleaned = cleaned.replace(/```json/g, "").replace(/```/g, "")
      result = JSON.parse(cleaned)
    } catch (e) {
      console.error("[JSON PARSE FAILED]", textResponse)
      return NextResponse.json(
        {
          error: "Invalid AI JSON",
          debug: textResponse.slice(0, 500),
        },
        { status: 500 },
      )
    }

    if (!Array.isArray(result.questions)) {
      return NextResponse.json({ error: "Invalid question format" }, { status: 500 })
    }

    // ==========================
    // CREATE ATTEMPT
    // ==========================
    const { data: attempt, error: attemptError } = await supabase
      .from("mock_exam_attempts")
      .insert({
        user_id: user.id,
        document_ids: documentIds || [],
        total_questions: result.questions.length,
        difficulty,
        time_limit_minutes: timeLimit,
        questions: result.questions,
        user_answers: [],
        status: "in_progress",
        started_at: new Date().toISOString(),
      })
      .select("id")
      .single()

    if (attemptError) {
      console.error("[INSERT ERROR]", attemptError)
      return NextResponse.json({ error: "Failed to create attempt" }, { status: 500 })
    }

    return NextResponse.json({
      attemptId: attempt.id,
      questions: result.questions.map((q: any, i: number) => ({
        id: i,
        question: q.question,
        options: q.options,
        type: q.type || "single",
        difficulty: q.difficulty,
      })),
      totalQuestions: result.questions.length,
      timeLimit,
    })
  } catch (error) {
    console.error("[POST CRASH]", error)
    return NextResponse.json(
      {
        error: "Failed to generate exam",
        details: error instanceof Error ? error.message : "unknown",
      },
      { status: 500 },
    )
  }
}

// ==========================
// PUT - Grade Exam
// ==========================
export async function PUT(req: NextRequest) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { attemptId, userAnswers = [], timeTaken = 0 } = await req.json()

    if (!attemptId) {
      return NextResponse.json({ error: "Missing attemptId" }, { status: 400 })
    }

    const { data: attempt, error } = await supabase
      .from("mock_exam_attempts")
      .select("questions, total_questions")
      .eq("id", attemptId)
      .eq("user_id", user.id)
      .single()

    if (error || !attempt) {
      return NextResponse.json({ error: "Attempt not found" }, { status: 404 })
    }

    const questions = Array.isArray(attempt.questions)
      ? attempt.questions
      : JSON.parse(attempt.questions || "[]")

    let correctCount = 0

    const gradedAnswers = (questions || []).map((q: any, idx: number) => {
      const userAnswer = userAnswers[idx]
      const isMultiple = Array.isArray(q.correctAnswer)

      let isCorrect = false
      let isPartial = false

      if (isMultiple) {
        const correct = q.correctAnswer || []
        const user = Array.isArray(userAnswer) ? userAnswer : userAnswer ? [userAnswer] : []

        const fullMatch =
          correct.every((c: string) => user.includes(c)) &&
          user.every((c: string) => correct.includes(c))

        const partial = !fullMatch && correct.some((c: string) => user.includes(c))

        isCorrect = fullMatch
        isPartial = partial

        if (fullMatch) correctCount++
        else if (partial) correctCount += 0.5
      } else {
        isCorrect = userAnswer === q.correctAnswer
        if (isCorrect) correctCount++
      }

      return {
        questionIndex: idx,
        userAnswer,
        correctAnswer: q.correctAnswer,
        isCorrect,
        isPartial,
        explanation: q.explanation,
      }
    })

    const scorePercentage = (correctCount / (attempt.total_questions || 1)) * 100

    // Learning Graph: one event per question (fine-grained evidence), plus one
    // for the attempt overall. Fire-and-forget so grading is never delayed.
    void recordLearningEvents(
      gradedAnswers.map((g: any) => {
        const q = questions[g.questionIndex] || {}
        return {
          userId: user.id,
          eventType: "quiz_answer" as const,
          source: "mock-exam",
          rawTopic: q.topic || q.concept || null,
          subject: attempt.subject || null,
          outcome: g.isCorrect ? ("correct" as const) : g.isPartial ? ("partial" as const) : ("incorrect" as const),
          payload: { attemptId: attempt.id, questionIndex: g.questionIndex, difficulty: attempt.difficulty },
        }
      }),
    )

    emitLearningEvent({
      userId: user.id,
      eventType: "exam_attempt",
      source: "mock-exam",
      subject: attempt.subject || null,
      score: scorePercentage,
      maxScore: 100,
      durationMs: attempt.time_taken_seconds ? attempt.time_taken_seconds * 1000 : null,
      payload: { attemptId: attempt.id, totalQuestions: attempt.total_questions },
    })

    refreshScores(user.id, undefined, attempt.subject || undefined)

    const { error: updateError } = await supabase
      .from("mock_exam_attempts")
      .update({
        user_answers: userAnswers,
        correct_answers: Number(correctCount),
        score_percentage: Number(scorePercentage.toFixed(2)),
        time_taken_seconds: timeTaken,
        status: "completed",
        completed_at: new Date().toISOString(),
      })
      .eq("id", attemptId)

    if (updateError) {
      console.error("[UPDATE ERROR]", updateError)
      return NextResponse.json({ error: "Failed to save results" }, { status: 500 })
    }

    return NextResponse.json({
      correctAnswers: correctCount,
      totalQuestions: attempt.total_questions,
      scorePercentage: Number(scorePercentage.toFixed(2)),
      gradedAnswers,
    })
  } catch (error) {
    console.error("[PUT CRASH]", error)
    return NextResponse.json({ error: "Failed to grade exam" }, { status: 500 })
  }
}

// ==========================
// GET - History
// ==========================
export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const id = searchParams.get("id")

    if (id) {
      const { data, error } = await supabase
        .from("mock_exam_attempts")
        .select("*")
        .eq("id", id)
        .eq("user_id", user.id)
        .single()

      if (error) {
        return NextResponse.json({ error: "Not found" }, { status: 404 })
      }

      return NextResponse.json(data)
    }

    const { data, error } = await supabase
      .from("mock_exam_attempts")
      .select(
        "id, total_questions, difficulty, score_percentage, correct_answers, time_taken_seconds, created_at, status",
      )
      .eq("user_id", user.id)
      .eq("status", "completed")
      .order("created_at", { ascending: false })
      .limit(50)

    if (error) {
      return NextResponse.json({ error: "Failed to fetch" }, { status: 500 })
    }

    return NextResponse.json({ attempts: data })
  } catch (error) {
    console.error("[GET CRASH]", error)
    return NextResponse.json({ error: "Failed to fetch attempts" }, { status: 500 })
  }
}

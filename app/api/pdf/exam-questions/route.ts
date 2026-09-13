import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { aiChatCompletion, isAIConfigured } from "@/lib/ai/provider"
import { enforceQuota, refundQuota } from "@/lib/services/quota"

const FREE_EXAM_LIMIT = 3
const GENIUS_PLAN = "genius"

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

    const quotaDenied = await enforceQuota(user.id, "exam_questions")

    if (quotaDenied) return quotaDenied

    const { text, subject, pdfFileName, settings, generationId, seed, previousQuestions } = await req.json()

    if (!text || text.trim().length === 0) {
      return NextResponse.json({ error: "No text content provided" }, { status: 400 })
    }

    const { data: subscription } = await supabase
      .from("subscriptions")
      .select("plan_type, status")
      .eq("user_id", user.id)
      .single()

    const isGenius = subscription?.plan_type === GENIUS_PLAN

    if (!isGenius) {
      const monthYear = new Date().toISOString().slice(0, 7)
      const { data: usage } = await supabase
        .from("usage_tracking")
        .select("exams_generated")
        .eq("user_id", user.id)
        .eq("month_year", monthYear)
        .single()

      const examsGenerated = usage?.exams_generated || 0

      if (examsGenerated >= FREE_EXAM_LIMIT) {
        return NextResponse.json(
          {
            error: "limit_reached",
            message: `You've used all your ${FREE_EXAM_LIMIT} exam generations this month. Exam coming up? Unlock unlimited for $4.99 — less than a coffee. ☕`,
            current: examsGenerated,
            limit: FREE_EXAM_LIMIT,
          },
          { status: 403 },
        )
      }
    }

    if (!(await isAIConfigured())) {
      return NextResponse.json({ error: "AI provider API key not configured" }, { status: 500 })
    }

    const mcqCount = settings?.mcqCount ?? 8
    const shortCount = settings?.shortCount ?? 5
    const longCount = settings?.longCount ?? 2
    const difficulty = settings?.difficulty ?? "mixed"
    const avoidRepeats = settings?.avoidRepeats ?? true

    const difficultyInstruction = {
      easy: "Focus on recall and basic understanding. Questions should test fundamental concepts and definitions.",
      medium: "Focus on applied understanding. Questions should require students to apply concepts to new situations.",
      hard: "Focus on multi-step reasoning. Questions should require analysis, synthesis, and critical thinking.",
      mixed: "Include a balanced mix of Easy (recall), Medium (application), and Hard (analysis) questions.",
    }[difficulty]

    const repeatAvoidanceInstruction =
      avoidRepeats && previousQuestions && previousQuestions.length > 0
        ? `\n\nIMPORTANT: Avoid generating questions similar to these previous questions:\n${previousQuestions.slice(0, 10).join("\n")}\n\nGenerate completely NEW questions with different wording, concepts, and structure.`
        : ""

    const prompt = `Analyze this content and generate exam-style questions with answers.

Subject: ${subject || "General"}
Generation ID: ${generationId}
Random Seed: ${seed}

Content:
${text.substring(0, 10000)}

${difficultyInstruction}${repeatAvoidanceInstruction}

Return ONLY a valid JSON object (no markdown, no code blocks) with this EXACT structure:
{
  "summary": "A brief 2-3 sentence summary of the key exam points from this content",
  "mcq": [
    {
      "question": "The question text",
      "options": ["A) Option 1", "B) Option 2", "C) Option 3", "D) Option 4"],
      "answer": "A",
      "explanation": "Brief explanation of why this is correct"
    }
  ],
  "short": [
    {
      "question": "The question text",
      "answer": "A model answer for this question",
      "key_points": ["Point 1", "Point 2", "Point 3"]
    }
  ],
  "long": [
    {
      "question": "Essay-style question requiring detailed explanation",
      "answer_outline": ["Introduction point", "Main argument 1", "Main argument 2", "Conclusion"],
      "key_points": ["Critical concept 1", "Critical concept 2", "Critical concept 3"],
      "marking_guide": "Describe what markers should look for in a strong answer"
    }
  ],
  "keyExamPoints": [
    "Important concept 1 that might appear on an exam",
    "Important concept 2 that might appear on an exam"
  ]
}

Generate exactly ${mcqCount} MCQ questions, ${shortCount} short answer questions, and ${longCount} long answer questions.
Ensure each question tests different concepts and uses varied phrasing.
Focus on testable concepts, definitions, and important relationships.`

    const response = await aiChatCompletion({
      messages: [
        {
          role: "system",
          content: `You are an expert exam question generator for students. You MUST return valid JSON only, no markdown formatting. Use varied question structures and avoid repetition.`,
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.8,
      max_tokens: 4096,
    }, { task: "exam_generation", agent: "study_ai" })

    if (!response.ok) {
      const errorText = await response.text()
      console.error("[v0] AI provider error:", errorText)
      return NextResponse.json({ error: "AI API error" }, { status: response.status })
    }

    const data = await response.json()
    const text_response = data.choices?.[0]?.message?.content

    if (!text_response) {
      return NextResponse.json({ error: "No response from AI" }, { status: 500 })
    }

    let jsonText = text_response.trim()
    if (jsonText.startsWith("```json")) {
      jsonText = jsonText.replace(/```json\n?/g, "").replace(/```\n?/g, "")
    } else if (jsonText.startsWith("```")) {
      jsonText = jsonText.replace(/```\n?/g, "")
    }

    let result
    try {
      result = JSON.parse(jsonText)
    } catch (parseError) {
      console.error("[v0] JSON parse error:", parseError, "Raw text:", jsonText)
      return NextResponse.json({ error: "invalid_json", details: "Failed to parse AI response" }, { status: 500 })
    }

    const formattedResult = {
      summary: result.summary,
      multipleChoice: (result.mcq || []).map((q: any) => ({
        question: q.question,
        options: q.options,
        correctAnswer: q.answer, // Map answer to correctAnswer
        explanation: q.explanation,
        difficulty: q.difficulty,
      })),
      shortAnswer:
        result.short?.map((q: any) => ({
          question: q.question,
          sampleAnswer: q.answer,
          keyPoints: q.key_points || [],
        })) || [],
      longAnswer: result.long || [],
      keyExamPoints: result.keyExamPoints || [],
    }

    if (settings?.shuffleOrder) {
      formattedResult.multipleChoice = shuffleArray(formattedResult.multipleChoice)
      formattedResult.shortAnswer = shuffleArray(formattedResult.shortAnswer)
      formattedResult.longAnswer = shuffleArray(formattedResult.longAnswer)
    }

    const { data: savedExam, error: saveError } = await supabase
      .from("generated_exams")
      .insert({
        user_id: user.id,
        subject: subject || "General",
        pdf_filename: pdfFileName || null,
        summary: formattedResult.summary,
        multiple_choice: formattedResult.multipleChoice,
        short_answer: formattedResult.shortAnswer,
        key_exam_points: formattedResult.keyExamPoints,
        long_answer: formattedResult.longAnswer,
      })
      .select("id")
      .single()

    if (saveError) {
      console.error("[v0] Error saving exam:", saveError)
    }

    const monthYear = new Date().toISOString().slice(0, 7)

    const { data: existingUsage } = await supabase
      .from("usage_tracking")
      .select("id, exams_generated")
      .eq("user_id", user.id)
      .eq("month_year", monthYear)
      .single()

    if (existingUsage) {
      await supabase
        .from("usage_tracking")
        .update({
          exams_generated: (existingUsage.exams_generated || 0) + 1,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingUsage.id)
    } else {
      await supabase.from("usage_tracking").insert({
        user_id: user.id,
        month_year: monthYear,
        exams_generated: 1,
        ai_generations_used: 0,
        tasks_created: 0,
      })
    }

    await supabase.rpc("increment_usage", {
      p_user_id: user.id,
      p_month_year: monthYear,
      p_column_name: "ai_generations_used",
      p_increment_by: 1,
    })

    return NextResponse.json({
      ...formattedResult,
      examId: savedExam?.id,
    })
  } catch (error) {
    console.error("[v0] Exam generation error:", error)
    return NextResponse.json(
      { error: "Failed to generate exam questions", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    )
  }
}

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
    const examId = searchParams.get("id")

    if (examId) {
      const { data: exam, error } = await supabase
        .from("generated_exams")
        .select("*")
        .eq("id", examId)
        .eq("user_id", user.id)
        .single()

      if (error || !exam) {
        return NextResponse.json({ error: "Exam not found" }, { status: 404 })
      }

      return NextResponse.json(exam)
    }

    const { data: exams, error } = await supabase
      .from("generated_exams")
      .select("id, subject, pdf_filename, summary, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50)

    if (error) {
      return NextResponse.json({ error: "Failed to fetch exams" }, { status: 500 })
    }

    const monthYear = new Date().toISOString().slice(0, 7)
    const { data: usage } = await supabase
      .from("usage_tracking")
      .select("exams_generated")
      .eq("user_id", user.id)
      .eq("month_year", monthYear)
      .single()

    const { data: subscription } = await supabase
      .from("subscriptions")
      .select("plan_type")
      .eq("user_id", user.id)
      .single()

    const isGenius = subscription?.plan_type === GENIUS_PLAN

    return NextResponse.json({
      exams,
      usage: {
        current: usage?.exams_generated || 0,
        limit: isGenius ? null : FREE_EXAM_LIMIT,
        isGenius,
      },
    })
  } catch (error) {
    console.error("[v0] Fetch exams error:", error)
    return NextResponse.json({ error: "Failed to fetch exams" }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const examId = searchParams.get("id")

    if (!examId) {
      return NextResponse.json({ error: "Exam ID required" }, { status: 400 })
    }

    const { error } = await supabase.from("generated_exams").delete().eq("id", examId).eq("user_id", user.id)

    if (error) {
      return NextResponse.json({ error: "Failed to delete exam" }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[v0] Delete exam error:", error)
    return NextResponse.json({ error: "Failed to delete exam" }, { status: 500 })
  }
}

function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}

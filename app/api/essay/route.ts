import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { aiChatCompletion, isAIConfigured } from "@/lib/ai/provider"
import { enforceQuota, refundQuota } from "@/lib/services/quota"
import { emitLearningEvent, refreshScores } from "@/lib/services/learning-graph"

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

    const quotaDenied = await enforceQuota(user.id, "essay")

    if (quotaDenied) return quotaDenied

    if (!(await isAIConfigured())) {
      return NextResponse.json({ error: "AI provider API key not configured" }, { status: 500 })
    }

    const { documentText, topic, wordLimit, questionCount = 1 } = await req.json()

    if (!documentText || !topic) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    const count = Math.max(1, Math.min(10, questionCount))

    // Generate essay questions based on document
    const questionPrompt = `Based on the following study material, generate exactly ${count} challenging essay question${count > 1 ? "s" : ""} about "${topic}".

Study Material:
${documentText.slice(0, 8000)}

Requirements:
- Create thought-provoking questions that require analysis and synthesis
- Each question should be answerable using the provided material
- Target word count per essay: ${wordLimit || 500} words
- Focus on: ${topic}
- Each question should cover a DIFFERENT aspect of the topic
${count > 1 ? `- Make sure all ${count} questions are distinct and non-overlapping` : ""}

Return ONLY the questions as a JSON array of strings. Example: ["Question 1?", "Question 2?"]
Return valid JSON only, no other text.`

    const questionResponse = await aiChatCompletion({
      messages: [{ role: "user", content: questionPrompt }],
      temperature: 0.7,
      max_tokens: 1000,
    }, { task: "essay_review", agent: "study_ai" })

    if (!questionResponse.ok) {
      const errorText = await questionResponse.text()
      console.error("AI provider error:", errorText)
      return NextResponse.json({ error: "Failed to generate essay questions" }, { status: 500 })
    }

    const questionData = await questionResponse.json()
    const rawContent = questionData.choices?.[0]?.message?.content?.trim()

    if (!rawContent) {
      return NextResponse.json({ error: "Failed to generate essay questions" }, { status: 500 })
    }

    // Parse the questions array from the response
    let questions: string[]
    try {
      const jsonMatch = rawContent.match(/```json\n?([\s\S]*?)\n?```/) || rawContent.match(/```\n?([\s\S]*?)\n?```/)
      const jsonStr = jsonMatch ? jsonMatch[1] : rawContent
      const parsed = JSON.parse(jsonStr)
      questions = Array.isArray(parsed) ? parsed : [parsed]
    } catch {
      // If JSON parsing fails, try splitting by numbered list
      questions = rawContent
        .split(/\n\d+[\.\)]\s*/)
        .map((q: string) => q.trim())
        .filter((q: string) => q.length > 20)
      if (questions.length === 0) {
        questions = [rawContent]
      }
    }

    // Ensure we have the right number of questions
    questions = questions.slice(0, count)

    // Save each question as a separate attempt in the database
    const referenceText = documentText.slice(0, 15000)
    const insertRows = questions.map((q) => ({
      user_id: user.id,
      question_text: q,
      user_answer: "",
      feedback_json: { topic, wordLimit: wordLimit || 500, referenceText },
    }))

    const { data: attempts, error: dbError } = await supabase
      .from("essay_attempts")
      .insert(insertRows)
      .select("id, question_text")

    if (dbError || !attempts) {
      console.error("Error saving essay attempts:", dbError)
      return NextResponse.json({ error: "Failed to save essay attempts" }, { status: 500 })
    }

    return NextResponse.json({
      questions: attempts.map((a) => ({
        attemptId: a.id,
        question: a.question_text,
      })),
      topic,
      wordLimit: wordLimit || 500,
    })
  } catch (error) {
    console.error("[v0] Essay API error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!(await isAIConfigured())) {
      return NextResponse.json({ error: "AI provider API key not configured" }, { status: 500 })
    }

    const { attemptId, essayAnswer } = await req.json()

    if (!attemptId || !essayAnswer) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    // Fetch the attempt
    const { data: attempt, error: fetchError } = await supabase
      .from("essay_attempts")
      .select("*")
      .eq("id", attemptId)
      .eq("user_id", user.id)
      .single()

    if (fetchError || !attempt) {
      return NextResponse.json({ error: "Essay attempt not found" }, { status: 404 })
    }

    // Extract stored metadata from feedback_json
    const meta = attempt.feedback_json || {}
    const topic = meta.topic || "General"
    const wordLimit = meta.wordLimit || 500
    const referenceText = meta.referenceText || ""

    // Evaluate the essay using AI
    const evaluationPrompt = `You are an expert educator evaluating a student's essay.

Essay Question: ${attempt.question_text}
Topic: ${topic}
Word Limit: ${wordLimit} words

Reference Material:
${referenceText.slice(0, 8000)}

Student's Essay:
${essayAnswer}

Evaluate the essay thoroughly and provide:
1. Overall Score (0-100)
2. Strengths (3-4 bullet points)
3. Areas for Improvement (3-4 bullet points)
4. Specific Feedback on:
   - Content & Analysis
   - Structure & Organization
   - Use of Evidence from material
   - Clarity & Grammar
5. Suggestions for improvement

Format your response as JSON:
{
  "score": <number 0-100>,
  "strengths": ["strength 1", "strength 2", "strength 3"],
  "improvements": ["improvement 1", "improvement 2", "improvement 3"],
  "contentFeedback": "detailed feedback on content",
  "structureFeedback": "detailed feedback on structure",
  "evidenceFeedback": "detailed feedback on evidence use",
  "clarityFeedback": "detailed feedback on clarity",
  "suggestions": "overall suggestions for next essay"
}`

    const evalResponse = await aiChatCompletion({
      messages: [{ role: "user", content: evaluationPrompt }],
      temperature: 0.3,
      max_tokens: 2000,
    })

    if (!evalResponse.ok) {
      const errorText = await evalResponse.text()
      console.error("[v0] AI evaluation error:", errorText)
      return NextResponse.json({ error: "Failed to evaluate essay" }, { status: 500 })
    }

    const evalData = await evalResponse.json()
    const evalContent = evalData.choices?.[0]?.message?.content?.trim()
    let evaluation

    try {
      // Extract JSON from markdown code blocks if present
      const jsonMatch = evalContent?.match(/```json\n?([\s\S]*?)\n?```/) || evalContent?.match(/```\n?([\s\S]*?)\n?```/)
      const jsonStr = jsonMatch ? jsonMatch[1] : evalContent
      evaluation = JSON.parse(jsonStr || "{}")
    } catch {
      evaluation = {
        score: 70,
        strengths: ["Essay demonstrates understanding of the topic"],
        improvements: ["Could provide more specific examples"],
        contentFeedback: "Good overall content",
        structureFeedback: "Well structured",
        evidenceFeedback: "Evidence could be stronger",
        clarityFeedback: "Generally clear writing",
        suggestions: "Continue practicing analytical writing",
      }
    }

    // Calculate word count
    const wordCount = essayAnswer.trim().split(/\s+/).length

    // Update the attempt - columns: user_answer, word_count, ai_score, feedback_json
    const { error: updateError } = await supabase
      .from("essay_attempts")
      .update({
        user_answer: essayAnswer,
        word_count: wordCount,
        ai_score: evaluation.score,
        feedback_json: { ...meta, evaluation },
        updated_at: new Date().toISOString(),
      })
      .eq("id", attemptId)

    if (updateError) {
      console.error("[v0] Error updating essay attempt:", updateError)
      return NextResponse.json({ error: "Failed to save evaluation" }, { status: 500 })
    }

    // Learning Graph: essay grading is strong evidence of writing mastery.
    emitLearningEvent({
      userId: user.id,
      eventType: "essay_submitted",
      source: "essay",
      rawTopic: meta?.questionText ? String(meta.questionText).slice(0, 120) : null,
      subject: meta?.subject ?? null,
      score: evaluation.score,
      maxScore: 100,
      payload: { attemptId: meta?.attemptId ?? null },
    })
    refreshScores(user.id)

    return NextResponse.json({
      score: evaluation.score,
      wordCount,
      feedback: evaluation,
    })
  } catch (error) {
    console.error("[v0] Essay evaluation error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
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
    const attemptId = searchParams.get("id")

    if (attemptId) {
      // Fetch single attempt
      const { data, error } = await supabase
        .from("essay_attempts")
        .select("*")
        .eq("id", attemptId)
        .eq("user_id", user.id)
        .single()

      if (error || !data) {
        return NextResponse.json({ error: "Attempt not found" }, { status: 404 })
      }

      return NextResponse.json(data)
    }

    // Fetch all attempts - use actual column names
    const { data, error } = await supabase
      .from("essay_attempts")
      .select("id, question_text, user_answer, word_count, ai_score, feedback_json, created_at, updated_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })

    if (error) {
      console.error("[v0] Error fetching essay attempts:", error)
      return NextResponse.json({ error: "Failed to fetch attempts" }, { status: 500 })
    }

    return NextResponse.json(data || [])
  } catch (error) {
    console.error("[v0] Essay GET error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

import { GeneratedQuestSchema } from "@/lib/types/quest"
import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { aiChatCompletion, isAIConfigured } from "@/lib/ai/provider"
import { enforceQuota, refundQuota } from "@/lib/services/quota"

export async function POST(req: Request) {
  try {
    const supabase = await createClient()

    // Check authentication
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }


    // Enforce AI quota (atomic: checks and consumes in one statement)

    const quotaDenied = await enforceQuota(user.id, "quest_generation")

    if (quotaDenied) return quotaDenied

    const { subject, difficulty, questionCount = 5 } = await req.json()

    if (!subject || !difficulty) {
      return NextResponse.json({ error: "Subject and difficulty are required" }, { status: 400 })
    }

    if (!(await isAIConfigured())) {
      return NextResponse.json({ error: "AI provider API key not configured" }, { status: 500 })
    }

    // Generate quest using the admin-selected provider/model
    const response = await aiChatCompletion({
      messages: [
        {
          role: "system",
          content:
            "You are an educational quest generator. Return ONLY a valid JSON object, no markdown code blocks and no explanations.",
        },
        {
          role: "user",
          content: `Generate an educational quiz quest with the following parameters:
      
Subject: ${subject}
Difficulty: ${difficulty}
Number of Questions: ${questionCount}

Create a fun, engaging quest that helps students learn. Include:
1. A catchy title that makes learning exciting
2. A brief description explaining what students will learn
3. ${questionCount} multiple-choice questions with 4 options each
4. Clear explanations for each correct answer
5. Appropriate XP reward based on difficulty (easy: 10-20, medium: 25-40, hard: 45-60)

Make the questions educational but fun, and ensure they're appropriate for the difficulty level.

Return ONLY a valid JSON object with this exact structure:
{
  "title": "string",
  "description": "string",
  "subject": "string",
  "difficulty": "easy" | "medium" | "hard",
  "xpReward": 25,
  "questions": [
    {
      "question": "string",
      "options": ["option1", "option2", "option3", "option4"],
      "correctAnswer": 0,
      "explanation": "string"
    }
  ]
}

Rules:
- "options" must always contain exactly 4 strings.
- "correctAnswer" is the 0-based index (0-3) of the correct option.
- "difficulty" must be exactly one of: easy, medium, hard.`,
        },
      ],
      temperature: 0.8,
      max_tokens: 2000,
      response_format: { type: "json_object" },
    }, { task: "exam_generation", agent: "study_ai" })

    if (!response.ok) {
      const errorText = await response.text()
      console.error("[v0] AI provider error:", errorText)
      return NextResponse.json({ error: "Failed to generate quest" }, { status: 500 })
    }

    const data = await response.json()
    const rawContent: string = data.choices?.[0]?.message?.content ?? ""

    // Strip any accidental markdown fences before parsing
    let jsonText = rawContent.trim()
    jsonText = jsonText
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/\s*```$/i, "")

    let parsed: unknown
    try {
      parsed = JSON.parse(jsonText)
    } catch {
      const match = jsonText.match(/\{[\s\S]*\}/)
      if (!match) {
        console.error("[v0] Could not parse quest JSON:", jsonText.slice(0, 500))
        return NextResponse.json({ error: "Failed to generate quest" }, { status: 500 })
      }
      parsed = JSON.parse(match[0])
    }

    const result = GeneratedQuestSchema.safeParse(parsed)
    if (!result.success) {
      console.error("[v0] Quest failed schema validation:", result.error.message)
      return NextResponse.json({ error: "Failed to generate quest" }, { status: 500 })
    }
    const quest = result.data

    // Save quest to database
    const { data: savedQuest, error: questError } = await supabase
      .from("quests")
      .insert({
        title: quest.title,
        description: quest.description,
        subject: quest.subject,
        difficulty: quest.difficulty,
        xp_reward: quest.xpReward,
        questions: quest.questions,
      })
      .select()
      .single()

    if (questError) {
      console.error("[v0] Error saving quest:", questError)
      return NextResponse.json({ error: "Failed to save quest" }, { status: 500 })
    }

    return NextResponse.json({ quest: savedQuest })
  } catch (error) {
    console.error("[v0] Error generating quest:", error)
    return NextResponse.json({ error: "Failed to generate quest" }, { status: 500 })
  }
}

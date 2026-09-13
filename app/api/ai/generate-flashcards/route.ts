import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { aiChatCompletion, isAIConfigured } from "@/lib/ai/provider"
import { enforceQuota, refundQuota } from "@/lib/services/quota"
import { emitLearningEvent } from "@/lib/services/learning-graph"

function truncateContent(content: string, maxChars = 8000): string {
  if (content.length <= maxChars) return content
  return content.slice(0, maxChars) + "\n\n[Content truncated for processing...]"
}

function buildSystemPrompt(mode: string, cardTypes: string[]): string {
  const modeInstructions = {
    quick: "Focus only on the most important, high-yield concepts. Prioritize definitions and key facts. Generate fewer but highly impactful cards.",
    full: "Cover as many distinct concepts as possible. Include definitions, relationships, processes, and key facts comprehensively.",
    exam: "Focus exclusively on facts most likely to appear in exams: definitions, specific numbers/dates, cause-effect relationships, and commonly tested distinctions.",
  }[mode] || "Cover key concepts thoroughly."

  const typeInstructions = cardTypes.map((t) => ({
    qa: "Q&A cards: a clear question on the front, a concise direct answer on the back.",
    definition: "Definition cards: the term on the front, full definition on the back.",
    cloze: `Cloze/fill-in-blank cards: set question to "Cloze Card", leave answer empty, and write the cloze_text using {{c1::answer}} syntax (e.g. "The {{c1::mitochondria}} is the powerhouse of the cell").`,
  })[t]).join(" ")

  return `You are an expert educational flashcard creator. ${modeInstructions} Card type instructions: ${typeInstructions} Always return valid JSON only, no markdown or code blocks.`
}

function buildUserPrompt(content: string, requestedCount: number, cardTypes: string[], subject: string, isImage: boolean): string {
  const typeList = cardTypes.join(", ")
  const imageNote = isImage ? "The content below is a base64 image. Describe the key concepts, labels, structures, and relationships visible in the image, then generate flashcards from them." : ""

  return `${imageNote}
Generate exactly ${requestedCount} high-quality flashcards from this content.
Mix these card types proportionally: ${typeList}.
Subject: ${subject || "General"}

Content:
${content}

Return ONLY a valid JSON object with this exact structure:
{
  "flashcards": [
    {
      "question": "string",
      "answer": "string",
      "cloze_text": "string or null",
      "card_type": "qa | definition | cloze",
      "difficulty": 3,
      "tags": ["tag1", "tag2"]
    }
  ]
}

Rules:
- Generate exactly ${requestedCount} cards, no more, no less.
- For cloze cards: set question to "Cloze Card", answer to "", and cloze_text to text with {{c1::blank}} syntax.
- For qa/definition cards: set cloze_text to null.
- difficulty is 1-5 (1=easiest, 5=hardest).
- tags should be 1-3 relevant topic tags.
- Questions must be clear and unambiguous.`
}

export async function POST(req: NextRequest) {
  try {
    // Authenticate BEFORE any model call. This previously happened after
    // generation, so unauthenticated requests still incurred AI cost.
    const authClient = await createClient()
    const {
      data: { user: authedUser },
    } = await authClient.auth.getUser()
    if (!authedUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    // Enforce AI quota (atomic: checks and consumes in one statement)
    const quotaDenied = await enforceQuota(authedUser.id, "flashcards")
    if (quotaDenied) return quotaDenied

    const {
      content,
      deckId,
      subject,
      cardCount = 10,
      mode = "full",
      cardTypes = ["qa", "definition", "cloze"],
      isImage = false,
    } = await req.json()

    if (!content || !deckId) {
      return NextResponse.json({ error: "Content and deck ID are required" }, { status: 400 })
    }

    const requestedCount = Math.max(1, Math.min(50, Number.parseInt(cardCount) || 10))

    if (!(await isAIConfigured())) {
      return NextResponse.json({ error: "AI provider API key not configured" }, { status: 500 })
    }

    let messages: any[]

    if (isImage && content.startsWith("data:image")) {
      // Vision: send image as multimodal message
      messages = [
        {
          role: "system",
          content: buildSystemPrompt(mode, cardTypes),
        },
        {
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: { url: content },
            },
            {
              type: "text",
              text: buildUserPrompt(
                "Analyze this image carefully — identify all labels, structures, diagrams, charts, equations, and key information visible.",
                requestedCount,
                cardTypes,
                subject,
                false,
              ),
            },
          ],
        },
      ]
    } else {
      const truncated = truncateContent(content, 8000)
      messages = [
        { role: "system", content: buildSystemPrompt(mode, cardTypes) },
        { role: "user", content: buildUserPrompt(truncated, requestedCount, cardTypes, subject, false) },
      ]
    }

    const response = await aiChatCompletion(
      {
        messages,
        temperature: 0.6,
        max_tokens: 6000,
      },
      { needsVision: isImage, task: "flashcards", agent: "study_ai" },
    )

    if (!response.ok) {
      const errorText = await response.text()
      console.error("AI provider error:", errorText)
      return NextResponse.json({ error: "AI provider error", details: errorText }, { status: response.status })
    }

    const data = await response.json()
    const text = data.choices?.[0]?.message?.content

    if (!text) {
      return NextResponse.json({ error: "No response from AI" }, { status: 500 })
    }

    // Strip any accidental markdown code fences
    let jsonText = text.trim()
    jsonText = jsonText.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/i, "")

    let result: { flashcards: any[] }
    try {
      result = JSON.parse(jsonText)
    } catch {
      // Attempt to extract JSON object from response
      const match = jsonText.match(/\{[\s\S]*\}/)
      if (!match) return NextResponse.json({ error: "Invalid AI response format" }, { status: 500 })
      result = JSON.parse(match[0])
    }

    if (!result.flashcards || !Array.isArray(result.flashcards)) {
      return NextResponse.json({ error: "AI returned unexpected structure" }, { status: 500 })
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    // Learning Graph: generating cards is exposure, not assessment. Logged as
    // evidence of engagement; review outcomes carry the mastery signal.
    emitLearningEvent({
      userId: authedUser.id,
      eventType: "flashcard_review",
      source: "generate-flashcards",
      rawTopic: subject || null,
      subject: subject || null,
      outcome: "completed",
      payload: { deckId, cardCount: result.flashcards?.length ?? 0, mode },
    })

    const flashcardsToInsert = result.flashcards.map((card: any) => ({
      deck_id: deckId,
      question: card.question || "Question",
      answer: card.answer || "",
      cloze_text: card.cloze_text || null,
      difficulty: typeof card.difficulty === "number" ? card.difficulty : 3,
      tags: Array.isArray(card.tags) ? card.tags : [],
      priority: "medium",
    }))

    const { data: savedCards, error } = await supabase.from("flashcards").insert(flashcardsToInsert).select()

    if (error) {
      console.error("Error saving flashcards:", error)
      return NextResponse.json({ error: "Failed to save flashcards" }, { status: 500 })
    }

    // Track usage
    const currentMonth = new Date().toISOString().slice(0, 7)
    await supabase.rpc("increment_usage", {
      p_user_id: user.id,
      p_month: currentMonth,
      p_field: "ai_generations_used",
      p_amount: 1,
    })

    return NextResponse.json({ flashcards: savedCards, count: savedCards.length })
  } catch (error) {
    console.error("Error generating flashcards:", error)
    return NextResponse.json(
      { error: "Failed to generate flashcards", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    )
  }
}

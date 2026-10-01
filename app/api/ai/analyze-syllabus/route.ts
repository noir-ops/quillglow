import { type NextRequest, NextResponse } from "next/server"
import { aiChatCompletion, isAIConfigured } from "@/lib/ai/provider"

export async function POST(req: NextRequest) {
  try {
    const { syllabusText } = await req.json()

    if (!syllabusText) {
      return NextResponse.json({ error: "Syllabus text is required" }, { status: 400 })
    }

    if (!(await isAIConfigured())) {
      return NextResponse.json({ error: "AI provider API key not configured" }, { status: 500 })
    }

    const response = await aiChatCompletion({
      messages: [
        {
          role: "user",
          content: `Analyze this syllabus and extract actionable study tasks with deadlines. 
      
      Syllabus:
      ${syllabusText}
      
      Return ONLY a valid JSON object (no markdown, no code blocks) with this structure:
      {
        "tasks": [
          {
            "title": "string",
            "description": "string",
            "dueDate": "YYYY-MM-DD (optional)",
            "priority": "low" | "medium" | "high",
            "subject": "string"
          }
        ]
      }
      
      Extract 3-5 key tasks that a student should focus on.`,
        },
      ],
      temperature: 0.7,
      top_p: 0.95,
      max_tokens: 8192,
    }, { task: "summarization", agent: "study_ai" })

    if (!response.ok) {
      const errorText = await response.text()
      console.error("[v0] AI provider error:", errorText)
      return NextResponse.json({ error: "AI provider error", details: errorText }, { status: response.status })
    }

    const data = await response.json()
    const text = data.choices?.[0]?.message?.content

    if (!text) {
      return NextResponse.json({ error: "No text in AI response" }, { status: 500 })
    }

    // Remove markdown code blocks if present
    let jsonText = text.trim()
    if (jsonText.startsWith("```json")) {
      jsonText = jsonText.replace(/```json\n?/g, "").replace(/```\n?/g, "")
    } else if (jsonText.startsWith("```")) {
      jsonText = jsonText.replace(/```\n?/g, "")
    }

    const result = JSON.parse(jsonText)
    return NextResponse.json(result)
  } catch (error) {
    console.error("[v0] Error analyzing syllabus:", error)
    const errorMessage = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json({ error: "Failed to analyze syllabus", details: errorMessage }, { status: 500 })
  }
}

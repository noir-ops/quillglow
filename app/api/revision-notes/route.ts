import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { aiChatCompletion, isAIConfigured } from "@/lib/ai/provider"
import { enforceQuota, refundQuota } from "@/lib/services/quota"


export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }


    // Enforce AI quota (atomic: checks and consumes in one statement)

    const quotaDenied = await enforceQuota(user.id, "revision_notes")

    if (quotaDenied) return quotaDenied

    if (!(await isAIConfigured())) {
      return NextResponse.json({ error: "AI provider API key not configured" }, { status: 500 })
    }

    const { documentText, topic, format = "structured" } = await req.json()

    if (!documentText || !topic) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    // Generate revision notes using AI
    const prompt = `Create comprehensive revision notes about "${topic}" based on this material:

${documentText.slice(0, 8000)}

Generate revision notes in JSON format with this structure:
{
  "title": "Topic Title",
  "summary": "2-3 sentence overview of the topic",
  "sections": [
    {
      "heading": "Section Title",
      "content": "Main content for this section",
      "keyPoints": ["Key point 1", "Key point 2"],
      "tips": "Study tip or mnemonic for this section"
    }
  ],
  "highlights": ["Most important fact 1", "Most important fact 2", "Most important fact 3"],
  "definitions": [
    {"term": "Term 1", "definition": "Definition 1"}
  ],
  "examTips": ["Exam tip 1", "Exam tip 2"],
  "quickReview": ["Quick review point 1", "Quick review point 2", "Quick review point 3"]
}

Requirements:
- Create 4-6 sections covering main topics
- Each section should have 2-4 key points
- Include 5-8 highlights (most important facts)
- Include relevant definitions (3-6 terms)
- Include 3-5 exam tips
- Include 5-7 quick review points
- Keep content concise but comprehensive
- Focus on exam-relevant information

Return ONLY valid JSON, no markdown code blocks.`

    const response = await aiChatCompletion({
      messages: [
        { role: "system", content: "You are a study notes generator. Return ONLY valid JSON, no markdown." },
        { role: "user", content: prompt }
      ],
      temperature: 0.6,
      max_tokens: 4000,
    }, { task: "revision_notes", agent: "study_ai" })

    if (!response.ok) {
      const errorText = await response.text()
      console.error("AI provider error:", errorText)
      return NextResponse.json({ error: "Failed to generate revision notes" }, { status: 500 })
    }

    const data = await response.json()
    const rawContent = data.choices?.[0]?.message?.content?.trim()

    if (!rawContent) {
      return NextResponse.json({ error: "No content generated" }, { status: 500 })
    }

    // Parse JSON with robust handling
    let notesData
    try {
      let jsonStr = rawContent
      const jsonMatch = rawContent.match(/```(?:json)?\n?([\s\S]*?)\n?```/)
      if (jsonMatch) {
        jsonStr = jsonMatch[1]
      }
      jsonStr = jsonStr.trim()
      const startIdx = jsonStr.indexOf('{')
      if (startIdx > 0) {
        jsonStr = jsonStr.slice(startIdx)
      }
      notesData = JSON.parse(jsonStr)
    } catch {
      console.error("Failed to parse revision notes JSON")
      return NextResponse.json({ error: "Failed to parse revision notes" }, { status: 500 })
    }

    // Save to database - actual columns: ai_notes, highlights, original_content, mode, source_type
    const { data: savedNotes, error: dbError } = await supabase
      .from("revision_notes")
      .insert({
        user_id: user.id,
        title: notesData.title || topic,
        subject: topic,
        ai_notes: notesData,
        highlights: notesData.highlights || [],
        original_content: documentText.slice(0, 15000),
        source_type: "document",
        mode: format,
      })
      .select()
      .single()

    if (dbError) {
      console.error("Error saving revision notes:", dbError)
      return NextResponse.json({ error: "Failed to save revision notes" }, { status: 500 })
    }

    return NextResponse.json({
      id: savedNotes.id,
      title: savedNotes.title,
      ai_notes: notesData,
    })
  } catch (error) {
    console.error("Revision notes error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const id = searchParams.get("id")

    if (id) {
      // Fetch single revision note
      const { data, error } = await supabase
        .from("revision_notes")
        .select("*")
        .eq("id", id)
        .eq("user_id", user.id)
        .single()

      if (error || !data) {
        return NextResponse.json({ error: "Revision notes not found" }, { status: 404 })
      }

      return NextResponse.json(data)
    }

    // Fetch all revision notes - actual columns: ai_notes, highlights, mode, source_type
    const { data, error } = await supabase
      .from("revision_notes")
      .select("id, title, subject, mode, source_type, created_at, updated_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })

    if (error) {
      return NextResponse.json({ error: "Failed to fetch revision notes" }, { status: 500 })
    }

    return NextResponse.json(data || [])
  } catch (error) {
    console.error("GET revision notes error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const id = searchParams.get("id")

    if (!id) {
      return NextResponse.json({ error: "Missing id" }, { status: 400 })
    }

    const { error } = await supabase
      .from("revision_notes")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id)

    if (error) {
      return NextResponse.json({ error: "Failed to delete revision notes" }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("DELETE revision notes error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

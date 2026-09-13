import { createServerClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { aiChatCompletion, isAIConfigured } from "@/lib/ai/provider"
import { enforceQuota, refundQuota } from "@/lib/services/quota"

// GET - fetch list of audio overviews or single by id
export async function GET(request: Request) {
  try {
    const supabase = await createServerClient()
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get("id")

    if (id) {
      const { data, error } = await supabase
        .from("audio_overviews")
        .select("*")
        .eq("id", id)
        .eq("user_id", user.id)
        .single()
      
      if (error) {
        return NextResponse.json({ error: "Not found" }, { status: 404 })
      }
      
      // Parse script JSON back into script_text + sections
      let scriptText = ""
      let sections: unknown[] = []
      try {
        const parsed = JSON.parse(data.script || "{}")
        scriptText = parsed.text || ""
        sections = parsed.sections || []
      } catch {
        scriptText = data.script || ""
      }
      
      return NextResponse.json({ ...data, script_text: scriptText, sections })
    }

    // List all overviews
    const { data, error } = await supabase
      .from("audio_overviews")
      .select("id, title, subject, duration_mode, created_at, source_type")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    
    return NextResponse.json(data || [])
  } catch (err) {
    console.error("[v0] Audio overview GET error:", err)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}

// POST - generate a new audio overview script via the active AI provider
export async function POST(request: Request) {
  try {
    const supabase = await createServerClient()
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    
    // Enforce AI quota (atomic: checks and consumes in one statement)
    
    const quotaDenied = await enforceQuota(user.id, "audio_overview")
    
    if (quotaDenied) return quotaDenied

    const body = await request.json()
    const { documentText, title, subject, style = "conversational", length = "medium" } = body

    if (!documentText || documentText.trim().length < 50) {
      return NextResponse.json({ error: "Please provide at least 50 characters of content." }, { status: 400 })
    }

    if (!(await isAIConfigured())) {
      return NextResponse.json({ error: "AI provider API key not configured" }, { status: 500 })
    }

    const wordTargets: Record<string, number> = { short: 400, medium: 800, long: 1400 }
    const wordTarget = wordTargets[length] || 800

    const styleGuide: Record<string, string> = {
      conversational: "Write as if speaking naturally to a student — friendly, clear, use 'you' and 'we', add occasional relatable analogies.",
      lecture: "Write in a clear academic lecture style — authoritative, structured, methodical, covering points thoroughly.",
      podcast: "Write as an engaging podcast host — energetic, storytelling-driven, use vivid examples and transitions like 'Now here's where it gets interesting...'",
    }

    const prompt = `You are creating a spoken audio overview script for a student to listen to while studying.

Study Content:
${documentText.slice(0, 12000)}

Style: ${styleGuide[style] || styleGuide.conversational}
Target length: approximately ${wordTarget} words.

Requirements:
- Start with a brief engaging introduction that previews what will be covered
- Organize into clearly spoken sections (no bullet points — write full flowing sentences meant to be heard)
- Emphasize key terms naturally (e.g. "the important concept here is...")
- Include memorable examples or analogies where helpful
- End with a concise summary of the 3-5 most important takeaways
- Write ONLY the spoken script — no stage directions, no [PAUSE], no speaker names
- Return the script as plain text paragraphs separated by blank lines`

    const response = await aiChatCompletion({
      messages: [
        { role: "system", content: "You are an expert educational content writer who creates clear, engaging audio scripts for students. Return only the spoken script text, no formatting symbols." },
        { role: "user", content: prompt },
      ],
      temperature: 0.65,
      max_tokens: wordTarget * 2,
    }, { task: "summarization", agent: "study_ai" })

    if (!response.ok) {
      const err = await response.text()
      console.error("[v0] AI provider error:", err)
      return NextResponse.json({ error: "Failed to generate audio script" }, { status: 500 })
    }

    const aiData = await response.json()
    const script = aiData.choices?.[0]?.message?.content?.trim()
    
    if (!script) {
      return NextResponse.json({ error: "Empty script returned" }, { status: 500 })
    }

    // Split script into sections (paragraphs)
    const paragraphs = script.split(/\n{2,}/).filter((p: string) => p.trim().length > 0)
    const sections = paragraphs.map((p: string, i: number) => ({
      index: i,
      text: p.trim(),
      startWord: paragraphs.slice(0, i).join(" ").split(/\s+/).length,
    }))

    // Save to database
    const { data: saved, error: dbError } = await supabase
      .from("audio_overviews")
      .insert({
        user_id: user.id,
        title: title || subject || "Audio Overview",
        subject: subject || title || "Study Material",
        script: JSON.stringify({ text: script, sections }),
        original_content: documentText.slice(0, 10000),
        source_type: "text",
        voice_style: style,
        study_mode: style,
        duration_mode: length,
      })
      .select()
      .single()

    if (dbError) {
      console.error("[v0] DB error saving audio overview:", dbError)
      return NextResponse.json({ error: "Failed to save audio overview" }, { status: 500 })
    }

    const wordCount = script.split(/\s+/).length

    return NextResponse.json({
      id: saved.id,
      title: saved.title,
      script_text: script,
      sections,
      duration_mode: length,
      word_count: wordCount,
      style,
    })
  } catch (err) {
    console.error("[v0] Audio overview POST error:", err)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}

// DELETE
export async function DELETE(request: Request) {
  try {
    const supabase = await createServerClient()
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get("id")
    
    if (!id) {
      return NextResponse.json({ error: "Missing id" }, { status: 400 })
    }

    const { error } = await supabase
      .from("audio_overviews")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("[v0] Audio overview DELETE error:", err)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}

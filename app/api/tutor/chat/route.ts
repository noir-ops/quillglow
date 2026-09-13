import { createServerClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { aiChatCompletion, isAIConfigured } from "@/lib/ai/provider"
import { enforceQuota, refundQuota } from "@/lib/services/quota"
import { emitLearningEvent } from "@/lib/services/learning-graph"
import { runSprout } from "@/lib/ai/orchestrator"


interface TutorProfile {
  learning_style: string
  difficulty: string
  goal: string
  subjects: string[]
  ask_followups: boolean
  keep_short: boolean
}

interface TutorMemory {
  subject: string
  topic: string
  confidence_level: string
}

interface StudySource {
  id: string
  type: "pdf" | "image" | "text" | "note"
  name: string
  content: string
}

function buildSystemPrompt(
  profile: TutorProfile, 
  memory: TutorMemory[], 
  studyMode: boolean,
  sources: StudySource[]
): string {
  const styleInstructions: Record<string, string> = {
    simple_short: "Keep explanations brief and to the point. Use simple language. Avoid lengthy paragraphs.",
    step_by_step:
      "Break down explanations into clear, numbered steps. Guide the student through each part methodically.",
    examples_first:
      "Always start with a concrete example before explaining the theory. Use relatable real-world examples.",
    conceptual: "Focus on deep understanding of underlying concepts and theory. Explain the 'why' behind everything.",
  }

  const difficultyInstructions: Record<string, string> = {
    gentle: "Use beginner-friendly language. Assume minimal prior knowledge. Be encouraging and patient.",
    standard: "Balance depth with accessibility. Assume basic familiarity with the subject.",
    challenging:
      "Provide exam-level depth. Include edge cases and advanced considerations. Push the student to think critically.",
  }

  const goalInstructions: Record<string, string> = {
    understand: "Focus on building genuine comprehension. Check understanding frequently.",
    practice: "Include practice questions and exercises. Focus on application of concepts.",
    exam_prep: "Align explanations with exam formats. Include exam tips and common question patterns.",
    revision: "Provide concise summaries. Focus on key points and quick recall techniques.",
  }

  // Build weak areas context
  let memoryContext = ""
  const weakAreas = memory.filter((m) => m.confidence_level === "low")
  const strongAreas = memory.filter((m) => m.confidence_level === "high")

  if (weakAreas.length > 0) {
    memoryContext += `\n\nThe student struggles with these topics (explain more carefully): ${weakAreas.map((m) => `${m.topic} (${m.subject})`).join(", ")}`
  }
  if (strongAreas.length > 0) {
    memoryContext += `\n\nThe student is confident in: ${strongAreas.map((m) => `${m.topic} (${m.subject})`).join(", ")}. Don't over-explain basics they already know.`
  }

  // Build study materials context
  let studyMaterialsContext = ""
  if (studyMode && sources.length > 0) {
    studyMaterialsContext = `\n\n=== STUDY MODE ACTIVE ===
The student has provided the following study materials. You MUST answer questions based ONLY on these materials.
If the answer is not in the materials, say "I don't see information about that in your study materials."
Always cite which source you're referencing when answering.

AVAILABLE STUDY SOURCES:
${sources.map((s, idx) => {
  if (s.type === "image") {
    return `[Source ${idx + 1}: ${s.name} (Image/Diagram)]
Description: This is an image that may contain diagrams, charts, equations, or visual content. Analyze it carefully and explain any:
- Diagrams or flowcharts
- Charts or graphs
- Labeled structures
- Equations or formulas
- Text content visible in the image`
  }
  return `[Source ${idx + 1}: ${s.name} (${s.type.toUpperCase()})]
Content:
${s.content.slice(0, 6000)}
${s.content.length > 6000 ? "...(content truncated)" : ""}`
}).join("\n\n---\n\n")}

=== END OF STUDY MATERIALS ===

IMPORTANT RULES FOR STUDY MODE:
1. ONLY answer based on the provided materials above
2. Cite which source you're using: "According to [Source Name]..."
3. If asked about something not in the materials, clearly state it's not covered
4. When explaining diagrams/images, be detailed and student-friendly
5. For equations, explain each variable and step
6. Offer to "teach step by step" or "quiz from this" when appropriate`
  }

  return `You are a personalized AI tutor for QuillGlow, an educational platform. Your role is to help students learn effectively based on their individual preferences.

STUDENT PROFILE:
- Learning Style: ${profile.learning_style} - ${styleInstructions[profile.learning_style] || styleInstructions.step_by_step}
- Difficulty Level: ${profile.difficulty} - ${difficultyInstructions[profile.difficulty] || difficultyInstructions.standard}
- Learning Goal: ${profile.goal} - ${goalInstructions[profile.goal] || goalInstructions.understand}
- Subjects: ${profile.subjects?.length > 0 ? profile.subjects.join(", ") : "General"}
${profile.keep_short ? "- IMPORTANT: Keep all responses concise and short." : ""}
${profile.ask_followups ? "- Ask follow-up questions when useful to check understanding or guide learning." : "- Avoid asking follow-up questions unless necessary."}
${memoryContext}
${studyMaterialsContext}

BEHAVIOR RULES:
1. Adapt your teaching style to match the student's preferences above
2. Be supportive, calm, and non-judgmental
3. Focus on learning efficiency - no unnecessary fluff
4. If explaining a concept, use the student's preferred style
5. Never reproduce copyrighted exam questions - generate original questions
6. If asked to generate quiz questions, align them with the student's difficulty level
7. Track what topics the student asks about - these inform future responses
${studyMode ? `
8. STUDY MODE: Only use provided materials for answers
9. Always indicate which source you're referencing
10. If asked to simplify, explain like revising fast, turn into notes, or generate flashcards - do so based on the materials` : ""}

Remember: This tutor should feel personal and adapted to how this specific student learns best.`
}

export async function POST(request: Request) {
  try {
    if (!(await isAIConfigured())) {
      return NextResponse.json({ error: "AI provider API key not configured" }, { status: 500 })
    }

    const supabase = await createServerClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }


    // Enforce AI quota (atomic: checks and consumes in one statement)

    const quotaDenied = await enforceQuota(user.id, "tutor_chat")

    if (quotaDenied) return quotaDenied

    const body = await request.json()
    const { message, sessionId, subject, studyMode = false, studySources = [] } = body

    if (!message) {
      return NextResponse.json({ error: "Message is required" }, { status: 400 })
    }

    // Fetch tutor profile
    const { data: profile } = await supabase.from("tutor_profiles").select("*").eq("user_id", user.id).maybeSingle()

    // Use defaults if no profile
    const tutorProfile: TutorProfile = profile || {
      learning_style: "step_by_step",
      difficulty: "standard",
      goal: "understand",
      subjects: [],
      ask_followups: true,
      keep_short: false,
    }

    // Fetch tutor memory
    const { data: memoryData } = await supabase
      .from("tutor_memory")
      .select("subject, topic, confidence_level")
      .eq("user_id", user.id)
      .order("last_seen", { ascending: false })
      .limit(20)

    const memory: TutorMemory[] = memoryData || []

    // Fetch or create session
    let session: { id: string; messages: Array<{ role: string; content: string }> } | null = null

    if (sessionId) {
      const { data: existingSession } = await supabase
        .from("tutor_sessions")
        .select("*")
        .eq("id", sessionId)
        .eq("user_id", user.id)
        .maybeSingle()

      if (existingSession) {
        session = {
          id: existingSession.id,
          messages: existingSession.messages || [],
        }
      }
    }

    if (!session) {
      const { data: newSession, error: sessionError } = await supabase
        .from("tutor_sessions")
        .insert({
          user_id: user.id,
          context_type: studyMode ? "study" : "chat",
          subject: subject || null,
          messages: [],
        })
        .select()
        .single()

      if (sessionError) {
        console.error("Error creating session:", sessionError)
        return NextResponse.json({ error: "Failed to create session" }, { status: 500 })
      }

      session = {
        id: newSession.id,
        messages: [],
      }
    }

    // Build conversation history (limit to last 10 messages for context)
    const recentMessages = session.messages.slice(-10)
    const conversationHistory = recentMessages.map((msg: { role: string; content: string }) => ({
      role: msg.role,
      content: msg.content,
    }))

    // Build system prompt with study sources if in study mode
    const systemPrompt = buildSystemPrompt(tutorProfile, memory, studyMode, studySources as StudySource[])

    // Build messages array for API call
    const apiMessages: Array<{ role: string; content: string | Array<{ type: string; text?: string; image_url?: { url: string } }> }> = [
      { role: "system", content: systemPrompt },
      ...conversationHistory,
    ]

    // Handle images in the user message if in study mode with image sources
    const imageSources = (studySources as StudySource[]).filter((s) => s.type === "image")
    if (studyMode && imageSources.length > 0) {
      // Use vision model for image analysis
      const userContent: Array<{ type: string; text?: string; image_url?: { url: string } }> = [
        { type: "text", text: message },
      ]
      
      // Add images to the message
      for (const imgSource of imageSources) {
        if (imgSource.content.startsWith("data:")) {
          userContent.push({
            type: "image_url",
            image_url: { url: imgSource.content },
          })
        }
      }
      
      apiMessages.push({ role: "user", content: userContent })
    } else {
      apiMessages.push({ role: "user", content: message })
    }

    // Call the active AI provider (use vision model if images are present)
    const hasImages = studyMode && imageSources.length > 0
    emitLearningEvent({
      userId: user.id,
      eventType: "tutor_exchange",
      source: "tutor",
      rawTopic: typeof message === "string" ? message.slice(0, 120) : null,
      outcome: "completed",
      payload: { studyMode: Boolean(studyMode) },
    })

    // ── Sprout AI path (opt-in) ─────────────────────────────────────────────
    // Routes through the orchestrator: Socratic enforcement, RAG grounding, and
    // queued Assessor/Curriculum runs. Returns the SAME response shape as the
    // legacy path, so the existing UI keeps working untouched. Enable per
    // request with `useSprout: true`, or globally with SPROUT_TUTOR=true.
    const useSprout = body?.useSprout === true || process.env.SPROUT_TUTOR === "true"

    if (useSprout) {
      const sprout = await runSprout({
        userId: user.id,
        message,
        history: (session.messages ?? [])
          .slice(-10)
          .map((m: any) => ({ role: m.role === "assistant" ? "assistant" : "user", content: m.content })),
        subject: session.subject ?? null,
        syllabus: session.syllabus ?? null,
        studentName: null,
        useRag: true,
      })

      const sproutMessages = [
        ...session.messages,
        { role: "user", content: message, timestamp: new Date().toISOString() },
        {
          role: "assistant",
          content: sprout.reply,
          timestamp: new Date().toISOString(),
          sources: sprout.sources.map((x) => String(x.id)),
        },
      ]

      await supabase
        .from("tutor_sessions")
        .update({ messages: sproutMessages, updated_at: new Date().toISOString() })
        .eq("id", session.id)

      // Key name must match the legacy path exactly (`citedSources`), or the
      // existing tutor UI silently loses its source list.
      return NextResponse.json({
        message: sprout.reply,
        sessionId: session.id,
        citedSources: sprout.sources.map((x) => String(x.id)),
      })
    }

    const response = await aiChatCompletion(
      {
        messages: apiMessages,
        max_tokens: 2048,
        temperature: 0.7,
      },
      { needsVision: hasImages, task: "tutoring", agent: "study_ai" },
    )

    if (!response.ok) {
      const errorText = await response.text()
      console.error("AI provider error:", errorText)
      return NextResponse.json({ error: "Failed to get response from AI" }, { status: 500 })
    }

    const data = await response.json()
    const assistantMessage =
      data.choices?.[0]?.message?.content || "I apologize, but I couldn't generate a response. Please try again."

    // Extract cited sources from the response
    const citedSources: string[] = []
    if (studyMode && studySources.length > 0) {
      for (const source of studySources as StudySource[]) {
        // Check if the response mentions this source
        if (
          assistantMessage.toLowerCase().includes(source.name.toLowerCase()) ||
          assistantMessage.includes(`Source ${(studySources as StudySource[]).indexOf(source) + 1}`)
        ) {
          citedSources.push(source.id)
        }
      }
    }

    // Update session with new messages
    const updatedMessages = [
      ...session.messages,
      { role: "user", content: message, timestamp: new Date().toISOString() },
      { 
        role: "assistant", 
        content: assistantMessage, 
        timestamp: new Date().toISOString(),
        sources: citedSources,
      },
    ]

    await supabase
      .from("tutor_sessions")
      .update({
        messages: updatedMessages,
        updated_at: new Date().toISOString(),
      })
      .eq("id", session.id)

    // Try to extract topic from the conversation for memory tracking
    if (subject) {
      const topicKeywords = message
        .toLowerCase()
        .split(" ")
        .filter((w: string) => w.length > 4)
        .slice(0, 3)
      if (topicKeywords.length > 0) {
        const topic = topicKeywords.join(" ")

        // Upsert topic memory
        await supabase.from("tutor_memory").upsert(
          {
            user_id: user.id,
            subject: subject,
            topic: topic,
            confidence_level: "medium",
            last_seen: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          {
            onConflict: "user_id,subject,topic",
          },
        )
      }
    }

    return NextResponse.json({
      message: assistantMessage,
      sessionId: session.id,
      citedSources,
    })
  } catch (error) {
    console.error("Tutor chat error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

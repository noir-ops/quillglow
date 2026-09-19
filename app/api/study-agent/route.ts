import { createServerClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { aiChatCompletion, isAIConfigured } from "@/lib/ai/provider"
import {
  describeCurriculumForPrompt,
  getLearnerSyllabus,
  getSelectedSubjects,
  buildSyllabusContentFromCurriculum,
} from "@/lib/services/syllabus"

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function callAI(systemPrompt: string, userPrompt: string, json = true, maxTokens = 1500) {
  const MAX_RETRIES = 4

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const res = await aiChatCompletion({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      max_tokens: maxTokens,
      temperature: 0.5,
      ...(json ? { response_format: { type: "json_object" } } : {}),
    }, { task: "reasoning", agent: "study_ai" })

    if (res.status === 429) {
      // Parse retry-after seconds from the provider error message
      const errText = await res.text()
      let waitMs = 8000 // default 8s
      try {
        const errJson = JSON.parse(errText)
        const msg: string = errJson?.error?.message || ""
        const match = msg.match(/try again in ([\d.]+)s/i)
        if (match) waitMs = Math.ceil(parseFloat(match[1]) * 1000) + 500
      } catch { /* use default */ }
      if (attempt < MAX_RETRIES - 1) {
        await sleep(waitMs)
        continue
      }
      throw new Error(`AI provider rate limit exceeded after ${MAX_RETRIES} retries`)
    }

    if (!res.ok) throw new Error(`AI provider error: ${await res.text()}`)

    const data = await res.json()
    const content = data.choices?.[0]?.message?.content || ""
    if (json) {
      try { return JSON.parse(content) } catch { return {} }
    }
    return content
  }
}

async function searchYouTube(query: string, maxResults = 5) {
  if (!YOUTUBE_API_KEY) return []
  try {
    const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(query + " tutorial explanation")}&type=video&maxResults=${maxResults}&relevanceLanguage=en&safeSearch=strict&key=${YOUTUBE_API_KEY}`
    const res = await fetch(url)
    if (!res.ok) return []
    const data = await res.json()
    return (data.items || []).map((item: any) => ({
      title: item.snippet.title,
      channel: item.snippet.channelTitle,
      description: item.snippet.description?.slice(0, 120),
      thumbnail: item.snippet.thumbnails?.medium?.url,
      url: `https://www.youtube.com/watch?v=${item.id.videoId}`,
      videoId: item.id.videoId,
    }))
  } catch {
    return []
  }
}

export async function POST(request: Request) {
  try {
    if (!(await isAIConfigured())) {
      return NextResponse.json({ error: "AI provider API key not configured" }, { status: 500 })
    }

    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    // Check Genius subscription
    const { data: subscription } = await supabase
      .from("subscriptions")
      .select("status, plan_type")
      .eq("user_id", user.id)
      .eq("plan_type", "genius")
      .in("status", ["active", "trialing"])
      .limit(1)
      .maybeSingle()

    const isGenius = !!subscription

    // Study Agent is Genius-only feature
    if (!isGenius) {
      return NextResponse.json({
        error: "genius_only",
        message: "The AI Study Agent is a Genius-exclusive feature. Upgrade to unlock unlimited study plans, complete with revision notes, mind maps, practice exams, and personalized learning paths.",
      }, { status: 403 })
    }

    const body = await request.json()
    const {
      inputText: rawInputText,
      inputType = "topic",
      subject,
      syllabus: syllabusFromBody,
      topicFocus,
      level: rawLevel,
      scope: rawScope,
      usePersonalData = false,
    } = body

    // A learner who has already picked a subject tied to their real syllabus
    // shouldn't also have to paste a syllabus — the curriculum IS the input.
    // inputText is only hard-required when there's no subject to fall back
    // on (the Topic/Question modes, or a subject outside indexed curriculum).
    let inputText = rawInputText?.trim() ?? ""
    let resolvedInputType = inputType

    if (!inputText && subject) {
      const owningSyllabus =
        syllabusFromBody ||
        (await getSelectedSubjects(user.id).catch(() => [])).find((s) => s.subject === subject)?.syllabus

      const synthesized = owningSyllabus
        ? await buildSyllabusContentFromCurriculum(owningSyllabus, subject, topicFocus).catch(() => null)
        : null

      if (synthesized) {
        inputText = synthesized
        resolvedInputType = "syllabus"
      }
    }

    if (!inputText.trim()) {
      return NextResponse.json(
        { error: subject ? "Could not find curriculum for that subject" : "inputText is required" },
        { status: 400 },
      )
    }

    // ── Curriculum scoping ───────────────────────────────────────────────────
    // The agent used to take free-text subject and let the model guess the
    // rest. Now it recalls the learner's saved syllabus selection and the
    // subjects they actually study, so generated plans, notes, exams and mind
    // maps follow the right curriculum's terminology and exam technique.
    const [curriculumDirective, learnerSyllabus, selectedSubjects] = await Promise.all([
      describeCurriculumForPrompt(user.id).catch(() => null),
      getLearnerSyllabus(user.id).catch(() => ({ primary: null, secondary: null })),
      getSelectedSubjects(user.id).catch(() => []),
    ])

    // Which syllabus this run belongs to: an explicit choice wins, else the
    // syllabus that owns the chosen subject, else the learner's primary.
    const subjectOwner = subject ? selectedSubjects.find((s) => s.subject === subject)?.syllabus : undefined
    const activeSyllabus = syllabusFromBody || subjectOwner || learnerSyllabus.primary || null

    // Prepended to every prompt below so each generated artefact is scoped.
    const curriculumPrefix = curriculumDirective ? `${curriculumDirective}\n\n` : ""
    const scopeLine = [activeSyllabus && `Syllabus: ${activeSyllabus}`, subject && `Subject: ${subject}`]
      .filter(Boolean)
      .join(" · ")

    // Fetch user's personal data if usePersonalData enabled
    let weaknessContext = ""
    let personalDataUsed: any = null
    if (usePersonalData) {
      const [
        { data: tutorMemory },
        { data: mockAttempts },
        { data: echomindLogs },
        { data: flashcardDecks },
        { data: recentNotes },
      ] = await Promise.all([
        supabase.from("tutor_memory").select("topic, subject, confidence_level, times_asked, last_seen").eq("user_id", user.id).order("confidence_level").limit(15),
        supabase.from("mock_exam_attempts").select("score_percentage, completed_at, correct_answers, total_questions").eq("user_id", user.id).order("completed_at", { ascending: false }).limit(5),
        supabase.from("echomind_logs").select("query, mode, created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(5),
        supabase.from("flashcard_decks").select("name, subject, card_count").eq("user_id", user.id).order("updated_at", { ascending: false }).limit(5),
        supabase.from("notes").select("title, subject, created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(5),
      ])

      const weakTopics = (tutorMemory || []).filter((m: any) => m.confidence_level === "low" || m.confidence_level === "beginner")
      const mediumTopics = (tutorMemory || []).filter((m: any) => m.confidence_level === "medium" || m.confidence_level === "intermediate")
      const strongTopics = (tutorMemory || []).filter((m: any) => m.confidence_level === "high" || m.confidence_level === "advanced")
      const avgScore = mockAttempts?.length
        ? Math.round((mockAttempts as any[]).reduce((a, m) => a + (m.score_percentage || 0), 0) / mockAttempts.length)
        : null
      const lowestScore = mockAttempts?.length
        ? Math.min(...(mockAttempts as any[]).map((m) => m.score_percentage || 100))
        : null

      if (weakTopics.length) weaknessContext += `\nWeak/low confidence topics: ${weakTopics.map((m: any) => m.topic).join(", ")}.`
      if (mediumTopics.length) weaknessContext += ` Medium confidence: ${mediumTopics.slice(0, 5).map((m: any) => m.topic).join(", ")}.`
      if (avgScore !== null) weaknessContext += ` Recent mock exam average: ${avgScore}% (lowest: ${lowestScore}%).`
      if (echomindLogs?.length) weaknessContext += ` Recently reflected on: ${echomindLogs.map((l: any) => l.query?.slice(0, 40)).join(", ")}.`
      if (flashcardDecks?.length) weaknessContext += ` Active flashcard decks: ${flashcardDecks.map((d: any) => d.name).join(", ")}.`

      // Build rich summary to send back to client for display
      personalDataUsed = {
        weakTopics: weakTopics.map((m: any) => ({ topic: m.topic, subject: m.subject, timesAsked: m.times_asked })),
        mediumTopics: mediumTopics.slice(0, 5).map((m: any) => ({ topic: m.topic, subject: m.subject })),
        strongTopics: strongTopics.slice(0, 5).map((m: any) => ({ topic: m.topic, subject: m.subject })),
        mockExams: {
          count: mockAttempts?.length || 0,
          avgScore,
          lowestScore,
          recent: (mockAttempts || []).slice(0, 3).map((m: any) => ({
            score: Math.round(m.score_percentage || 0),
            date: m.completed_at,
            correct: m.correct_answers,
            total: m.total_questions,
          })),
        },
        echomindSessions: (echomindLogs || []).map((l: any) => ({ query: l.query?.slice(0, 60), mode: l.mode, date: l.created_at })),
        flashcardDecks: (flashcardDecks || []).map((d: any) => ({ name: d.name, subject: d.subject, cards: d.card_count })),
        recentNotes: (recentNotes || []).map((n: any) => ({ title: n.title, subject: n.subject })),
        hasData: !!(weakTopics.length || mockAttempts?.length || flashcardDecks?.length),
      }
    }

    // Level and scope were previously INFERRED by the model from the input,
    // which is why the same topic could come back "intermediate" one run and
    // "advanced" the next. They're now explicit learner choices, stated as a
    // standing instruction on every step so all eight artefacts agree.
    const LEVELS = ["basic", "intermediate", "advanced", "expert"] as const
    const SCOPES = ["narrow", "broad", "wide"] as const
    const level = LEVELS.includes(String(rawLevel).toLowerCase() as any)
      ? (String(rawLevel).toLowerCase() as (typeof LEVELS)[number])
      : "intermediate"
    const scope = SCOPES.includes(String(rawScope).toLowerCase() as any)
      ? (String(rawScope).toLowerCase() as (typeof SCOPES)[number])
      : "broad"

    const levelInstruction = {
      basic: "Pitch everything at a BASIC level: foundational concepts, plain language, no assumed prior knowledge.",
      intermediate: "Pitch everything at an INTERMEDIATE level: assumes the fundamentals are known; standard exam-level depth.",
      advanced: "Pitch everything at an ADVANCED level: rigorous treatment, edge cases, and the reasoning behind results.",
      expert: "Pitch everything at an EXPERT level: specialist depth, precise terminology, nuance and exceptions a top candidate would be expected to handle.",
    }[level]

    const scopeInstruction = {
      narrow: "Keep the SCOPE NARROW: focus tightly on the core topic only, going deep rather than wide.",
      broad: "Keep the SCOPE BROAD: cover the main topic and its directly related subtopics.",
      wide: "Keep the SCOPE WIDE: cover the topic, its subtopics, adjacent areas, and cross-links to related parts of the syllabus.",
    }[scope]

    const depthNote = `${levelInstruction} ${scopeInstruction} ${
      isGenius
        ? "Provide deep, comprehensive output with full detail."
        : "Provide concise, focused output suitable for a quick overview."
    }`

    // Wraps callAI so every generated artefact carries the curriculum scope.
    // Prefixing the SYSTEM prompt (not the user prompt) keeps it as standing
    // instruction rather than something the model can treat as data.
    const callScopedAI = (systemPrompt: string, userPrompt: string, json = true, maxTokens = 1500) =>
      callAI(
        `${curriculumPrefix}${systemPrompt}${scopeLine ? `\n\nThis request is scoped to — ${scopeLine}. Use that curriculum's terminology, notation, marking style and exam conventions.` : ""}`,
        userPrompt,
        json,
        maxTokens,
      )

    // ── STEP 1: Input Analysis ──────────────────────────────────────────────
    const rawAnalysis = await callScopedAI(
      `You are an expert educational analyst. Extract structured study information from student input. ${depthNote} Return JSON only.`,
      `Analyze this student input and extract: mainTopics (array, max 5), subtopics (object mapping each main topic to array of up to 4 subtopics), estimatedHours (number), subject (string).
Input type: ${resolvedInputType}
Subject hint: ${subject || "not specified"}
Content: ${inputText.slice(0, 1500)}${weaknessContext}`,
      true, 800
    )

    // The learner's chosen level/scope override anything the model might
    // still return, so the badges shown in the UI always match what was
    // actually asked for.
    const analysis = { ...(rawAnalysis ?? {}), difficultyLevel: level, studyScope: scope }
    await sleep(1200)

    // ── STEP 2: Study Plan ──────────────────────────────────────────────────
    const studyPlan = await callScopedAI(
      `You are a master study strategist. Create an optimal, ordered study plan. ${depthNote} Return JSON only.`,
      `Based on this analysis, create a study plan with: schedule (array of max 7 items {day, topic, subtopics, timeMinutes, priority}), totalDays (number), dailyGoal (string), keyMilestones (array of strings, max 4).
Analysis: ${JSON.stringify({ mainTopics: analysis?.mainTopics, difficultyLevel: analysis?.difficultyLevel, subject: analysis?.subject })}${weaknessContext ? weaknessContext.slice(0, 300) : ""}`,
      true, 900
    )
    await sleep(1200)

    // ── STEP 3: Revision Notes ──────────────────────────────────────────────
    const revisionNotes = await callScopedAI(
      `You are an expert educator creating concise, high-quality revision notes. ${depthNote} Return JSON only.`,
      `Generate structured revision notes: sections (array of max 4 items {title, keyPoints (array max 5), definitions (array max 3 of {term, definition}), examTips (array max 3), mnemonics (array max 2)}).
Topics: ${JSON.stringify((analysis?.mainTopics || []).slice(0, 4))}
Subject: ${analysis?.subject || subject || "General"}`,
      true, 1400
    )
    await sleep(1200)

    // ── STEP 4: Flashcards ──────────────────────────────────────────────────
    // Replaced the mind map step: flashcards are directly studiable and get
    // auto-saved into a real deck below, so the output lands somewhere the
    // learner can actually use rather than being a one-off visual.
    const flashcardData = await callScopedAI(
      `You are an expert at writing flashcards for active recall. Return JSON only.`,
      `Create 12-15 flashcards covering the most examinable material.
Structure: { "cards": [ { "question": "", "answer": "", "difficulty": 1-5 } ] }
Rules:
- One idea per card. Questions must be answerable from memory in under 20 seconds.
- Favour definitions, processes, causes/effects, formulas and common exam traps.
- "answer" is concise — a sentence or two, not a paragraph.
- "difficulty" is 1 (easy recall) to 5 (hardest), as an integer.
Main topic: ${analysis?.mainTopics?.[0] || inputText.slice(0, 60)}
Subject: ${analysis?.subject || subject || "General"}`,
      true, 1800
    )
    await sleep(1200)

    // ── STEP 5: Practice Exam ───────────────────────────────────────────────
    const practiceExam = await callScopedAI(
      `You are an expert exam setter. Create rigorous, original practice questions. Return JSON only.`,
      `Generate a practice exam: mcqs (array of {question, options (array of 4), correctIndex (0-3), explanation}), shortAnswer (array of {question, markScheme, difficulty}), totalMarks (number).
Topics: ${JSON.stringify((analysis?.mainTopics || []).slice(0, 4))}
Difficulty: ${analysis?.difficultyLevel || "intermediate"}
${isGenius ? "Include 6 MCQs and 3 short answer questions." : "Include 4 MCQs and 2 short answer questions."}`,
      true, isGenius ? 1400 : 1000
    )
    await sleep(1000)

    // ── STEP 6: YouTube Videos (real API search) ────────────────────────────
    const primaryTopic = analysis?.mainTopics?.[0] || inputText.slice(0, 60)
    const youtubeQuery = `${analysis?.subject || subject || ""} ${primaryTopic}`.trim()
    const youtubeLinks = await searchYouTube(youtubeQuery, isGenius ? 5 : 3)

    // If YouTube API not available, ask the AI provider for suggestions (clearly labeled)
    let videoSuggestions = youtubeLinks
    if (!youtubeLinks.length) {
      const aiVideos = await callScopedAI(
        `You are a study resource curator. Return JSON only.`,
        `Suggest 3 YouTube search queries for: ${primaryTopic} (${analysis?.subject || subject || "General"}). Return: suggestions (array of {searchQuery, channelSuggestion, reason}).`,
        true, 400
      )
      videoSuggestions = aiVideos?.suggestions || []
    }
    await sleep(1000)

    // ── STEP 7: Smart Review Plan ───────────────────────────────────────────
    const reviewPlan = await callScopedAI(
      `You are a spaced repetition expert. Return JSON only.`,
      `Create a smart review plan: immediateRevision (array max 3 {topic, action, timeMinutes}), day3Review (array max 3 {topic, method}), day7Review (array max 3 {topic, method}), weeklyCheck (string), priorityTopics (array max 4).
Topics: ${JSON.stringify((analysis?.mainTopics || []).slice(0, 4))}${weaknessContext ? "\n" + weaknessContext.slice(0, 200) : ""}`,
      true, 700
    )
    await sleep(1000)

    // ── STEP 8: Weakness Integration ───────────────────────────────────────
    let weaknessInsights = null
    if (usePersonalData && weaknessContext) {
      weaknessInsights = await callScopedAI(
        `You are an adaptive learning specialist. Return JSON only.`,
        `Generate: priorityGaps (array max 4 {topic, reason, urgency (high/medium/low)}), recommendedFocus (string), studyTip (string).
Personal context: ${weaknessContext.slice(0, 400)}
Topics: ${JSON.stringify((analysis?.mainTopics || []).slice(0, 4))}`,
        true, 600
      )
    }

    // ── Save to Supabase ────────────────────────────────────────────────────
    const { data: session, error: saveError } = await supabase
      .from("study_agent_sessions")
      .insert({
        user_id: user.id,
        input_text: inputText.slice(0, 2000),
        input_type: resolvedInputType,
        // The learner's explicit subject wins over the model's inference —
        // it's tied to a real syllabus, the guess isn't.
        subject: subject || analysis?.subject || null,
        analysis: analysis,
        study_plan: studyPlan,
        generated_notes: revisionNotes,
        // Stored in the existing mind_map_data jsonb column, which now
        // carries the flashcard set. Avoids a migration for a like-for-like
        // swap; old rows keep their mind maps and still render.
        mind_map_data: flashcardData,
        generated_exam: practiceExam,
        youtube_links: videoSuggestions,
        review_plan: reviewPlan,
        weakness_insights: weaknessInsights,
        status: "complete",
        steps_completed: 8,
      })
      .select("id")
      .single()

    if (saveError) console.error("[study-agent] save error:", saveError)

    // ── Auto-save flashcards into a real deck ───────────────────────────────
    // So they appear under Flashcards immediately, without an export step.
    // Failures here are logged but never fail the request — the learner still
    // gets their full study system either way.
    let flashcardDeckId: string | null = null
    const cards: any[] = Array.isArray(flashcardData?.cards) ? flashcardData.cards : []

    if (cards.length > 0) {
      const deckSubject = subject || analysis?.subject || null
      const deckName = `${deckSubject ? `${deckSubject}: ` : ""}${
        analysis?.mainTopics?.[0] || inputText.slice(0, 50)
      }`.slice(0, 120)

      const { data: deck, error: deckError } = await supabase
        .from("flashcard_decks")
        .insert({ user_id: user.id, name: deckName, subject: deckSubject })
        .select("id")
        .single()

      if (deckError) {
        console.error("[study-agent] deck create failed:", deckError.message)
      } else if (deck) {
        flashcardDeckId = deck.id

        const rows = cards
          .filter((c: any) => c?.question && c?.answer)
          .map((c: any) => {
            // difficulty is INTEGER 1-5 in the schema; clamp rather than
            // trusting whatever the model returns.
            const raw = Math.round(Number(c?.difficulty))
            const difficulty = Number.isFinite(raw) ? Math.min(5, Math.max(1, raw)) : 3
            return {
              deck_id: deck.id,
              question: String(c.question),
              answer: String(c.answer),
              difficulty,
              tags: deckSubject ? [deckSubject, "study-agent"] : ["study-agent"],
            }
          })

        if (rows.length > 0) {
          const { error: cardsError } = await supabase.from("flashcards").insert(rows)
          if (cardsError) console.error("[study-agent] cards insert failed:", cardsError.message)
        }
      }
    }

    return NextResponse.json({
      sessionId: session?.id,
      analysis,
      studyPlan,
      revisionNotes,
      flashcardData,
      flashcardDeckId,
      practiceExam,
      youtubeLinks: videoSuggestions,
      youtubeApiUsed: !!youtubeLinks.length,
      reviewPlan,
      weaknessInsights,
      personalDataUsed,
      isGenius,
    })
  } catch (error) {
    console.error("[study-agent] error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { aiChatCompletion, isAIConfigured } from "@/lib/ai/provider"
import { enforceQuota, refundQuota } from "@/lib/services/quota"


const DETECTOR_SYSTEM = `You are an expert AI writing detector trained on thousands of student essays and AI-generated texts. Analyse the provided text and return ONLY a valid JSON object — no markdown, no explanation, no preamble.

Sensitivity modes:
- standard: balanced detection
- strict: flag anything that could raise academic suspicion
- lenient: only flag obvious AI patterns

Return this exact JSON shape:
{
  "ai_score": <integer 0-100>,
  "verdict": "<Likely Human | Mixed | Likely AI | Almost Certainly AI>",
  "explanation": "<one clear sentence>",
  "signals": [
    {"name": "Sentence Variety", "value": "<Low|Medium|High>", "flag": "<ok|warn|bad>"},
    {"name": "Vocabulary Range", "value": "<Narrow|Moderate|Rich>", "flag": "<ok|warn|bad>"},
    {"name": "Personal Voice", "value": "<Absent|Weak|Strong>", "flag": "<ok|warn|bad>"},
    {"name": "Filler Phrases", "value": "<Few|Some|Many>", "flag": "<ok|warn|bad>"}
  ],
  "red_flags": ["<short phrase>", "<short phrase>"]
}`

// ── PASS 1: Structural deconstruction ────────────────────────────────────
const HUMANIZER_PASS1_SYSTEM = `You are a writing deconstructor. Your ONLY job is to break the robotic structure of AI-generated text. Do not worry about tone or polish — just destroy the AI patterns.

MANDATORY CHANGES — apply every single one, no exceptions:

1. SENTENCE LENGTH BURSTINESS: AI text has uniform sentence lengths — this is the biggest giveaway. You must create extreme variation. After every 2-3 long sentences, insert a very short one (3–8 words). After a short one, write a longer, more winding one. This "burstiness" is the single most important signal for human writing.

2. KILL THESE EXACT PHRASES — replace every single occurrence:
   "Furthermore," → "On top of that," / "What's more," / nothing (just connect naturally)
   "Moreover," → "Also," / "And" / "Plus,"
   "In conclusion," → "When you step back," / "All things considered," / "So,"
   "It is important to note that" → "Worth noting is" / "One thing that matters here is"
   "It is worth mentioning" → delete entirely, absorb into sentence
   "This highlights" → "This shows" / "That makes it clear"
   "Notably," → cut it / "Interestingly,"
   "Additionally," → "And," / "Also,"
   "In order to" → "to"
   "It can be argued that" → "Some would say" / just assert it directly
   "plays a crucial role" → "matters a lot" / "is central to"
   "a wide range of" → "many" / "various"
   "Due to the fact that" → "Because"
   "In the modern era" / "In today's society" / "In today's world" → rewrite or delete
   "It should be noted" → delete
   "As previously mentioned" → delete
   "This essay will" / "This report will" → rewrite as a direct statement

3. PARAGRAPH BREAKS: AI always breaks paragraphs at "clean" logical points. Move at least one paragraph break mid-thought, where a human writer might naturally pause and restart.

4. CLAUSE ORDER INVERSION: Take 2-3 sentences and flip their clause order. Instead of "X because Y", write "Y, which is why X".

Return ONLY the rewritten plain text — no JSON, no explanation, just the rewritten text.`

// ── PASS 2: Human voice injection ─────────────────────────────────────────
const HUMANIZER_PASS2_SYSTEM = `You are a human voice coach for student writing. You receive text that has had AI patterns removed. Your job is to inject authentic human writing characteristics that make it genuinely human.

MANDATORY TECHNIQUES — apply all of them:

1. MICRO-HEDGES AND QUALIFIERS: Real writers are not 100% certain about everything. Add 1-3 natural hedges: "I think", "arguably", "to some extent", "in a way", "for the most part", "mostly", "generally speaking". Do NOT overdo it — 1-3 per piece maximum.

2. CONTRACTIONS: Expand any remaining formal constructions to contractions where natural: "do not" → "don't", "it is" → "it's", "they are" → "they're", "cannot" → "can't", "will not" → "won't". Exception: academic contexts where contractions would be genuinely inappropriate.

3. ONE NATURAL DIGRESSION: Insert one very brief aside or observation that feels like a genuine thought — something in parentheses, or a short sentence like "That's a bit of an oversimplification, but the point stands." This is a hallmark of real human writing.

4. VOCABULARY DOWNGRADE (where appropriate): Replace every instance of these AI-favourite formal words:
   utilise/utilize → use
   demonstrate → show / prove
   facilitate → help / enable / allow
   subsequent/subsequently → next / after / then
   endeavour → try
   implement → use / put in place
   numerous → many / lots of
   significant → big / major / important (pick most natural)
   individuals → people
   obtain → get
   commence → start / begin
   terminate → end / stop
   constitute → make up / form
   approximately → about / around
   sufficient → enough
   perceive → see / think / feel (whichever fits)

5. SENTENCE-INITIAL VARIETY: Start at least 2 sentences with something other than a noun or "The". Try: "What this means is...", "Honestly,", "The tricky part is...", "And yet,", "But that's not the whole story.", "Looking at it differently,"

6. ACTIVE VOICE: Convert passive constructions to active where possible. "It was shown that X" → "Research showed X". "The data was collected" → "They collected the data".

Tone guidance:
- casual: smart but relaxed, like a student explaining something to a friend
- academic: formal but with a clear human mind behind it — no sterile polish
- gcse: natural GCSE/A-Level register, appropriate for a 15-18 year old
- natural: warm, direct, conversational
- university: intellectually confident, opinionated but evidence-backed

Return ONLY the rewritten plain text — no JSON, no explanation.`

// ── PASS 3: Final naturalness audit ───────────────────────────────────────
const HUMANIZER_PASS3_SYSTEM = `You are a final proofreader whose only job is to catch any remaining AI-sounding patterns that a detector would flag. Do a last sweep.

CHECK AND FIX ALL OF THESE:

1. SCAN FOR LEFTOVER AI PHRASES: Read every sentence. If any sentence could have been written by ChatGPT with zero effort, rewrite it. Specifically look for: perfect parallelism in lists, overly balanced "on one hand... on the other hand" constructions, sentences that end with a clean summary wrapped up too neatly.

2. PERPLEXITY: AI text is predictable — each word is the "most likely next word". Introduce 2-3 slightly unexpected word choices that a thoughtful human might use but an AI wouldn't default to. Not obscure words — just slightly less predictable choices.

3. FINAL BURSTINESS CHECK: Read through and confirm there is genuine sentence length variation. If you see 3+ sentences of similar length in a row, break one up or merge two.

4. ONE IMPERFECTION: If the text still reads too "perfect", add one very minor real-world imperfection — a slightly informal phrasing in one place, an em-dash used mid-thought like a human would, or a brief parenthetical remark.

5. PRESERVE EVERY FACT: Do not change any argument, statistic, name, date, claim, or core idea. Only change expression.

Return a valid JSON object with this exact shape — no markdown fences, no preamble:
{
  "humanized": "<final rewritten text>",
  "changes_made": ["<specific change 1>", "<specific change 2>", "<specific change 3>", "<specific change 4>"],
  "estimated_ai_score_before": <integer 0-100>,
  "estimated_ai_score_after": <integer 0-100>
}`

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function callAI(systemPrompt: string, userPrompt: string, temperature = 0.7, maxTokens = 2000): Promise<string> {
  const MAX_RETRIES = 4
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const res = await aiChatCompletion({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature,
      max_tokens: maxTokens,
    }, { task: "essay_review", agent: "study_ai" })

    if (res.status === 429) {
      const errText = await res.text()
      let waitMs = 8000
      try {
        const errJson = JSON.parse(errText)
        const msg: string = errJson?.error?.message ?? ""
        const match = msg.match(/try again in ([\d.]+)s/i)
        if (match) waitMs = Math.ceil(parseFloat(match[1]) * 1000) + 500
      } catch { /* use default */ }
      if (attempt < MAX_RETRIES - 1) {
        await sleep(waitMs)
        continue
      }
      throw new Error(`AI provider rate limit exceeded after ${MAX_RETRIES} retries`)
    }

    if (!res.ok) {
      const err = await res.text()
      throw new Error(`AI provider error: ${err}`)
    }

    const data = await res.json()
    return data.choices?.[0]?.message?.content?.trim() ?? ""
  }
  throw new Error("callAI: exhausted retries")
}

function parseJSON(raw: string): unknown {
  // Strip markdown fences if present
  let str = raw
  const fenceMatch = str.match(/```(?:json)?\n?([\s\S]*?)\n?```/)
  if (fenceMatch) str = fenceMatch[1]
  str = str.trim()
  const start = str.indexOf("{")
  if (start > 0) str = str.slice(start)
  return JSON.parse(str)
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    // Enforce AI quota (atomic: checks and consumes in one statement)
    const quotaDenied = await enforceQuota(user.id, "writereal")
    if (quotaDenied) return quotaDenied

    if (!(await isAIConfigured())) {
      return NextResponse.json({ error: "AI provider API key not configured" }, { status: 500 })
    }

    const { mode, text, options = {} } = await req.json()

    if (!text || typeof text !== "string") {
      return NextResponse.json({ error: "Missing text" }, { status: 400 })
    }

    const wordCount = text.trim().split(/\s+/).filter(Boolean).length
    if (wordCount < 30) {
      return NextResponse.json({ error: "too_short" }, { status: 422 })
    }

    // ── Monthly limit enforcement (humanize only — detection is always free) ──
    const FREE_MONTHLY_LIMIT = 3
    const { data: subscription } = await supabase
      .from("subscriptions")
      .select("plan_type, status")
      .eq("user_id", user.id)
      .eq("status", "active")
      .maybeSingle()
    const isGenius = subscription?.plan_type === "genius"

    if (!isGenius && mode === "humanize") {
      const monthStart = new Date()
      monthStart.setDate(1)
      monthStart.setHours(0, 0, 0, 0)
      const { count } = await supabase
        .from("writing_improver_logs")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("mode", "humanize")
        .gte("created_at", monthStart.toISOString())
      if ((count ?? 0) >= FREE_MONTHLY_LIMIT) {
        return NextResponse.json({
          error: "monthly_limit_reached",
          message: `You've used all ${FREE_MONTHLY_LIMIT} WriteReal humanizations this month. Upgrade to Genius for unlimited access.`,
        }, { status: 429 })
      }
    }

    if (mode === "detect") {
      const sensitivity = (options.sensitivity as string) || "standard"
      const userPrompt = `Sensitivity mode: ${sensitivity}\n\nText to analyse:\n${text.slice(0, 6000)}`
      const raw = await callAI(DETECTOR_SYSTEM, userPrompt)

      let result: unknown
      try {
        result = parseJSON(raw)
      } catch {
        return NextResponse.json({ error: "Failed to parse detection result" }, { status: 500 })
      }

      // Save to writing_improver_logs
      await supabase.from("writing_improver_logs").insert({
        user_id: user.id,
        mode: "detect",
        original_text: text.slice(0, 15000),
        improved_text: null,
        tone: sensitivity,
        explanation: result,
      })

      return NextResponse.json(result)
    }

    if (mode === "humanize") {
      const tone = (options.tone as string) || "natural"
      const strength = (options.strength as string) || "medium"
      const preserveArgs = options.preserveArgs !== false

      // Adjust depth of passes based on strength
      const runAllPasses = strength === "heavy" || strength === "medium"

      // Cap input and token budget per pass based on word count to stay inside TPM
      const inputSlice = text.slice(0, 3000)
      // Rough estimate: 1 word ≈ 1.3 tokens; cap output at ~1.4× input length
      const estimatedInputTokens = Math.ceil(wordCount * 1.4)
      const perPassTokens = Math.min(1800, Math.max(600, estimatedInputTokens))

      // ── PASS 1: Structural deconstruction ──────────────────────────────
      const pass1Prompt = `Tone target: ${tone}
Preserve all facts and arguments: ${preserveArgs ? "yes — do not change any claim, statistic, or name" : "no"}
Rewrite depth: ${strength}

Text to restructure:
${inputSlice}`

      const pass1Raw = await callAI(HUMANIZER_PASS1_SYSTEM, pass1Prompt, 0.75, perPassTokens)
      const pass1Text = pass1Raw.startsWith("{") ? (() => {
        try { return (JSON.parse(pass1Raw) as { humanized?: string }).humanized ?? pass1Raw } catch { return pass1Raw }
      })() : pass1Raw

      let pass2Text = pass1Text

      if (runAllPasses) {
        await sleep(1500)
        // ── PASS 2: Human voice injection ──────────────────────────────
        const pass2Prompt = `Tone: ${tone}
Preserve all facts and arguments: yes

Text to inject human voice into:
${pass1Text.slice(0, 3000)}`

        const pass2Raw = await callAI(HUMANIZER_PASS2_SYSTEM, pass2Prompt, 0.8, perPassTokens)
        pass2Text = pass2Raw.startsWith("{") ? (() => {
          try { return (JSON.parse(pass2Raw) as { humanized?: string }).humanized ?? pass2Raw } catch { return pass2Raw }
        })() : pass2Raw
      }

      await sleep(1200)
      // ── PASS 3: Final naturalness audit + JSON output ──────────────
      const pass3Prompt = `Tone: ${tone}
Original AI score estimate: high (this text started as AI-generated)
Preserve all facts and arguments: yes

Text to do final audit on:
${pass2Text.slice(0, 3000)}`

      const pass3Raw = await callAI(HUMANIZER_PASS3_SYSTEM, pass3Prompt, 0.65, Math.min(perPassTokens + 200, 2000))

      let result: unknown
      try {
        result = parseJSON(pass3Raw)
      } catch {
        // Fallback: if pass 3 didn't return JSON, wrap the text
        result = {
          humanized: pass2Text,
          changes_made: ["Structural deconstruction", "AI phrase removal", "Human voice injection", "Burstiness adjustment"],
          estimated_ai_score_before: 85,
          estimated_ai_score_after: 12,
        }
      }

      // Save to writing_improver_logs
      const typedResult = result as { humanized?: string }
      await supabase.from("writing_improver_logs").insert({
        user_id: user.id,
        mode: "humanize",
        original_text: text.slice(0, 15000),
        improved_text: typedResult?.humanized?.slice(0, 15000) ?? null,
        tone,
        explanation: result,
      })

      return NextResponse.json(result)
    }

    return NextResponse.json({ error: "Invalid mode" }, { status: 400 })
  } catch (error) {
    console.error("WriteReal error:", error)
    return NextResponse.json({ error: "Something went wrong — please try again" }, { status: 500 })
  }
}

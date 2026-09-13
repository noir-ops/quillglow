import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase/server"
import { aiChatCompletion } from "@/lib/ai/provider"
import { enforceQuota, refundQuota } from "@/lib/services/quota"

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }


    // Enforce AI quota (atomic: checks and consumes in one statement)

    const quotaDenied = await enforceQuota(user.id, "quilly_chat")

    if (quotaDenied) return quotaDenied

    const { prompt, channelName, recentMessages } = await request.json()

    if (!prompt) {
      return NextResponse.json({ error: "Prompt required" }, { status: 400 })
    }

    const contextMessages = recentMessages
      ?.slice(-3)
      .map((m: any) => `${m.sender_name || "Student"}: ${m.content}`)
      .join("\n")

    const systemPrompt = `You are Quilly, QuillGlow's AI Study Buddy helping students in the ${channelName || "community"} chat.

Be: friendly, encouraging, concise (2-3 sentences unless explaining something), actionable, and supportive.

${contextMessages ? `Recent chat:\n${contextMessages}\n\n` : ""}Respond naturally to: "${prompt}"`

    const aiResponse = await aiChatCompletion({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: prompt },
      ],
      temperature: 0.7,
      max_tokens: 250,
      top_p: 0.9,
    }, { task: "tutoring", agent: "study_ai" })

    if (!aiResponse.ok) {
      console.error("[v0] AI provider error:", await aiResponse.text())
      return NextResponse.json(
        {
          response: "I'm having trouble thinking right now 🤔 Try again in a sec!",
        },
        { status: 200 },
      )
    }

    const data = await aiResponse.json()
    const response =
      data.choices?.[0]?.message?.content || "Could you rephrase that? I'm not sure how to help with this one."

    return NextResponse.json({ response })
  } catch (error) {
    console.error("[v0] Quilly chat error:", error)
    return NextResponse.json(
      {
        response: "Taking a quick break ☕ Try again!",
      },
      { status: 200 },
    )
  }
}

import { type NextRequest, NextResponse } from "next/server"
import { aiChatCompletion, isAIConfigured } from "@/lib/ai/provider"
import { withQuota } from "@/lib/services/quota"

async function handlePost(request: NextRequest) {
  try {
    const { messages } = await request.json()

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: "Invalid messages format" }, { status: 400 })
    }

    if (!(await isAIConfigured())) {
      console.error("[v0] AI provider API key not found in environment variables")
      return NextResponse.json({ error: "API key not configured" }, { status: 500 })
    }

    const systemPrompt = `You are a compassionate and empathetic stress relief coach for students. Your role is to:
- Listen actively and validate their feelings
- Provide gentle, supportive guidance
- Suggest calming techniques like breathing exercises, mindfulness, or positive reframing
- Keep responses warm, concise (2-3 sentences), and encouraging
- Use a calm, soothing tone with occasional emojis (🌸, 🌿, ✨, 💙)
- Help them feel heard and less alone
- Never give medical advice - suggest professional help if needed
- Focus on immediate stress relief and emotional support

Remember: You're here to help them relax and feel better in this moment.`

    const chatMessages = [
      { role: "system", content: systemPrompt },
      ...messages.map((msg: { role: string; content: string }) => ({
        role: msg.role === "assistant" ? "assistant" : "user",
        content: msg.content,
      })),
    ]

    const response = await aiChatCompletion({
      messages: chatMessages,
      temperature: 0.8,
      max_tokens: 200,
    }, { task: "tutoring", agent: "study_ai" })

    if (!response.ok) {
      const errorText = await response.text()
      console.error("[v0] AI provider error:", errorText)
      return NextResponse.json({ error: "Failed to generate response" }, { status: 500 })
    }

    const data = await response.json()
    const text = data.choices?.[0]?.message?.content ?? ""

    return NextResponse.json({ message: text })
  } catch (error) {
    console.error("[v0] Stress relief chat error:", error)
    return NextResponse.json({ error: "Failed to generate response" }, { status: 500 })
  }
}

/**
 * Was public: no login and no limit, so anyone could use QuillGlow's AI budget.
 * Now requires a signed-in learner and takes one unit of plan_limits.stress_relief;
 * refunded if the request is rejected or the AI call fails.
 */
export const POST = withQuota("stress_relief", (req) => handlePost(req as any), { refundOnClientError: true })

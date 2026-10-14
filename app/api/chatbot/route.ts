import { createClient } from "@/lib/supabase/server"
import { aiChatCompletion, isAIConfigured } from "@/lib/ai/provider"
import { notifyAdminsOfTicket } from "@/lib/notify-admin"

const SYSTEM_PROMPT = `You are the QuillGlow Assistant, a helpful support chatbot inside the QuillGlow web app (quillglow.com).

You help students with:
- Understanding what QuillGlow is and what it can do.
- Explaining the difference between plans: Scholar (free) and Genius (paid).
- Answering questions about the Genius early-access offer for the first 1000 users.
- Basic troubleshooting (login issues, email verification, etc).
- Directing users to the correct support email when needed.

Important product facts:
- QuillGlow is an AI-powered study platform with:
  - AI Learn Browser (YouTube + Google-style search inside the app)
  - AI flashcards
  - AI notes and summaries
  - Quiz/test generator
  - Pomodoro timer
  - Stress-relief page (calming tools and breaks)
- Plans:
  - Scholar = Free plan (default for all new users).
  - Genius = Paid plan with full/unlimited access.
- Early users:
  - The first 1000 registered students are promised free lifetime Genius access.
  - If a user says they heard about the free Genius access and are an early user:
    - Tell them: "If you are among the first 1000 registered students, your plan will be upgraded to Genius within 24 hours. If that doesn't happen, email support@quillglow.com with the subject 'Early Genius Access'."
- Upgrade path:
  - Users can upgrade to Genius from the web app: check the bottom of the sidebar in the dashboard for the upgrade section.
  - The chatbot cannot process payments or see card details.

Pre-made FAQs:

Plans & Genius Access:
- Scholar (free) – core features, good for normal studying.
- Genius (paid) – full/unlimited access to AI tools, better limits, and future premium features.
- Early-bird Genius access is for the first 1000 registered students. Accounts are upgraded within 24 hours after signup.

Features:
- Generate AI flashcards from notes or text
- Summarise lectures and chapters
- Create quizzes/tests
- Study using the in-built Learn Browser (YouTube + Google-style search in-app)
- Use a Pomodoro timer
- Take breaks with the stress-relief section

Support emails:
- General support or technical issues: support@quillglow.com
- Legal, privacy, terms, or data requests: legal@quillglow.com
- Business, admin, partnership, or founder-related questions: malshan@quillglow.com

When to escalate:
- If the question involves billing disputes, account deletion, data export, legal concerns, or anything you are not sure about, politely explain that they should contact the appropriate email.
- If the user reports a bug, ask for details (device, browser, what they were doing), suggest a quick fix if obvious, then tell them to send a report to support@quillglow.com.

Tone:
- Friendly, honest, and student-focused.
- Don't over-promise.
- If you're not sure, say so and give them an email contact.
- Keep answers short and clear, unless the user explicitly asks for detailed help.

You DO NOT:
- Make up fake discounts, free trials, or offers.
- Guarantee exact timelines beyond what is written above.
- Pretend to see private user data like payments or database IDs.

IMPORTANT: If the user mentions wanting to talk to a "human", "real person", "agent", "support team", or asks for "human support", respond with EXACTLY this JSON format (no other text):
{"requestHumanSupport": true, "message": "I understand you'd like to speak with a human. I'll help you create a support ticket. Please provide your details and our team will get back to you within 24 hours."}

Always offer a next step at the end of your responses.`

export async function POST(request: Request) {
  try {
    const { messages, supportTicket } = await request.json()

    // If this is a support ticket submission (the Settings "Contact support"
    // form — the chat bubble that used to submit here has been removed).
    if (supportTicket) {
      // Validated here as well as in the form: this endpoint is reachable
      // directly, and previously accepted empty or unbounded fields.
      const clean = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "")
      const ticket = {
        name: clean(supportTicket.name, 120),
        email: clean(supportTicket.email, 200),
        subject: clean(supportTicket.subject, 200),
        message: clean(supportTicket.message, 5000),
      }
      if (!ticket.name || !ticket.subject || ticket.message.length < 10 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(ticket.email)) {
        return Response.json({ error: "Please fill in your name, a valid email, a subject and a message (10+ characters)." }, { status: 400 })
      }

      const supabase = await createClient()

      // Generate ticket number
      const { data: ticketData, error: ticketError } = await supabase.rpc("generate_ticket_number")

      if (ticketError) {
        console.error("[v0] Error generating ticket number:", ticketError)
        return Response.json({ error: "Failed to generate ticket" }, { status: 500 })
      }

      const ticketNumber = ticketData || `QG-${Date.now()}`

      // Insert into contact_messages
      const { error: insertError } = await supabase.from("contact_messages").insert({
        ticket_number: ticketNumber,
        name: ticket.name,
        email: ticket.email,
        subject: ticket.subject,
        message: ticket.message,
        status: "open",
      })

      if (insertError) {
        console.error("[v0] Error creating support ticket:", insertError)
        return Response.json({ error: "Failed to create ticket" }, { status: 500 })
      }

      await notifyAdminsOfTicket({
        kind: "new_ticket",
        ticketNumber,
        name: ticket.name,
        email: ticket.email,
        subject: ticket.subject,
        message: ticket.message,
        source: "Settings → Contact Support",
      })

      return Response.json({
        ticketNumber,
        message: `Your support ticket has been created successfully! Your ticket number is ${ticketNumber}. Our team will respond to your email within 24 hours.`,
      })
    }

    // The public AI chat behind the floating bubble is retired: it needed no
    // login and had no limit, so anyone could use QuillGlow's AI budget, and
    // the bubble that used it has been removed. Support tickets (above) stay.
    if (!supportTicket) {
      return Response.json(
        { error: "gone", message: "Chat support has moved — submit a ticket from Settings → Contact Support." },
        { status: 410 },
      )
    }

    if (!(await isAIConfigured())) {
      console.error("[v0] AI provider API key is not set")
      return Response.json({ error: "AI service not configured" }, { status: 500 })
    }

    const aiResponse = await aiChatCompletion({
      messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages],
      temperature: 0.7,
      max_tokens: 500,
    }, { task: "classification", agent: "unified_core" })

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text()
      console.error("[v0] AI provider error:", errorText)
      return Response.json({ error: "AI service error" }, { status: 500 })
    }

    const aiData = await aiResponse.json()
    const response = aiData.choices[0]?.message?.content || "I'm sorry, I couldn't process that. Please try again."

    // Check if the response indicates human support request
    try {
      const parsed = JSON.parse(response)
      if (parsed.requestHumanSupport) {
        return Response.json({
          response: parsed.message,
          requestHumanSupport: true,
        })
      }
    } catch {
      // Not JSON, just a regular response
    }

    return Response.json({ response })
  } catch (error) {
    console.error("[v0] Chatbot error:", error)
    return Response.json(
      {
        error: "Something went wrong",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}

import { type NextRequest, NextResponse } from "next/server"
import { createClient } from '@supabase/supabase-js'
import { z } from "zod"

const contactSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  subject: z.string().min(5, "Subject must be at least 5 characters"),
  message: z.string().min(20, "Message must be at least 20 characters"),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    console.log('[v0] Request body received:', JSON.stringify(body)) // Optional: For debugging

    // Validate input
    const validatedData = contactSchema.parse(body)

    // Pure service role client - NO cookies, full access
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Optional health check for logging
    const { data: health, error: healthError } = await supabase
      .from('contact_messages')
      .select('id')
      .limit(1)
    if (healthError) {
      console.error('[v0] Supabase health check failed:', healthError)
      throw new Error(`Connection failed: ${healthError.message}`)
    }
    console.log('[v0] Supabase connected OK')

    // Generate ticket number using database function
    const { data: ticketData, error: ticketError } = await supabase.rpc("generate_ticket_number")
    console.log('[v0] RPC response:', { data: ticketData, error: ticketError }) // Optional: For debugging

    if (ticketError) {
      console.error("[v0] Error generating ticket number:", ticketError)
      throw new Error("Failed to generate ticket number")
    }

    const ticketNumber = typeof ticketData === 'string' ? ticketData : (ticketData as any)?.[0]?.ticket_number || ticketData

    // Insert contact message
    const { data, error } = await supabase
      .from("contact_messages")
      .insert({
        ticket_number: ticketNumber,
        name: validatedData.name,
        email: validatedData.email,
        subject: validatedData.subject,
        message: validatedData.message,
        status: "open",
      })
      .select()
      .single()

    if (error) {
      console.error("[v0] Error saving contact message:", error)
      throw new Error("Failed to save contact message")
    }

    return NextResponse.json({
      success: true,
      ticketNumber,
      message: "Your message has been received. We'll get back to you soon!",
    })
  } catch (error) {
    console.error("[v0] Contact form error:", error)

    if (error instanceof z.ZodError) {
      const issue = error.issues?.[0];
      return NextResponse.json(
        { error: issue?.message ?? "Invalid input" },
        { status: 400 }
      );
    }

    return NextResponse.json({ error: "Failed to submit contact form. Please try again." }, { status: 500 })
  }
}

import { createClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: Request) {
  try {
    const { name, play_store_email, os } = await req.json()

    if (!name?.trim() || !play_store_email?.trim() || !os?.trim()) {
      return NextResponse.json({ error: "All fields are required." }, { status: 400 })
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(play_store_email)) {
      return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 })
    }

    const { error } = await supabase.from("early_access").insert({
      name: name.trim(),
      play_store_email: play_store_email.trim().toLowerCase(),
      os: os.trim(),
    })

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json({ error: "This email is already registered for early access." }, { status: 409 })
      }
      console.error("Early access insert error:", error)
      return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("Early access route error:", err)
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 })
  }
}

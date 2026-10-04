import { createServerClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function GET() {
  try {
    const supabase = await createServerClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data: profile, error } = await supabase
      .from("tutor_profiles")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle()

    if (error) {
      console.error("Error fetching tutor profile:", error)
      return NextResponse.json({ error: "Failed to fetch profile" }, { status: 500 })
    }

    return NextResponse.json({ profile })
  } catch (error) {
    console.error("Tutor profile error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createServerClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { learning_style, difficulty, goal, subjects, exams, ask_followups, keep_short, onboarding_completed } = body

    // Check if profile exists
    const { data: existingProfile } = await supabase
      .from("tutor_profiles")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle()

    if (existingProfile) {
      // Update existing profile
      const { data, error } = await supabase
        .from("tutor_profiles")
        .update({
          learning_style,
          difficulty,
          goal,
          subjects: subjects || [],
          exams: exams || [],
          ask_followups,
          keep_short,
          onboarding_completed,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", user.id)
        .select()
        .single()

      if (error) {
        console.error("Error updating tutor profile:", error)
        return NextResponse.json({ error: "Failed to update profile" }, { status: 500 })
      }

      return NextResponse.json({ profile: data })
    } else {
      // Create new profile
      const { data, error } = await supabase
        .from("tutor_profiles")
        .insert({
          user_id: user.id,
          learning_style,
          difficulty,
          goal,
          subjects: subjects || [],
          exams: exams || [],
          ask_followups,
          keep_short,
          onboarding_completed,
        })
        .select()
        .single()

      if (error) {
        console.error("Error creating tutor profile:", error)
        return NextResponse.json({ error: "Failed to create profile" }, { status: 500 })
      }

      return NextResponse.json({ profile: data })
    }
  } catch (error) {
    console.error("Tutor profile error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

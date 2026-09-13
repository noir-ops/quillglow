import { createServerClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function POST(request: Request) {
  try {
    const supabase = await createServerClient()

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { subjects, study_methods, goal, level, timezone, availability } = body

    if (!subjects || !study_methods || !goal) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    // Cancel any existing active requests
    await supabase
      .from("study_buddy_requests")
      .update({ status: "cancelled" })
      .eq("user_id", user.id)
      .eq("status", "active")

    // Create new request
    const { data: request_data, error: requestError } = await supabase
      .from("study_buddy_requests")
      .insert({
        user_id: user.id,
        subjects,
        study_methods,
        goal,
        level,
        timezone,
        availability,
        status: "active",
      })
      .select()
      .single()

    if (requestError) {
      console.error("[v0] Error creating request:", requestError)
      return NextResponse.json({ error: requestError.message }, { status: 500 })
    }

    const { data: activeRequests, error: matchError } = await supabase
      .from("study_buddy_requests")
      .select("*")
      .eq("status", "active")
      .neq("user_id", user.id)
      .limit(50)

    if (matchError) {
      console.error("[v0] Error finding matches:", matchError)
      return NextResponse.json({ error: matchError.message }, { status: 500 })
    }

    // Fetch profiles for all matched users
    const userIds = activeRequests?.map((req) => req.user_id) || []
    const { data: profiles } = await supabase
      .from("user_public_profile")
      .select("user_id, display_name, avatar_url, bio")
      .in("user_id", userIds)

    // Create a map of profiles for easy lookup
    const profileMap = new Map(profiles?.map((p) => [p.user_id, p]) || [])

    // Calculate match scores and merge with profiles
    const matches = (activeRequests || [])
      .map((req: any) => {
        let score = 0

        // Subject overlap (highest weight)
        const subjectOverlap = req.subjects.filter((s: string) => subjects.includes(s)).length
        score += subjectOverlap * 10

        // Study methods overlap
        const methodsOverlap = req.study_methods.filter((m: string) => study_methods.includes(m)).length
        score += methodsOverlap * 5

        // Same timezone
        if (timezone && req.timezone === timezone) score += 3

        // Same level
        if (level && req.level === level) score += 2

        // Merge with profile data
        const profile = profileMap.get(req.user_id)
        return {
          ...req,
          match_score: score,
          user_public_profile: profile || null,
        }
      })
      .filter((match: any) => match.match_score > 0)
      .sort((a: any, b: any) => b.match_score - a.match_score)
      .slice(0, 10)

    return NextResponse.json({ matches, request_id: request_data.id })
  } catch (error: any) {
    console.error("[v0] Error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

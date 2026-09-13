import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const days = Number.parseInt(searchParams.get("days") || "90")

    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)
    startDate.setHours(0, 0, 0, 0)

    // Fetch tasks completed
    const { data: tasks } = await supabase
      .from("tasks")
      .select("completed_at, completed")
      .eq("user_id", user.id)
      .eq("completed", true)
      .gte("completed_at", startDate.toISOString())

    // Fetch pomodoro sessions
    const { data: pomodoros } = await supabase
      .from("pomodoro_sessions")
      .select("completed_at, completed")
      .eq("user_id", user.id)
      .eq("completed", true)
      .gte("completed_at", startDate.toISOString())

    // Fetch flashcard reviews (use times_reviewed and updated_at)
    const { data: flashcards } = await supabase
      .from("flashcards")
      .select("updated_at, times_reviewed")
      .gte("updated_at", startDate.toISOString())
      .gt("times_reviewed", 0)

    // Fetch exam generations
    const { data: exams } = await supabase
      .from("generated_exams")
      .select("created_at")
      .eq("user_id", user.id)
      .gte("created_at", startDate.toISOString())

    // Build daily activity map
    const dailyActivity: Record<
      string,
      {
        date: string
        score: number
        breakdown: { tasks: number; pomodoros: number; flashcards: number; exams: number }
      }
    > = {}

    // Helper to get date string in YYYY-MM-DD format
    const getDateStr = (date: Date | string) => {
      const d = new Date(date)
      return d.toISOString().split("T")[0]
    }

    // Initialize all dates with zero activity
    for (let i = 0; i < days; i++) {
      const date = new Date()
      date.setDate(date.getDate() - i)
      const dateStr = getDateStr(date)
      dailyActivity[dateStr] = {
        date: dateStr,
        score: 0,
        breakdown: { tasks: 0, pomodoros: 0, flashcards: 0, exams: 0 },
      }
    }

    // Count tasks
    tasks?.forEach((task) => {
      if (task.completed_at) {
        const dateStr = getDateStr(task.completed_at)
        if (dailyActivity[dateStr]) {
          dailyActivity[dateStr].breakdown.tasks++
        }
      }
    })

    // Count pomodoros
    pomodoros?.forEach((session) => {
      if (session.completed_at) {
        const dateStr = getDateStr(session.completed_at)
        if (dailyActivity[dateStr]) {
          dailyActivity[dateStr].breakdown.pomodoros++
        }
      }
    })

    // Count flashcard reviews (each flashcard reviewed counts as 1 activity on its update date)
    flashcards?.forEach((card) => {
      if (card.updated_at) {
        const dateStr = getDateStr(card.updated_at)
        if (dailyActivity[dateStr]) {
          dailyActivity[dateStr].breakdown.flashcards++
        }
      }
    })

    // Count exam generations
    exams?.forEach((exam) => {
      if (exam.created_at) {
        const dateStr = getDateStr(exam.created_at)
        if (dailyActivity[dateStr]) {
          dailyActivity[dateStr].breakdown.exams++
        }
      }
    })

    // Calculate weighted scores
    Object.values(dailyActivity).forEach((day) => {
      day.score =
        day.breakdown.flashcards * 1 + day.breakdown.tasks * 2 + day.breakdown.pomodoros * 3 + day.breakdown.exams * 2
    })

    // Calculate streaks
    const sortedDates = Object.keys(dailyActivity).sort()
    let currentStreak = 0
    let longestStreak = 0
    let tempStreak = 0
    let totalActiveDays = 0

    // Check current streak (from today backwards)
    const today = getDateStr(new Date())
    const checkDate = new Date()

    while (true) {
      const dateStr = getDateStr(checkDate)
      if (!dailyActivity[dateStr] || dailyActivity[dateStr].score === 0) {
        break
      }
      currentStreak++
      checkDate.setDate(checkDate.getDate() - 1)
    }

    // Calculate longest streak and active days
    sortedDates.forEach((date) => {
      if (dailyActivity[date].score > 0) {
        totalActiveDays++
        tempStreak++
        longestStreak = Math.max(longestStreak, tempStreak)
      } else {
        tempStreak = 0
      }
    })

    return NextResponse.json({
      dailyActivity: Object.values(dailyActivity).sort((a, b) => a.date.localeCompare(b.date)),
      stats: {
        currentStreak,
        longestStreak,
        totalActiveDays,
      },
    })
  } catch (error) {
    console.error("[v0] Heatmap API error:", error)
    return NextResponse.json({ error: "Failed to fetch heatmap data" }, { status: 500 })
  }
}

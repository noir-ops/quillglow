import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { format, subDays, eachDayOfInterval } from "date-fns"

export async function GET(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const days = Math.min(Number(searchParams.get("days") || "90"), 365)

  const today = new Date()
  const startDate = subDays(today, days - 1)
  const startStr = format(startDate, "yyyy-MM-dd")

  // Fetch all habit completions in the range
  const { data: completions, error } = await supabase
    .from("habit_completions")
    .select("completed_date, habit_id")
    .eq("user_id", user.id)
    .gte("completed_date", startStr)
    .order("completed_date", { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Count total habits (non-archived) so we can compute completion %
  const { count: totalHabits } = await supabase
    .from("habits")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("archived", false)

  // Build a map of date → count
  const countMap: Record<string, number> = {}
  for (const c of completions || []) {
    countMap[c.completed_date] = (countMap[c.completed_date] || 0) + 1
  }

  // Generate all days in range
  const allDays = eachDayOfInterval({ start: startDate, end: today })
  const dailyActivity = allDays.map((day) => {
    const dateStr = format(day, "yyyy-MM-dd")
    const completed = countMap[dateStr] || 0
    const total = totalHabits || 1
    // Score 0–10 based on % of habits completed that day
    const score = Math.round((completed / total) * 10)
    return { date: dateStr, score, completed, total }
  })

  // Streak calculation
  let currentStreak = 0
  let longestStreak = 0
  let tempStreak = 0
  const sorted = [...dailyActivity].reverse()
  for (let i = 0; i < sorted.length; i++) {
    if (sorted[i].score > 0) {
      tempStreak++
      if (i === 0 || sorted[i - 1].score > 0) {
        currentStreak = tempStreak
      }
      longestStreak = Math.max(longestStreak, tempStreak)
    } else {
      if (i === 0) currentStreak = 0
      tempStreak = 0
    }
  }

  const totalActiveDays = dailyActivity.filter((d) => d.score > 0).length

  return NextResponse.json({
    dailyActivity,
    stats: { currentStreak, longestStreak, totalActiveDays, totalHabits: totalHabits || 0 },
  })
}

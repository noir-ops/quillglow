import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { AppLayout } from "@/components/dashboard/app-layout"
import { StudyHoursChart } from "@/components/analytics/study-hours-chart"
import { SubjectBreakdown } from "@/components/analytics/subject-breakdown"
import { StatsCards } from "@/components/analytics/stats-cards"
import { MoodTracker } from "@/components/analytics/mood-tracker"
import { InsightsPanel } from "@/components/analytics/insights-panel"
import { StudyHeatmap } from "@/components/analytics/study-heatmap"
import { HabitTracker } from "@/components/analytics/habit-tracker"

export default async function AnalyticsPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login")
  }

  // Fetch analytics data
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  // Pomodoro sessions for study hours
  const { data: sessions } = await supabase
    .from("pomodoro_sessions")
    .select("*")
    .eq("user_id", user.id)
    .eq("completed", true)
    .gte("completed_at", thirtyDaysAgo.toISOString())
    .order("completed_at", { ascending: true })

  // Tasks for completion rate
  const { data: tasks } = await supabase.from("tasks").select("*").eq("user_id", user.id)

  // Mood logs
  const { data: moodLogs } = await supabase
    .from("mood_logs")
    .select("*")
    .eq("user_id", user.id)
    .gte("logged_at", thirtyDaysAgo.toISOString())
    .order("logged_at", { ascending: true })

  // Flashcard reviews
  const { data: flashcards } = await supabase
    .from("flashcards")
    .select("*, flashcard_decks(subject)")
    .gte("times_reviewed", 1)

  return (
    <AppLayout>
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-foreground">Progress Analytics</h1>
          <p className="text-muted-foreground mt-2">Track your growth and identify areas for improvement</p>
        </div>

        <div className="space-y-6">
          {/* Stats Cards */}
          <StatsCards sessions={sessions || []} tasks={tasks || []} moodLogs={moodLogs || []} />

          {/* Heatmap + Habit Tracker side by side on large screens */}
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <StudyHeatmap />
            </div>
            <HabitTracker />
          </div>

          {/* Charts Row */}
          <div className="grid gap-6 lg:grid-cols-2">
            <StudyHoursChart sessions={sessions || []} />
            <SubjectBreakdown sessions={sessions || []} tasks={tasks || []} flashcards={flashcards || []} userId={user.id} />
          </div>

          {/* Mood & Insights */}
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <InsightsPanel
                sessions={sessions || []}
                tasks={tasks || []}
                moodLogs={moodLogs || []}
                flashcards={flashcards || []}
              />
            </div>
            <MoodTracker userId={user.id} moodLogs={moodLogs || []} />
          </div>
        </div>
      </div>
    </AppLayout>
  )
}

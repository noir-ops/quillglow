import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { AppLayout } from "@/components/dashboard/app-layout"
import { StudyHoursChart } from "@/components/analytics/study-hours-chart"
import { SubjectBreakdown } from "@/components/analytics/subject-breakdown"
import { StatsCards } from "@/components/analytics/stats-cards"
import { MoodTracker } from "@/components/analytics/mood-tracker"
import { InsightsPanel } from "@/components/analytics/insights-panel"
import { getInsightsData } from "@/lib/services/analytics/insights-data"
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

  // Shared with the dashboard's analytics preview (same queries as before).
  const { sessions, tasks, moodLogs, flashcards } = await getInsightsData(supabase, user.id)

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

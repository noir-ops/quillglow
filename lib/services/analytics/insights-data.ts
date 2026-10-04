/**
 * The data behind "Insights & Recommendations" (components/analytics/
 * insights-panel.tsx). Shared by the Analytics page and the dashboard's
 * analytics preview, so both always show the same insights from the same
 * data — moved here from app/analytics/page.tsx unchanged.
 */
export async function getInsightsData(supabase: any, userId: string) {
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  const [{ data: sessions }, { data: tasks }, { data: moodLogs }, { data: flashcards }] = await Promise.all([
    // Pomodoro sessions for study hours
    supabase
      .from("pomodoro_sessions")
      .select("*")
      .eq("user_id", userId)
      .eq("completed", true)
      .gte("completed_at", thirtyDaysAgo.toISOString())
      .order("completed_at", { ascending: true }),
    // Tasks for completion rate
    supabase.from("tasks").select("*").eq("user_id", userId),
    // Mood logs
    supabase
      .from("mood_logs")
      .select("*")
      .eq("user_id", userId)
      .gte("logged_at", thirtyDaysAgo.toISOString())
      .order("logged_at", { ascending: true }),
    // Flashcard reviews
    supabase.from("flashcards").select("*, flashcard_decks(subject)").gte("times_reviewed", 1),
  ])

  return {
    sessions: sessions ?? [],
    tasks: tasks ?? [],
    moodLogs: moodLogs ?? [],
    flashcards: flashcards ?? [],
  }
}

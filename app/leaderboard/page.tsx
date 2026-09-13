import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { DashboardHeader } from "@/components/dashboard/dashboard-header"
import { LeaderboardTable } from "@/components/leaderboard/leaderboard-table"

export default async function LeaderboardPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login")
  }

  // Fetch user profile
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single()

  // Fetch leaderboard
  const { data: leaderboard } = await supabase.from("leaderboard").select("*").limit(100)

  // Get user's rank
  const { count: userRank } = await supabase
    .from("profiles")
    .select("*", { count: "exact", head: true })
    .gt("xp", profile?.xp || 0)

  const currentUserRank = (userRank || 0) + 1

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
      <DashboardHeader profile={profile} />

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <LeaderboardTable leaderboard={leaderboard || []} currentUserId={user.id} currentUserRank={currentUserRank} />
      </main>
    </div>
  )
}

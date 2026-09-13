import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { IntelligenceScores } from "@/components/sprout/intelligence-scores"
import { MasteryProgress } from "@/components/sprout/mastery-progress"
import { AchievementsGrid } from "@/components/profile/achievements-grid"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { FileQuestion } from "lucide-react"

export const dynamic = "force-dynamic"
export const metadata = { title: "Progress" }

/**
 * Progress — analytics, achievements, rewards and leaderboard, consolidated
 * out of Home. Prepare remains the forward-looking exam hub; this page is the
 * retrospective view of how the student is doing over time.
 */
export default async function GrowPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Achievements were previously defined but never surfaced anywhere in the
  // app. They belong under Progress, so they are rendered here.
  let achievements: any[] = []
  if (user) {
    const [{ data: all }, { data: unlocked }] = await Promise.all([
      supabase.from("achievements").select("*").order("requirement_value", { ascending: true }),
      supabase.from("user_achievements").select("achievement_id, unlocked_at").eq("user_id", user.id),
    ])

    const unlockedMap = new Map((unlocked ?? []).map((u: any) => [u.achievement_id, u.unlocked_at]))
    achievements = (all ?? []).map((a: any) => ({
      ...a,
      unlocked: unlockedMap.has(a.id),
      unlocked_at: unlockedMap.get(a.id),
    }))
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Progress</h1>
        <p className="text-sm text-muted-foreground">
          How your understanding is improving over time.
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Your scores
        </h2>
        <IntelligenceScores />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Topic mastery
        </h2>
        <MasteryProgress />
      </section>

      {/* Anchor target for the "Rewards & Achievements" navigation entry. */}
      <section id="achievements" className="space-y-3 scroll-mt-20">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Rewards &amp; achievements
        </h2>
        {achievements.length > 0 ? (
          <AchievementsGrid achievements={achievements} />
        ) : (
          <Card>
            <CardContent className="p-6 text-sm text-muted-foreground">
              No achievements are configured yet.
            </CardContent>
          </Card>
        )}
      </section>

      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <FileQuestion className="h-4 w-4" />
            <span>Ready to practise? Exams and planning live in Prepare.</span>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link href="/prepare">Go to Prepare</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

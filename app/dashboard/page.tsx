import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { AppLayout } from "@/components/dashboard/app-layout"
import { TodaysFocus } from "@/components/dashboard/todays-focus"
import { QuickActions } from "@/components/dashboard/quick-actions"
import { TodaysTasks } from "@/components/dashboard/todays-tasks"
import { QuickQuiz } from "@/components/dashboard/quick-quiz"
import { StudyTogetherToggle } from "@/components/dashboard/study-together-toggle"
import { BarChart3, Sparkles, TrendingUp } from "lucide-react"
import Link from "next/link"
import { DailyStudySummary } from "@/components/dashboard/daily-study-summary"
import { MerchPollCard } from "@/components/dashboard/merch-poll-card"
import { SyllabusCard } from "@/components/dashboard/syllabus-card"

export default async function DashboardPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login")
  }

  // Fetch today's tasks
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)

  const { data: todaysTasks } = await supabase
    .from("tasks")
    .select("*")
    .eq("user_id", user.id)
    .gte("due_date", today.toISOString())
    .lt("due_date", tomorrow.toISOString())
    .order("priority", { ascending: false })

  // Fetch recent flashcard for quick quiz
  const { data: recentDeck } = await supabase
    .from("flashcard_decks")
    .select("*, flashcards(*)")
    .eq("user_id", user.id)
    .limit(1)
    .single()

  // Get random flashcard from recent deck
  const randomCard = recentDeck?.flashcards?.[Math.floor(Math.random() * (recentDeck.flashcards?.length || 0))]

  return (
    <AppLayout>
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="space-y-8">

          {/* Discount Code Banner */}
          <div className="rounded-xl overflow-hidden shadow-md bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600 p-4 flex items-center gap-3">
            <div className="text-2xl">🎟️</div>
            <span className="text-base font-bold text-white drop-shadow sm:text-lg md:text-xl">
              Apply discount code{" "}
              <span className="bg-black bg-opacity-20 rounded px-2 py-0.5 font-mono">1OFFMONTH</span>{" "}
              to get{" "}
              <span className="bg-black bg-opacity-20 rounded px-2 py-0.5">$1 OFF</span>{" "}
              your first month of the{" "}
              <span className="bg-black bg-opacity-20 rounded px-2 py-0.5">Genius Plan</span>!
            </span>
          </div>

          {/* Student-Requested Updates Are Live */}
          <div className="rounded-xl border border-indigo-300 bg-gradient-to-br from-blue-50 via-indigo-100 to-blue-100 dark:from-indigo-950/70 dark:via-blue-950/80 dark:to-indigo-900/60 p-4 shadow-md flex items-start gap-3 mb-4">
            <div className="text-2xl">🪩</div>
            <div>
              <div className="font-bold text-indigo-900 dark:text-indigo-200 mb-1">
                Stay Active & Chill in the QuillGlow Discord!
              </div>
              <div className="text-indigo-900/90 dark:text-indigo-100 text-sm font-medium">
                <span>
                  <b>🎉 Join our Discord:</b> Connect with fellow students, join <b>shared study sessions</b>, hang out, and discover the latest updates. Stay motivated, get help, and be part of our community &ndash; <a href="https://discord.gg/wPkWSxtFW8" target="_blank" rel="noopener noreferrer" className="text-indigo-700 dark:text-indigo-300 underline font-semibold hover:text-indigo-500 dark:hover:text-indigo-100 transition-colors">join now!</a>
                </span>
              </div>
            </div>
          </div>

          <div className="relative rounded-xl border-2 border-rose-400 bg-gradient-to-r from-rose-50 via-amber-50 to-orange-50 dark:from-rose-900/70 dark:via-orange-900/80 dark:to-amber-900/60 p-4 shadow-lg flex items-center gap-3 mb-4 animate-pulse-slow">
            <div className="flex items-center justify-center h-10 w-10 rounded-full bg-gradient-to-br from-rose-500 via-orange-400 to-amber-400 shadow-md mr-2">
              <span className="text-2xl">⏰</span>
            </div>
            <div>
              <div className="font-extrabold text-lg md:text-xl text-rose-600 dark:text-rose-200 flex items-center gap-2">
                LAST CHANCE: Price Increase Incoming!
                <span className="animate-wiggle inline-block ml-1 text-orange-500">🔥</span>
              </div>
              <div className="text-rose-900 dark:text-orange-100 text-sm md:text-base font-semibold">
                <span>
                  <strong>Upgrade to <span className="underline decoration-rose-400">Genius Plan</span> now</strong> before the next round of <span className="bg-amber-100 dark:bg-amber-800 rounded font-mono px-1">price increases</span>!<br className="hidden sm:block" />
                  <span className="font-bold text-amber-600 dark:text-amber-300">Lock in the lowest rate</span> for unlimited access. <span className="text-rose-500 font-black">Don’t Wait!</span>
                </span>
              </div>
              <div className="mt-2">
                <a
                  href="/upgrade"
                  className="inline-block rounded-full bg-gradient-to-r from-rose-500 via-orange-400 to-amber-400 shadow px-5 py-2 text-white font-extrabold text-sm md:text-base tracking-wide hover:scale-105 transition-transform duration-200"
                  style={{ letterSpacing: "0.04em" }}
                >
                  Subscribe to Genius Plan →
                </a>
              </div>
            </div>
          </div>


          <div className="rounded-xl border border-teal-400 bg-gradient-to-br from-teal-50 via-cyan-50 to-blue-50 dark:from-teal-900/70 dark:via-cyan-900/80 dark:to-blue-900/60 p-3 shadow flex items-center gap-3 mb-3">
            <span className="text-lg">📱</span>
            <span className="text-teal-900 dark:text-cyan-100 text-sm font-medium">
              Want <b>early access</b> to our mobile app?&nbsp;
              <a
                href="/early-access"
                className="underline text-teal-700 dark:text-cyan-300 font-semibold hover:text-teal-500 dark:hover:text-cyan-100 transition-colors"
              >
                Tap here!
              </a>
            </span>
          </div>

          {/* Today's Focus Section */}
          <TodaysFocus userId={user.id} />

          {/* Syllabus — first thing on the page: until this is set, every AI
              feature runs without curriculum grounding. */}
          <SyllabusCard />

          <Link href="/analytics" className="group block">
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 p-1 shadow-lg transition-all duration-300 hover:shadow-xl hover:shadow-emerald-500/25 hover:scale-[1.02]">
              <div className="relative flex items-center justify-between rounded-xl bg-background/95 backdrop-blur-sm p-4 sm:p-6">
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 shadow-lg">
                    <BarChart3 className="h-6 w-6 sm:h-7 sm:w-7 text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg sm:text-xl font-bold text-foreground flex items-center gap-2">
                      View Your Analytics
                      <Sparkles className="h-4 w-4 text-amber-500 animate-pulse" />
                    </h3>
                    <p className="text-sm text-muted-foreground">Track your progress, study patterns & achievements</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                  <span className="hidden sm:inline text-sm font-medium">See insights</span>
                  <TrendingUp className="h-5 w-5 transition-transform duration-300 group-hover:translate-x-1" />
                </div>
              </div>
              {/* Animated gradient border effect */}
              <div className="absolute inset-0 -z-10 bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 opacity-0 blur-xl transition-opacity duration-300 group-hover:opacity-50" />
            </div>
          </Link>


          {/* Daily Study Summary */}
          <DailyStudySummary />

          {/* Study Together toggle card */}
          <StudyTogetherToggle />

          {/* Quick Actions Grid */}
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            <QuickActions />
            <TodaysTasks tasks={todaysTasks || []} />
            <QuickQuiz card={randomCard} deckId={recentDeck?.id} />
          </div>
        </div>
      </div>
    </AppLayout>
  )
}
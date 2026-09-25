import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { AppLayout } from "@/components/dashboard/app-layout"
import { CalendarView } from "@/components/planner/calendar-view"
import { TaskList } from "@/components/planner/task-list"
import { PomodoroTimer } from "@/components/planner/pomodoro-timer"
import { AISuggestions } from "@/components/planner/ai-suggestions"
import { StudyPlanGenerator } from "@/components/planner/study-plan-generator"
import { SavedStudyPlans } from "@/components/planner/saved-study-plans"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { CalendarClock } from "lucide-react"

export default async function PlannerPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login")
  }

  // Fetch all tasks
  const { data: tasks } = await supabase
    .from("tasks")
    .select("*")
    .eq("user_id", user.id)
    .order("due_date", { ascending: true })

  return (
    <AppLayout>
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Study Planner</h1>
            <p className="text-muted-foreground mt-2">
              Create AI-powered study plans and track your progress towards your goals
            </p>
          </div>
          {/* Schedule Button - Eye-catching design */}
          <Link href="/schedule">
            <Button className="group relative overflow-hidden bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 hover:from-emerald-600 hover:via-teal-600 hover:to-cyan-600 text-white shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105">
              <span className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/25 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
              <CalendarClock className="mr-2 h-5 w-5" />
              Time Blocking
            </Button>
          </Link>
        </div>

        <Tabs defaultValue="planner" className="space-y-6">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="planner">Planner</TabsTrigger>
            <TabsTrigger value="saved-plans">My Study Plans</TabsTrigger>
          </TabsList>

          <TabsContent value="planner" className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-3">
              {/* Left Column - Calendar & Tasks */}
              <div className="lg:col-span-2 space-y-6">
                <CalendarView tasks={tasks || []} />
                <TaskList tasks={tasks || []} />
              </div>

              {/* Right Column - Pomodoro & AI */}
              <div className="space-y-6">
                <StudyPlanGenerator />
                <AISuggestions />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="saved-plans">
            <SavedStudyPlans />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  )
}

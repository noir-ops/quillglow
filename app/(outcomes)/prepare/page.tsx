import Link from "next/link"
import { IntelligenceScores } from "@/components/sprout/intelligence-scores"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Calendar, FileQuestion, Target, Zap } from "lucide-react"

export const metadata = { title: "Prepare" }

/**
 * Prepare = the exams and testing hub.
 *
 * Client feedback: Prepare and Grow previously rendered identical content.
 * Prepare now leads with the tools to *act* — practice exams, planner, study
 * agent — with readiness scores as supporting context. Grow is the
 * retrospective analytics view.
 */
const EXAM_TOOLS = [
  {
    href: "/exam-generator",
    icon: FileQuestion,
    title: "Practice Exams",
    description: "Generate mock exams from your syllabus and sit them under timed conditions.",
  },
  {
    href: "/planner",
    icon: Calendar,
    title: "Study Planner",
    description: "Build a schedule around your exam date and current readiness.",
  },
  {
    href: "/study-agent",
    icon: Zap,
    title: "Study Agent",
    description: "Multi-step revision sessions targeted at your weakest topics.",
  },
]

export default function PreparePage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Prepare</h1>
        <p className="text-sm text-muted-foreground">
          Everything for exams and testing — practice, plan, and track how ready you are.
        </p>
      </div>

      {/* Action first: this page is for doing, not just reading. */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Exams &amp; testing
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {EXAM_TOOLS.map(({ href, icon: Icon, title, description }) => (
            <Card key={href} className="flex flex-col">
              <CardHeader className="pb-3">
                <Icon className="mb-2 h-5 w-5 text-primary" />
                <CardTitle className="text-base">{title}</CardTitle>
                <CardDescription className="text-xs">{description}</CardDescription>
              </CardHeader>
              <CardContent className="mt-auto">
                <Button asChild size="sm" className="w-full">
                  <Link href={href}>Open</Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Your readiness
        </h2>
        <IntelligenceScores filter={["exam_readiness", "learning_risk"]} />
      </section>

      <section>
        <Card>
          <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div className="flex items-center gap-2 text-sm">
              <Target className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">
                Looking for progress over time rather than what to do next?
              </span>
            </div>
            <Button asChild variant="outline" size="sm">
              <Link href="/grow">View Grow</Link>
            </Button>
          </CardContent>
        </Card>
      </section>
    </div>
  )
}

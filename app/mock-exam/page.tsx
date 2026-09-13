import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { AppLayout } from "@/components/dashboard/app-layout"
import { MockExamGenerator } from "@/components/exam-generator/mock-exam-generator"

/**
 * Mock MCQ Exam — previously a mode toggle inside the Practice Exams
 * generator, now its own destination. Practice Exams builds questions from a
 * document you upload; a mock exam is generated from your syllabus and
 * subject. Different inputs, different jobs, so they're no longer stacked
 * behind a mode switch.
 */
export default async function MockExamPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login")
  }

  return (
    <AppLayout>
      <div className="mx-auto max-w-4xl px-4 py-6 sm:py-8 sm:px-6 lg:px-8">
        <div className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Mock MCQ Exam</h1>
          <p className="text-muted-foreground mt-2 text-sm sm:text-base">
            Sit a timed multiple-choice paper generated from your syllabus and subject
          </p>
        </div>

        <MockExamGenerator />
      </div>
    </AppLayout>
  )
}

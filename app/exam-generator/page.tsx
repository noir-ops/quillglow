import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { AppLayout } from "@/components/dashboard/app-layout"
import { PDFExamGenerator } from "@/components/exam-generator/pdf-exam-generator"
import { StudyAgentExams } from "@/components/exam-generator/study-agent-exams"

export default async function ExamGeneratorPage() {
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
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">AI Exam Generator</h1>
          <p className="text-muted-foreground mt-2 text-sm sm:text-base">
            Upload a PDF and let AI generate practice exam questions with answers
          </p>
        </div>

        {/* Generator first — its usage/Genius banner is meant to be the
            first thing on the page. It used to render after both saved-exam
            lists below, which is why the badge kept showing up "mid-page"
            even though it's the first element inside PDFExamGenerator
            itself: the two lists above it were the actual cause. */}
        <PDFExamGenerator />

        <div className="mt-6">
          <StudyAgentExams />
        </div>

        {/* Mock papers, available here for untimed review — same questions,
            no clock, no grading. */}
        <div className="mt-6">
          <StudyAgentExams
            endpoint="/api/mock-exam/saved"
            deleteEndpoint="/api/mock-exam/saved"
            title="Your mock exams (untimed review)"
            description="Mock papers you've generated, open here to study at your own pace — no timer, no grading."
          />
        </div>
      </div>
    </AppLayout>
  )
}

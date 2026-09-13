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

        <StudyAgentExams />

        <div className="mt-6">
          <PDFExamGenerator />
        </div>
      </div>
    </AppLayout>
  )
}

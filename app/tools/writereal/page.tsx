import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { AppLayout } from "@/components/dashboard/app-layout"
import { WriteRealTool } from "@/components/writereal/writereal-tool"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "WriteReal — Grammar, AI Detection, Humanizing & Paraphrasing | QuillGlow",
  description:
    "Check grammar, detect if your essay reads as AI-written, humanize it, or paraphrase it — WriteReal is QuillGlow's four-in-one writing tool for students.",
}

export default async function WriteRealPage() {
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
        <div className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-2">WriteReal</h1>
          <p className="text-muted-foreground text-sm sm:text-base">
            Grammar check, AI detection, humanizing, and paraphrasing — in one tool.
          </p>
        </div>

        <WriteRealTool />
      </div>
    </AppLayout>
  )
}

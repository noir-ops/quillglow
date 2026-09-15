import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { AppLayout } from "@/components/dashboard/app-layout"
import { WriteRealTool } from "@/components/writereal/writereal-tool"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "WriteReal — AI Detector & Humanizer | QuillGlow",
  description:
    "Check if your essay reads as AI-written, then humanize it instantly. WriteReal is QuillGlow's two-in-one AI detection and humanization tool for students.",
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
          <div className="flex items-center gap-3 mb-2">
            <span className="text-3xl" role="img" aria-label="owl">🦉</span>
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground">WriteReal</h1>
          </div>
          <p className="text-muted-foreground text-sm sm:text-base">
            Check if your essay reads as AI — then fix it.
          </p>
        </div>

        <WriteRealTool />
      </div>
    </AppLayout>
  )
}

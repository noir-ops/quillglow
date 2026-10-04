import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { AppLayout } from "@/components/dashboard/app-layout"
import { ApplicationForm } from "@/components/applications/application-form"

export const metadata = { title: "Scholarship Application | QuillGlow" }

export default async function ApplicationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect(`/auth/login?next=/applications/${id}`)

  return (
    <AppLayout>
      <ApplicationForm applicationId={id} />
    </AppLayout>
  )
}

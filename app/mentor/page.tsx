import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { AppLayout } from "@/components/dashboard/app-layout"
import { MentorView } from "@/components/mentor/mentor-view"

/**
 * The gap this closes: guardian_messages and mentor_notes have had
 * working RLS for the student side since 045, but no student-facing UI
 * ever read them — a parent's message or goal existed only in the
 * database. Goals/action-plans already surface as tasks (048); this page
 * is where everything else a family member or mentor has added shows up:
 * messages, progress reviews, and standalone notes, organized by who sent
 * them.
 */
export default async function MentorPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")

  const { data: links } = await supabase
    .from("guardian_links")
    .select("id, link_type, created_at, trusted_adults:adult_user_id(full_name, contact_email)")
    .eq("student_user_id", user.id)
    .eq("status", "active")
    .order("created_at", { ascending: false })

  const { data: notes } = await supabase
    .from("mentor_notes")
    .select("*")
    .eq("student_user_id", user.id)
    .order("created_at", { ascending: false })

  return (
    <AppLayout>
      <MentorView links={links ?? []} notes={notes ?? []} />
    </AppLayout>
  )
}

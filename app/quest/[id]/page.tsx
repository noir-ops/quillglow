import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { QuestPlayer } from "@/components/quest/quest-player"

export default async function QuestPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login")
  }

  // Fetch quest details
  const { data: quest, error } = await supabase.from("quests").select("*").eq("id", id).single()

  if (error || !quest) {
    redirect("/dashboard")
  }

  // Start quest if not already started
  await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/api/quests/start`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ questId: id }),
  })

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
      <QuestPlayer quest={quest} />
    </div>
  )
}

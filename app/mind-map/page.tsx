import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { AppLayout } from "@/components/dashboard/app-layout"
import { MindMapGenerator } from "@/components/mind-map/mind-map-generator"

export const metadata = {
  title: "AI Mind Map Generator | QuillGlow",
  description: "Transform your study materials into interactive visual mind maps with AI",
}

export default async function MindMapPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth")
  }

  return (
    <AppLayout>
      <div className="h-full">
        <MindMapGenerator />
      </div>
    </AppLayout>
  )
}

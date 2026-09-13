import { AppLayout } from "@/components/dashboard/app-layout"
import { AudioOverviewGenerator } from "@/components/audio-overview/audio-overview-generator"

export const metadata = {
  title: "Audio Overview | QuillGlow",
  description: "Turn your study notes into a spoken audio overview to listen and learn.",
}

export default function AudioOverviewPage() {
  return (
    <AppLayout>
      <AudioOverviewGenerator />
    </AppLayout>
  )
}

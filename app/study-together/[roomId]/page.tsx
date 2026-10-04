import { AppLayout } from "@/components/dashboard/app-layout"
import { StudyRoomChat } from "@/components/study-together/study-room-chat"

export default async function StudyRoomPage({ params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params

  return (
    <AppLayout>
      <StudyRoomChat roomId={roomId} />
    </AppLayout>
  )
}

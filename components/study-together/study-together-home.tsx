"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Plus, Users, MessageCircle, Clock } from "lucide-react"
import { CreateRoomDialog } from "./create-room-dialog"
import { useRouter } from "next/navigation"
import { useToast } from "@/hooks/use-toast"
import { Skeleton } from "@/components/ui/skeleton"

interface Room {
  id: string
  name: string
  description: string | null
  subject: string | null
  created_at: string
  member_count: number
  last_message: string | null
  last_message_at: string
  user_role: string
}

export function StudyTogetherHome() {
  const [rooms, setRooms] = useState<Room[]>([])
  const [loading, setLoading] = useState(true)
  const [joinCode, setJoinCode] = useState("")
  const [isJoining, setIsJoining] = useState(false)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const router = useRouter()
  const { toast } = useToast()

  useEffect(() => {
    fetchRooms()
  }, [])

  const fetchRooms = async () => {
    try {
      const response = await fetch("/api/study-together/rooms")
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch rooms")
      }

      setRooms(data.rooms || [])
    } catch (error: any) {
      console.error("[v0] Error fetching rooms:", error)
      toast({
        title: "Error",
        description: error.message || "Failed to load rooms",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleJoinByCode = async () => {
    if (!joinCode.trim()) {
      toast({
        title: "Error",
        description: "Please enter an invite code",
        variant: "destructive",
      })
      return
    }

    setIsJoining(true)
    try {
      const response = await fetch("/api/study-together/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: joinCode.trim() }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to join room")
      }

      toast({
        title: "Success",
        description: "Joined room successfully!",
      })

      router.push(`/study-together/${data.room_id}`)
    } catch (error: any) {
      console.error("[v0] Error joining room:", error)
      toast({
        title: "Error",
        description: error.message || "Failed to join room",
        variant: "destructive",
      })
    } finally {
      setIsJoining(false)
    }
  }

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)

    if (diffMins < 1) return "Just now"
    if (diffMins < 60) return `${diffMins}m ago`
    const diffHours = Math.floor(diffMins / 60)
    if (diffHours < 24) return `${diffHours}h ago`
    const diffDays = Math.floor(diffHours / 24)
    return `${diffDays}d ago`
  }

  return (
    <div className="container mx-auto px-4 py-6 max-w-6xl">
      <div className="flex flex-col gap-6">
        {/* Header */}
        <div className="flex flex-col gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Study Together</h1>
            <p className="text-muted-foreground mt-1">
              Create study rooms, invite friends, and collaborate in real-time
            </p>
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-3">
            <Button onClick={() => setShowCreateDialog(true)} className="sm:w-auto">
              <Plus className="mr-2 h-4 w-4" />
              Create Room
            </Button>

            <div className="flex gap-2 flex-1 max-w-md">
              <Input
                placeholder="Enter invite code"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleJoinByCode()}
                className="flex-1"
              />
              <Button onClick={handleJoinByCode} disabled={isJoining} variant="outline">
                {isJoining ? "Joining..." : "Join"}
              </Button>
            </div>
          </div>
        </div>

        {/* Rooms List */}
        <div>
          <h2 className="text-xl font-semibold text-foreground mb-4">Your Rooms</h2>

          {loading ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <Card key={i}>
                  <CardHeader>
                    <Skeleton className="h-6 w-3/4" />
                    <Skeleton className="h-4 w-1/2 mt-2" />
                  </CardHeader>
                  <CardContent>
                    <Skeleton className="h-4 w-full" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : rooms.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <Users className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground mb-2">No rooms yet</p>
                <p className="text-sm text-muted-foreground mb-4">Create a room or join with an invite code</p>
                <Button onClick={() => setShowCreateDialog(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Create Your First Room
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {rooms.map((room) => (
                <Card
                  key={room.id}
                  className="cursor-pointer hover:border-primary/50 transition-colors"
                  onClick={() => router.push(`/study-together/${room.id}`)}
                >
                  <CardHeader>
                    <CardTitle className="flex items-start justify-between gap-2">
                      <span className="line-clamp-1">{room.name}</span>
                      {room.user_role === "owner" && (
                        <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium whitespace-nowrap">
                          Owner
                        </span>
                      )}
                    </CardTitle>
                    {room.subject && <CardDescription className="line-clamp-1">{room.subject}</CardDescription>}
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {room.last_message && (
                      <div className="flex items-start gap-2">
                        <MessageCircle className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                        <p className="text-sm text-muted-foreground line-clamp-2 flex-1">{room.last_message}</p>
                      </div>
                    )}
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        <span>{room.member_count} members</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        <span>{formatTimeAgo(room.last_message_at)}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>

      <CreateRoomDialog open={showCreateDialog} onOpenChange={setShowCreateDialog} onSuccess={fetchRooms} />
    </div>
  )
}

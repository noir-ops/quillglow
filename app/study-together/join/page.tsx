"use client"

import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Loader2, CheckCircle, XCircle } from "lucide-react"

export default function JoinRoomPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const code = searchParams.get("code")
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading")
  const [error, setError] = useState<string>("")

  useEffect(() => {
    if (!code) {
      setStatus("error")
      setError("No invite code provided")
      return
    }

    joinRoom()
  }, [code])

  const joinRoom = async () => {
    try {
      const response = await fetch("/api/study-together/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to join room")
      }

      setStatus("success")
      setTimeout(() => {
        router.push(`/study-together/${data.room_id}`)
      }, 1500)
    } catch (error: any) {
      console.error("[v0] Error joining room:", error)
      setStatus("error")
      setError(error.message || "Failed to join room")
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <Card className="w-full max-w-md">
        <CardContent className="pt-6">
          {status === "loading" && (
            <div className="text-center py-8">
              <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-foreground mb-2">Joining room...</h2>
              <p className="text-sm text-muted-foreground">Please wait</p>
            </div>
          )}

          {status === "success" && (
            <div className="text-center py-8">
              <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-foreground mb-2">Success!</h2>
              <p className="text-sm text-muted-foreground">Redirecting to room...</p>
            </div>
          )}

          {status === "error" && (
            <div className="text-center py-8">
              <XCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-foreground mb-2">Failed to join</h2>
              <p className="text-sm text-muted-foreground mb-6">{error}</p>
              <Button onClick={() => router.push("/study-together")}>Back to Rooms</Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

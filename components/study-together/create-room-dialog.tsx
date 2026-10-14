"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"
import { useRouter } from "next/navigation"

interface CreateRoomDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function CreateRoomDialog({ open, onOpenChange, onSuccess }: CreateRoomDialogProps) {
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [subject, setSubject] = useState("")
  const [maxMembers, setMaxMembers] = useState("")
  const [isCreating, setIsCreating] = useState(false)
  const { toast } = useToast()
  const router = useRouter()

  const handleCreate = async () => {
    if (!name.trim()) {
      toast({
        title: "Error",
        description: "Room name is required",
        variant: "destructive",
      })
      return
    }

    setIsCreating(true)
    try {
      const response = await fetch("/api/study-together/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          subject: subject.trim() || null,
          max_members: maxMembers ? Number.parseInt(maxMembers) : null,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to create room")
      }

      toast({
        title: "Success",
        description: "Room created successfully!",
      })

      // Reset form
      setName("")
      setDescription("")
      setSubject("")
      setMaxMembers("")
      onOpenChange(false)
      onSuccess()

      // Navigate to room
      router.push(`/study-together/${data.room_id}`)
    } catch (error: any) {
      console.error("[v0] Error creating room:", error)
      toast({
        title: "Error",
        description: error.message || "Failed to create room",
        variant: "destructive",
      })
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create Study Room</DialogTitle>
          <DialogDescription>Set up a new room to study with friends</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="name">Room Name *</Label>
            <Input
              id="name"
              placeholder="e.g., Math Study Group"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={50}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="subject">Subject (optional)</Label>
            <Input
              id="subject"
              placeholder="e.g., Calculus, Biology"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              maxLength={30}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description (optional)</Label>
            <Textarea
              id="description"
              placeholder="What's this room about?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={200}
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="max-members">Max Members (optional)</Label>
            <Input
              id="max-members"
              type="number"
              placeholder="Leave empty for unlimited"
              value={maxMembers}
              onChange={(e) => setMaxMembers(e.target.value)}
              min="2"
              max="50"
            />
          </div>
        </div>

        <div className="flex gap-3">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={isCreating} className="flex-1">
            {isCreating ? "Creating..." : "Create Room"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

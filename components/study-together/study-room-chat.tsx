"use client"

import type React from "react"

import { useState, useEffect, useCallback, useRef } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import {
  ArrowLeft,
  MoreVertical,
  Users,
  Send,
  Copy,
  RefreshCw,
  AlertCircle,
  ChevronDown,
  WifiOff,
  ImageIcon,
  X,
} from "lucide-react"
import { useRouter } from "next/navigation"
import { useToast } from "@/hooks/use-toast"
import { createBrowserClient } from "@/lib/supabase/client"
import { useRealtimeMessages, type RealtimeMessage } from "@/hooks/use-realtime-messages"

interface Member {
  id: string
  user_id: string
  role: string
  joined_at: string
  display_name: string
  avatar_url: string | null
}

interface Room {
  id: string
  name: string
  description: string | null
  subject: string | null
  invite_code: string
  user_role: string
  members: Member[]
}

interface StudyRoomChatProps {
  roomId: string
}

export function StudyRoomChat({ roomId }: StudyRoomChatProps) {
  const [room, setRoom] = useState<Room | null>(null)
  const [roomLoading, setRoomLoading] = useState(true)
  const [newMessage, setNewMessage] = useState("")
  const [isSending, setIsSending] = useState(false)
  const [lastSentTime, setLastSentTime] = useState(0)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [currentUserName, setCurrentUserName] = useState<string>("Student")
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [uploadingImage, setUploadingImage] = useState(false)
  const router = useRouter()
  const { toast } = useToast()
  const supabase = createBrowserClient()
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Back button handler
  const handleBack = () => {
    // If available, use router.back(); else fallback to /study-together
    if (window?.history?.length > 1) {
      router.back()
    } else {
      router.push("/study-together")
    }
  }

  const fetchMessages = useCallback(async (): Promise<RealtimeMessage[]> => {
    try {
      const response = await fetch(`/api/study-together/messages?roomId=${roomId}&limit=50`)
      const data = await response.json()

      if (!response.ok) {
        if (response.status === 403) {
          toast({
            title: "Access Denied",
            description: "You need to join this room first",
            variant: "destructive",
          })
          router.push("/study-together")
          return []
        }
        throw new Error(data.error || "Failed to load messages")
      }

      return (data.messages || []).map((m: any) => ({
        ...m,
        sender_name: m.sender_name || "Student",
      }))
    } catch (error: any) {
      console.error("[v0] Error fetching messages:", error)
      return []
    }
  }, [roomId, router, toast])

  const fetchProfile = useCallback(
    async (userId: string) => {
      const { data } = await supabase.from("profiles").select("display_name, avatar_url").eq("id", userId).single()
      return data ? { display_name: data.display_name, avatar_url: data.avatar_url } : null
    },
    [supabase],
  )

  const {
    messages,
    isConnected,
    isReconnecting,
    newMessageCount,
    isLoading,
    scrollAreaRef,
    handleScroll,
    scrollToBottom,
    addOptimisticMessage,
    confirmOptimisticMessage,
    markOptimisticFailed,
    removeFailedMessage,
    retryFailedMessage,
  } = useRealtimeMessages({
    table: "study_room_messages",
    filterKey: "room_id",
    filterValue: roomId,
    fetchMessages,
    fetchProfile,
  })

  useEffect(() => {
    fetchRoomData()
    getCurrentUser()
  }, [roomId])

  const getCurrentUser = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (user) {
      setCurrentUserId(user.id)
      const { data: profile } = await supabase.from("profiles").select("display_name").eq("id", user.id).single()
      setCurrentUserName(profile?.display_name || "Student")
    }
  }

  const fetchRoomData = async () => {
    try {
      const response = await fetch(`/api/study-together/rooms/${roomId}`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to load room")
      }

      setRoom(data.room)
    } catch (error: any) {
      console.error("[v0] Error fetching room:", error)
      toast({
        title: "Error",
        description: error.message || "Failed to load room",
        variant: "destructive",
      })
      router.push("/study-together")
    } finally {
      setRoomLoading(false)
    }
  }

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp"]
    if (!allowedTypes.includes(file.type)) {
      toast({
        title: "Invalid file type",
        description: "Only JPEG, PNG, GIF, and WebP are allowed",
        variant: "destructive",
      })
      return
    }

    // Validate file size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Maximum size is 5MB",
        variant: "destructive",
      })
      return
    }

    setImageFile(file)
    const reader = new FileReader()
    reader.onloadend = () => {
      setImagePreview(reader.result as string)
    }
    reader.readAsDataURL(file)
  }

  const clearImagePreview = () => {
    setImagePreview(null)
    setImageFile(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  const uploadImage = async (): Promise<string | null> => {
    if (!imageFile) return null

    setUploadingImage(true)
    try {
      const formData = new FormData()
      formData.append("image", imageFile)

      const response = await fetch("/api/upload-chat-image", {
        method: "POST",
        body: formData,
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to upload image")
      }

      return data.url
    } catch (error: any) {
      console.error("[v0] Error uploading image:", error)
      toast({
        title: "Upload failed",
        description: error.message || "Failed to upload image",
        variant: "destructive",
      })
      return null
    } finally {
      setUploadingImage(false)
    }
  }

  const handleSendMessage = async (retryNonce?: string, retryContent?: string) => {
    const content = retryContent || newMessage.trim()
    const hasImage = imageFile && imagePreview

    if (!content && !hasImage) return

    // Rate limit: 1.5 seconds between messages
    const now = Date.now()
    if (now - lastSentTime < 1500) {
      toast({
        title: "Slow down",
        description: "Please wait a moment before sending another message",
        variant: "destructive",
      })
      return
    }

    if (content.length > 500) {
      toast({
        title: "Message too long",
        description: "Maximum 500 characters",
        variant: "destructive",
      })
      return
    }

    setIsSending(true)
    setLastSentTime(now)

    // Upload image first if present
    let imageUrl: string | null = null
    if (hasImage && !retryNonce) {
      imageUrl = await uploadImage()
      if (!imageUrl) {
        setIsSending(false)
        return
      }
    }

    // Add optimistic message if not retrying
    const clientNonce =
      retryNonce ||
      (currentUserId ? addOptimisticMessage(content || "🖼️ Image", currentUserId, currentUserName, imageUrl) : null)

    if (!retryNonce) {
      setNewMessage("")
      clearImagePreview()
    }

    try {
      const response = await fetch("/api/study-together/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          room_id: roomId,
          content: content || null,
          image_url: imageUrl,
        }),
      })

      const data = await response.json()

      if (response.ok && clientNonce) {
        confirmOptimisticMessage(clientNonce, data.message?.id || clientNonce)
      } else if (!response.ok) {
        if (clientNonce) markOptimisticFailed(clientNonce)
        toast({
          title: "Error",
          description: data.error || "Failed to send message",
          variant: "destructive",
        })
      }
    } catch (error: any) {
      console.error("[v0] Error sending message:", error)
      if (clientNonce) markOptimisticFailed(clientNonce)
      toast({
        title: "Error",
        description: error.message || "Failed to send message",
        variant: "destructive",
      })
    } finally {
      setIsSending(false)
    }
  }

  const handleCopyInvite = () => {
    if (!room) return
    const inviteLink = `${window.location.origin}/study-together/join?code=${room.invite_code}`
    navigator.clipboard.writeText(inviteLink)
    toast({
      title: "Copied!",
      description: "Invite link copied to clipboard",
    })
  }

  const handleRotateCode = async () => {
    if (!room || !["owner", "admin"].includes(room.user_role)) return

    try {
      const response = await fetch("/api/study-together/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ room_id: roomId }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to rotate code")
      }

      setRoom((prev) => (prev ? { ...prev, invite_code: data.invite_code } : null))
      toast({
        title: "Success",
        description: "Invite code rotated",
      })
    } catch (error: any) {
      console.error("[v0] Error rotating code:", error)
      toast({
        title: "Error",
        description: error.message || "Failed to rotate code",
        variant: "destructive",
      })
    }
  }

  const MessagesSkeleton = () => (
    <div className="space-y-4 p-4">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className={`flex ${i % 2 === 0 ? "justify-end" : "justify-start"}`}>
          <div className="max-w-[70%] space-y-2">
            <Skeleton className="h-3 w-20" />
            <Skeleton className={`h-12 ${i % 2 === 0 ? "w-48" : "w-64"} rounded-2xl`} />
          </div>
        </div>
      ))}
    </div>
  )

  if (roomLoading) {
    return (
      <div className="container mx-auto px-4 py-6 max-w-6xl">
        {/* BACK BUTTON HERE */}
        <Button
          variant="ghost"
          className="mb-4"
          onClick={handleBack}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <Skeleton className="h-12 w-64 mb-6" />
        <Card className="h-[600px]">
          <MessagesSkeleton />
        </Card>
      </div>
    )
  }

  if (!room) {
    return (
      <div className="container mx-auto px-4 py-6 max-w-6xl">
        {/* BACK BUTTON HERE */}
        <Button
          variant="ghost"
          className="mb-4"
          onClick={handleBack}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <Card className="p-6 text-center">
          <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
          <p className="text-foreground">Room not found</p>
          <Button onClick={() => router.push("/study-together")} className="mt-4">
            Back to Rooms
          </Button>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-4 md:py-6 max-w-6xl h-[calc(100dvh-8rem)] md:h-[calc(100dvh-6rem)] flex flex-col overflow-hidden">
      {/* Back Button added here, always visible */}
      <div className="flex items-center mb-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleBack}
          className="flex items-center gap-2 px-2 py-1"
        >
          <ArrowLeft className="h-4 w-4" />
          <span className="hidden sm:inline">Back</span>
        </Button>
      </div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <div className="flex items-center gap-3">
          {/* The following back button is kept only for small screens, for redundancy with the global back; could be removed if desired */}
          <Button variant="ghost" size="icon" onClick={handleBack} className="md:hidden">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl md:text-2xl font-bold text-foreground">{room.name}</h1>
              {isReconnecting ? (
                <RefreshCw className="w-4 h-4 text-yellow-500 animate-spin" />
              ) : isConnected ? (
                <div className="w-2 h-2 rounded-full bg-green-500" title="Connected" />
              ) : (
                <WifiOff className="w-4 h-4 text-muted-foreground" title="Disconnected" />
              )}
            </div>
            {room.subject && <p className="text-sm text-muted-foreground">{room.subject}</p>}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" size="sm">
                <Users className="h-4 w-4 mr-2" />
                <span className="hidden sm:inline">{room.members.length}</span>
              </Button>
            </SheetTrigger>
            <SheetContent>
              <SheetHeader>
                <SheetTitle>Members ({room.members.length})</SheetTitle>
              </SheetHeader>
              <div className="mt-6 space-y-3">
                {room.members.map((member) => (
                  <div key={member.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <span className="text-sm font-medium text-primary">
                          {member.display_name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">{member.display_name}</p>
                        <p className="text-xs text-muted-foreground">{member.role}</p>
                      </div>
                    </div>
                    {member.role === "owner" && (
                      <Badge variant="secondary" className="text-xs">
                        Owner
                      </Badge>
                    )}
                    {member.role === "admin" && (
                      <Badge variant="outline" className="text-xs">
                        Admin
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            </SheetContent>
          </Sheet>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <MoreVertical className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleCopyInvite}>
                <Copy className="h-4 w-4 mr-2" />
                Copy Invite Link
              </DropdownMenuItem>
              {["owner", "admin"].includes(room.user_role) && (
                <DropdownMenuItem onClick={handleRotateCode}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Rotate Invite Code
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Chat Container */}
      <Card className="flex-1 flex flex-col overflow-hidden relative min-h-0">
        {/* Messages */}
        <ScrollArea className="flex-1 min-h-0" ref={scrollAreaRef} onScrollCapture={handleScroll as any}>
          <div className="p-4 space-y-4">
            {isLoading ? (
              <MessagesSkeleton />
            ) : messages.length === 0 ? (
              <div className="h-full flex items-center justify-center py-12">
                <div className="text-center">
                  <p className="text-muted-foreground mb-2">No messages yet</p>
                  <p className="text-sm text-muted-foreground">Start the conversation!</p>
                </div>
              </div>
            ) : (
              <>
                {messages.map((msg) => {
                  const isOwn = msg.user_id === currentUserId
                  const isSystem = msg.type === "system"

                  if (isSystem) {
                    return (
                      <div key={msg.id} className="flex justify-center">
                        <p className="text-xs text-muted-foreground bg-muted px-3 py-1 rounded-full">
                          {msg.sender_name} {msg.content}
                        </p>
                      </div>
                    )
                  }

                  return (
                    <div
                      key={msg.id}
                      className={`flex ${isOwn ? "justify-end" : "justify-start"} ${msg.isOptimistic ? "opacity-70" : ""} ${msg.isFailed ? "opacity-50" : ""}`}
                    >
                      <div
                        className={`max-w-[70%] md:max-w-[60%] ${isOwn ? "items-end" : "items-start"} flex flex-col`}
                      >
                        {!isOwn && <p className="text-xs text-muted-foreground mb-1">{msg.sender_name}</p>}
                        <div
                          className={`px-4 py-2 rounded-2xl ${
                            isOwn ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
                          }`}
                        >
                          {msg.image_url && (
                            <div className="mb-2">
                              <img
                                src={msg.image_url || "/placeholder.svg"}
                                alt="Shared image"
                                className="rounded-lg max-h-48 w-auto object-cover cursor-pointer hover:opacity-90 transition-opacity"
                                onClick={() => window.open(msg.image_url, "_blank")}
                              />
                            </div>
                          )}

                          {msg.content && <p className="text-sm break-words">{msg.content}</p>}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <p className="text-[10px] text-muted-foreground">
                            {msg.isOptimistic
                              ? "Sending..."
                              : new Date(msg.created_at).toLocaleTimeString([], {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                          </p>
                          {msg.isFailed && (
                            <>
                              <span className="text-[10px] text-destructive">Failed</span>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-4 px-1 text-[10px]"
                                onClick={() => {
                                  if (msg.clientNonce) {
                                    retryFailedMessage(msg.clientNonce)
                                    handleSendMessage(msg.clientNonce, msg.content)
                                  }
                                }}
                              >
                                Retry
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-4 px-1 text-[10px] text-destructive"
                                onClick={() => msg.clientNonce && removeFailedMessage(msg.clientNonce)}
                              >
                                Remove
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </>
            )}
          </div>
        </ScrollArea>

        {newMessageCount > 0 && (
          <Button
            onClick={() => scrollToBottom()}
            className="absolute bottom-20 left-1/2 -translate-x-1/2 rounded-full shadow-lg z-10"
            size="sm"
          >
            <ChevronDown className="h-4 w-4 mr-2" />
            {newMessageCount} new {newMessageCount === 1 ? "message" : "messages"}
          </Button>
        )}

        {imagePreview && (
          <div className="border-t bg-background/95 backdrop-blur p-3 flex-shrink-0">
            <div className="relative inline-block">
              <img
                src={imagePreview || "/placeholder.svg"}
                alt="Preview"
                className="max-h-20 rounded-lg border border-border object-cover"
              />
              <Button
                variant="destructive"
                size="icon"
                className="absolute -top-2 -right-2 h-6 w-6 rounded-full"
                onClick={clearImagePreview}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          </div>
        )}

        <div className="p-4 border-t bg-background flex-shrink-0">
          <div className="flex gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
              onChange={handleImageSelect}
              className="hidden"
            />
            <Button
              variant="outline"
              size="icon"
              onClick={() => fileInputRef.current?.click()}
              disabled={isSending || uploadingImage}
            >
              <ImageIcon className="w-4 h-4" />
            </Button>
            <Input
              placeholder="Type a message..."
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSendMessage()}
              disabled={isSending || uploadingImage}
              maxLength={500}
              className="flex-1"
            />
            <Button
              onClick={() => handleSendMessage()}
              disabled={isSending || uploadingImage || (!newMessage.trim() && !imagePreview)}
              size="icon"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            {uploadingImage ? "Uploading image..." : `${newMessage.length}/500 characters • Press Enter to send`}
          </p>
        </div>
      </Card>
    </div>
  )
}

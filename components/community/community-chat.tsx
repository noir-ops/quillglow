"use client"

import type React from "react"

import { useState, useEffect, useCallback, useRef } from "react"
import { createBrowserClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import { Hash, Send, Menu, Flag, ArrowLeft, ChevronDown, RefreshCw, WifiOff, ImageIcon, X } from "lucide-react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { useRealtimeMessages, type RealtimeMessage } from "@/hooks/use-realtime-messages"
import { detectQuillyTrigger, QUILLY, getQuillyAvatar } from "@/lib/quilly"

interface Channel {
  id: string
  slug: string
  name: string
  description: string | null
  is_locked: boolean
}

export function CommunityChat() {
  const [channels, setChannels] = useState<Channel[]>([])
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null)
  const [newMessage, setNewMessage] = useState("")
  const [channelsLoading, setChannelsLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [lastSent, setLastSent] = useState(0)
  const [reportDialog, setReportDialog] = useState(false)
  const [reportMessageId, setReportMessageId] = useState<string | null>(null)
  const [reportReason, setReportReason] = useState("")
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [currentUserName, setCurrentUserName] = useState<string>("Student")
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [quillyTyping, setQuillyTyping] = useState(false)
  const supabase = createBrowserClient()
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const fetchMessages = useCallback(async (): Promise<RealtimeMessage[]> => {
    if (!selectedChannel) return []
    try {
      const response = await fetch(`/api/community/messages?channel_id=${selectedChannel.id}`)
      const data = await response.json()
      if (response.ok) {
        return data.messages || []
      }
    } catch (error) {
      console.error("[v0] Error fetching messages:", error)
    }
    return []
  }, [selectedChannel])

  const fetchProfile = useCallback(
    async (userId: string) => {
      const { data } = await supabase
        .from("user_public_profile")
        .select("display_name, avatar_url")
        .eq("user_id", userId)
        .single()
      return data
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
    setMessages,
  } = useRealtimeMessages({
    table: "community_messages",
    filterKey: "channel_id",
    filterValue: selectedChannel?.id || null,
    fetchMessages,
    fetchProfile,
  })

  useEffect(() => {
    fetchChannels()
    getCurrentUser()
  }, [])

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

  const fetchChannels = async () => {
    try {
      const response = await fetch("/api/community/channels")
      const data = await response.json()

      if (response.ok) {
        setChannels(data.channels)
        if (data.channels.length > 0) {
          setSelectedChannel(data.channels[0])
        }
      }
    } catch (error) {
      console.error("[v0] Error fetching channels:", error)
    } finally {
      setChannelsLoading(false)
    }
  }

  const handleSendMessage = async (retryNonce?: string) => {
    const content = newMessage.trim()
    const hasImage = imageFile && imagePreview

    if (!content && !hasImage) return
    if (!selectedChannel || sending) return

    // Check for Quilly trigger
    const quillyCheck = detectQuillyTrigger(content)

    // Rate limiting
    const now = Date.now()
    if (now - lastSent < 1500) {
      toast.error("Please wait before sending another message")
      return
    }

    setSending(true)
    setLastSent(now)

    // Upload image first if present
    let imageUrl: string | null = null
    if (hasImage && !retryNonce) {
      imageUrl = await uploadImage()
      if (!imageUrl) {
        setSending(false)
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
      const response = await fetch("/api/community/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channel_id: selectedChannel.id,
          content: content || null,
          image_url: imageUrl,
        }),
      })

      const data = await response.json()

      if (response.ok && clientNonce) {
        confirmOptimisticMessage(clientNonce, data.message?.id || clientNonce)
      } else if (!response.ok) {
        if (clientNonce) markOptimisticFailed(clientNonce)
        toast.error(data.error || "Failed to send message")
      }

      if (quillyCheck.isQuilly && response.ok) {
        handleQuillyResponse(quillyCheck.prompt)
      }
    } catch (error) {
      console.error("[v0] Error sending message:", error)
      if (clientNonce) markOptimisticFailed(clientNonce)
      toast.error("Failed to send message")
    } finally {
      setSending(false)
    }
  }

  const handleQuillyResponse = async (prompt: string) => {
    setQuillyTyping(true)

    const typingId = `quilly-typing-${Date.now()}`
    const typingMessage: RealtimeMessage = {
      id: typingId,
      content: "✨ Thinking...",
      created_at: new Date().toISOString(),
      user_id: QUILLY.id,
      sender_name: QUILLY.display_name,
      user_public_profile: {
        display_name: QUILLY.display_name,
        avatar_url: QUILLY.avatar_url,
      },
      isOptimistic: true,
    }

    setMessages((prev) => [...prev, typingMessage])
    scrollToBottom()

    try {
      const response = await fetch("/api/quilly/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          channelName: selectedChannel?.name,
          recentMessages: messages.slice(-3), // Reduced from 5 to 3 for faster response
        }),
      })

      const data = await response.json()

      setMessages((prev) => {
        const filtered = prev.filter((m) => m.id !== typingId)
        const quillyMessage: RealtimeMessage = {
          id: `quilly-${Date.now()}`,
          content: data.response,
          created_at: new Date().toISOString(),
          user_id: QUILLY.id,
          sender_name: QUILLY.display_name,
          user_public_profile: {
            display_name: QUILLY.display_name,
            avatar_url: QUILLY.avatar_url,
          },
        }
        return [...filtered, quillyMessage]
      })

      scrollToBottom()
    } catch (error) {
      console.error("[v0] Quilly error:", error)
      setMessages((prev) => prev.filter((m) => m.id !== typingId))
      toast.error("Quilly is taking a break. Try again in a moment.")
    } finally {
      setQuillyTyping(false)
    }
  }

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const hours = Math.floor(diff / (1000 * 60 * 60))

    if (hours < 1) {
      const minutes = Math.floor(diff / (1000 * 60))
      return minutes < 1 ? "just now" : `${minutes}m ago`
    } else if (hours < 24) {
      return `${hours}h ago`
    } else {
      return date.toLocaleDateString(undefined, { month: "short", day: "numeric" })
    }
  }

  const ChannelList = ({ inSheet = false }: { inSheet?: boolean }) => (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-border">
        <h2 className="font-semibold text-lg">Community Channels</h2>
        <p className="text-sm text-muted-foreground mt-1">Connect with fellow students</p>
      </div>
      <ScrollArea className="flex-1">
        <div className="p-2">
          {channels.map((channel) => (
            <button
              key={channel.id}
              onClick={() => {
                setSelectedChannel(channel)
                if (inSheet) {
                  document.querySelector('[data-state="open"]')?.dispatchEvent(new Event("click"))
                }
              }}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-left transition-colors ${
                selectedChannel?.id === channel.id ? "bg-primary/10 text-primary" : "hover:bg-accent text-foreground"
              }`}
            >
              <Hash className="w-4 h-4 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{channel.name}</div>
                {channel.description && (
                  <div className="text-xs text-muted-foreground truncate">{channel.description}</div>
                )}
              </div>
            </button>
          ))}
        </div>
      </ScrollArea>
    </div>
  )

  const MessagesSkeleton = () => (
    <div className="space-y-4 p-4">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="flex gap-3">
          <Skeleton className="w-10 h-10 rounded-full shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        </div>
      ))}
    </div>
  )

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp"]
    if (!allowedTypes.includes(file.type)) {
      toast.error("Invalid file type. Only JPEG, PNG, GIF, and WebP are allowed")
      return
    }

    // Validate file size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error("File too large. Maximum size is 5MB")
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

      const contentType = response.headers.get("content-type")
      if (!contentType?.includes("application/json")) {
        console.error("[v0] API returned non-JSON response:", await response.text())
        throw new Error("Server error. Check your environment variables and Supabase configuration.")
      }

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to upload image")
      }

      return data.url
    } catch (error: any) {
      console.error("[v0] Error uploading image:", error)
      toast.error(error.message || "Failed to upload image. Check console for details.")
      return null
    } finally {
      setUploadingImage(false)
    }
  }

  const handleReport = async () => {
    if (!reportMessageId || !reportReason.trim()) return

    try {
      const response = await fetch("/api/community/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message_id: reportMessageId,
          reason: reportReason,
        }),
      })

      if (response.ok) {
        toast.success("Message reported. Thank you for keeping our community safe.")
        setReportDialog(false)
        setReportMessageId(null)
        setReportReason("")
      } else {
        toast.error("Failed to report message")
      }
    } catch (error) {
      console.error("[v0] Error reporting message:", error)
      toast.error("Failed to report message")
    }
  }

  if (channelsLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    )
  }

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Desktop Channel Sidebar */}
      <div className="hidden sm:block w-64 border-r border-border bg-card">
        {/* Add a back button above the channel list for desktop */}
        <div className="p-4 border-b border-border flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              // You might want to change the path here if you want different back navigation
              router.back()
            }}
            aria-label="Go Back"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <span className="font-semibold text-lg">Back</span>
        </div>
        <ChannelList />
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Channel Header */}
        <div className="h-14 border-b border-border flex items-center px-4 gap-3 bg-card">
          {/* Mobile Menu + Back Button */}
          <div className="flex items-center gap-2 sm:hidden">
            <Button variant="ghost" size="icon" onClick={() => router.push("/study-together")}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon">
                  <Menu className="w-5 h-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="p-0 w-72">
                {/* Add a back button on mobile sidebar drawer as well */}
                <div className="p-4 border-b border-border flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      router.back()
                    }}
                    aria-label="Go Back"
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </Button>
                  <span className="font-semibold text-lg">Back</span>
                </div>
                <ChannelList inSheet />
              </SheetContent>
            </Sheet>
          </div>

          {selectedChannel && (
            <>
              <Hash className="w-5 h-5 text-muted-foreground" />
              <div className="flex-1 min-w-0">
                <h1 className="font-semibold truncate">{selectedChannel.name}</h1>
                {selectedChannel.description && (
                  <p className="text-xs text-muted-foreground truncate">{selectedChannel.description}</p>
                )}
              </div>
              <div className="flex items-center gap-1">
                {isReconnecting ? (
                  <div className="flex items-center gap-1 text-yellow-500 text-xs">
                    <RefreshCw className="w-3 h-3 animate-spin" />
                    <span className="hidden sm:inline">Reconnecting...</span>
                  </div>
                ) : isConnected ? (
                  <div className="w-2 h-2 rounded-full bg-green-500" title="Connected" />
                ) : (
                  <WifiOff className="w-4 h-4 text-muted-foreground" title="Disconnected" />
                )}
              </div>
            </>
          )}
        </div>

        {/* Messages Area */}
        <div className="flex-1 relative overflow-hidden">
          <ScrollArea className="h-full" ref={scrollAreaRef} onScrollCapture={handleScroll as any}>
            <div className="max-w-4xl mx-auto p-4">
              {isLoading ? (
                <MessagesSkeleton />
              ) : messages.length === 0 ? (
                <div className="text-center text-muted-foreground py-12">
                  <Hash className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No messages yet. Start the conversation!</p>
                  <p className="text-sm mt-2">
                    💡 Type <span className="font-mono bg-muted px-2 py-1 rounded">quilly</span> to chat with our AI
                    study buddy!
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {messages.map((message) => {
                    const isQuilly = message.user_id === QUILLY.id

                    return (
                      <div
                        key={message.id}
                        className={`flex gap-3 group ${message.isOptimistic ? "opacity-70" : ""} ${message.isFailed ? "opacity-50" : ""} ${
                          isQuilly
                            ? "bg-rose-50/30 dark:bg-rose-950/20 -mx-2 px-2 py-3 rounded-lg animate-in fade-in duration-200"
                            : ""
                        }`}
                      >
                        <div
                          className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold shrink-0 ${
                            isQuilly
                              ? "bg-gradient-to-br from-rose-400 via-rose-500 to-rose-600 ring-2 ring-rose-200 dark:ring-rose-800"
                              : "bg-gradient-to-br from-blue-500 to-purple-500"
                          }`}
                        >
                          {isQuilly ? (
                            <img
                              src={getQuillyAvatar() || "/placeholder.svg"}
                              alt={QUILLY.display_name}
                              className="w-full h-full rounded-full"
                            />
                          ) : message.user_public_profile?.avatar_url ? (
                            <img
                              src={message.user_public_profile.avatar_url || "/placeholder.svg"}
                              alt={message.user_public_profile.display_name}
                              className="w-full h-full rounded-full object-cover"
                            />
                          ) : (
                            (message.user_public_profile?.display_name || message.sender_name || "U")
                              .charAt(0)
                              .toUpperCase()
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-baseline gap-2 flex-wrap">
                            <span
                              className={`font-semibold ${isQuilly ? "text-rose-600 dark:text-rose-400" : "text-foreground"}`}
                            >
                              {message.user_public_profile?.display_name || message.sender_name || "Unknown User"}
                            </span>
                            {isQuilly && (
                              <span className="text-xs bg-gradient-to-r from-rose-100 to-pink-100 dark:from-rose-900/40 dark:to-pink-900/40 text-rose-700 dark:text-rose-300 px-2 py-0.5 rounded-full font-medium border border-rose-200/50 dark:border-rose-700/50">
                                AI Study Buddy
                              </span>
                            )}
                            <span className="text-xs text-muted-foreground">
                              {message.isOptimistic ? "Sending..." : formatTime(message.created_at)}
                            </span>
                            {message.isFailed && (
                              <div className="flex items-center gap-1">
                                <span className="text-xs text-destructive">Failed</span>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-5 px-2 text-xs"
                                  onClick={() => {
                                    if (message.clientNonce) {
                                      retryFailedMessage(message.clientNonce)
                                      handleSendMessage(message.clientNonce)
                                    }
                                  }}
                                >
                                  Retry
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-5 px-2 text-xs text-destructive"
                                  onClick={() => message.clientNonce && removeFailedMessage(message.clientNonce)}
                                >
                                  Remove
                                </Button>
                              </div>
                            )}
                            {!message.isOptimistic && !message.isFailed && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="w-6 h-6 opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={() => {
                                  setReportMessageId(message.id)
                                  setReportDialog(true)
                                }}
                              >
                                <Flag className="w-3 h-3" />
                              </Button>
                            )}
                          </div>
                          {message.image_url && (
                            <div className="mt-2 max-w-sm">
                              <img
                                src={message.image_url || "/placeholder.svg"}
                                alt="Shared image"
                                className="rounded-lg border border-border max-h-64 w-auto object-cover cursor-pointer hover:opacity-90 transition-opacity"
                                onClick={() => window.open(message.image_url, "_blank")}
                              />
                            </div>
                          )}
                          {message.content && (
                            <p className="text-foreground/90 break-words whitespace-pre-wrap">{message.content}</p>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </ScrollArea>

          {newMessageCount > 0 && (
            <Button
              onClick={() => scrollToBottom()}
              className="absolute bottom-4 left-1/2 -translate-x-1/2 shadow-lg gap-2"
              size="sm"
            >
              <ChevronDown className="w-4 h-4" />
              {newMessageCount} new message{newMessageCount > 1 ? "s" : ""}
            </Button>
          )}
        </div>

        {/* Message Input */}
        <div className="p-4 border-t border-border bg-card">
          <div className="max-w-4xl mx-auto">
            {imagePreview && (
              <div className="mb-2 relative inline-block">
                <img
                  src={imagePreview || "/placeholder.svg"}
                  alt="Preview"
                  className="max-h-32 rounded-lg border border-border"
                />
                <Button
                  variant="destructive"
                  size="icon"
                  className="absolute -top-2 -right-2 h-6 w-6"
                  onClick={clearImagePreview}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            )}

            <div className="flex gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
                className="hidden"
                onChange={handleImageSelect}
              />
              <Button
                variant="outline"
                size="icon"
                onClick={() => fileInputRef.current?.click()}
                disabled={sending || uploadingImage}
              >
                <ImageIcon className="w-4 h-4" />
              </Button>
              <Input
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder={
                  quillyTyping ? "Quilly is thinking..." : "Type quilly to chat with AI, or message the community..."
                }
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSendMessage()}
                disabled={sending || uploadingImage || quillyTyping}
                className="flex-1"
              />
              <Button onClick={() => handleSendMessage()} disabled={sending || uploadingImage || quillyTyping}>
                <Send className="w-4 h-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              💡 Type <span className="font-mono">quilly</span>, <span className="font-mono">quilly:</span>, or{" "}
              <span className="font-mono">@quilly</span> to ask the AI study buddy
            </p>
          </div>
        </div>
      </div>

      {/* Report Dialog */}
      <Dialog open={reportDialog} onOpenChange={setReportDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Report Message</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Textarea
              value={reportReason}
              onChange={(e) => setReportReason(e.target.value)}
              placeholder="Please describe why you're reporting this message..."
              rows={4}
            />
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setReportDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleReport} disabled={!reportReason.trim()}>
                Submit Report
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

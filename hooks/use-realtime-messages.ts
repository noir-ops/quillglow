"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { createBrowserClient } from "@/lib/supabase/client"

export interface RealtimeMessage {
  id: string
  content: string
  created_at: string
  user_id: string | null
  type?: "user" | "system"
  image_url?: string | null
  // For optimistic messages
  isOptimistic?: boolean
  isFailed?: boolean
  clientNonce?: string
  // Profile data
  sender_name?: string
  user_public_profile?: {
    display_name: string
    avatar_url: string | null
  }
}

interface UseRealtimeMessagesParams {
  table: "community_messages" | "study_room_messages"
  filterKey: "channel_id" | "room_id"
  filterValue: string | null
  fetchMessages: () => Promise<RealtimeMessage[]>
  fetchProfile?: (userId: string) => Promise<{ display_name: string; avatar_url: string | null } | null>
}

const MAX_MESSAGES = 200

export function useRealtimeMessages({
  table,
  filterKey,
  filterValue,
  fetchMessages,
  fetchProfile,
}: UseRealtimeMessagesParams) {
  const [messages, setMessages] = useState<RealtimeMessage[]>([])
  const [isConnected, setIsConnected] = useState(false)
  const [isReconnecting, setIsReconnecting] = useState(false)
  const [pendingCount, setPendingCount] = useState(0)
  const [isNearBottom, setIsNearBottom] = useState(true)
  const [newMessageCount, setNewMessageCount] = useState(0)
  const [isLoading, setIsLoading] = useState(true)

  const supabase = createBrowserClient()
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)
  const scrollAreaRef = useRef<HTMLDivElement | null>(null)
  const optimisticIdsRef = useRef<Set<string>>(new Set())
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null)

  // Track scroll position
  const handleScroll = useCallback((e: Event) => {
    const target = e.target as HTMLDivElement
    const threshold = 100
    const nearBottom = target.scrollHeight - target.scrollTop - target.clientHeight < threshold
    setIsNearBottom(nearBottom)
    if (nearBottom) {
      setNewMessageCount(0)
    }
  }, [])

  // Scroll to bottom
  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    if (scrollAreaRef.current) {
      const scrollContainer =
        scrollAreaRef.current.querySelector("[data-radix-scroll-area-viewport]") || scrollAreaRef.current
      scrollContainer.scrollTo({
        top: scrollContainer.scrollHeight,
        behavior,
      })
    }
    setNewMessageCount(0)
  }, [])

  // Initial fetch
  useEffect(() => {
    if (!filterValue) return

    const loadMessages = async () => {
      setIsLoading(true)
      try {
        const msgs = await fetchMessages()
        setMessages(msgs.slice(-MAX_MESSAGES))
        setTimeout(() => scrollToBottom("instant"), 100)
      } catch (error) {
        console.error("[v0] Error loading messages:", error)
      } finally {
        setIsLoading(false)
      }
    }

    loadMessages()
  }, [filterValue, fetchMessages, scrollToBottom])

  // Realtime subscription
  useEffect(() => {
    if (!filterValue) return

    // Cleanup previous subscription
    if (channelRef.current) {
      channelRef.current.unsubscribe()
      channelRef.current = null
    }

    const channelName = `${table}:${filterValue}`
    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table,
          filter: `${filterKey}=eq.${filterValue}`,
        },
        async (payload) => {
          const newMsg = payload.new as RealtimeMessage

          // Check if this is our optimistic message
          if (optimisticIdsRef.current.has(newMsg.id)) {
            // Replace optimistic with real message
            setMessages((prev) =>
              prev.map((m) => (m.clientNonce && m.isOptimistic ? { ...newMsg, isOptimistic: false } : m)),
            )
            optimisticIdsRef.current.delete(newMsg.id)
            return
          }

          // Check for duplicates
          setMessages((prev) => {
            if (prev.some((m) => m.id === newMsg.id)) {
              return prev
            }

            // Fetch profile if needed
            if (fetchProfile && newMsg.user_id) {
              fetchProfile(newMsg.user_id).then((profile) => {
                if (profile) {
                  setMessages((current) =>
                    current.map((m) =>
                      m.id === newMsg.id
                        ? {
                            ...m,
                            sender_name: profile.display_name,
                            user_public_profile: profile,
                          }
                        : m,
                    ),
                  )
                }
              })
            }

            const updated = [...prev, newMsg].slice(-MAX_MESSAGES)

            // Handle scroll
            if (isNearBottom) {
              setTimeout(() => scrollToBottom(), 50)
            } else {
              setNewMessageCount((c) => c + 1)
            }

            return updated
          })
        },
      )
      .on("system", { event: "*" }, (status) => {
        if (status.eventType === "connected") {
          setIsConnected(true)
          setIsReconnecting(false)
          // Clear fallback polling
          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current)
            pollIntervalRef.current = null
          }
        } else if (status.eventType === "disconnected") {
          setIsConnected(false)
          setIsReconnecting(true)
          // Start fallback polling
          if (!pollIntervalRef.current) {
            pollIntervalRef.current = setInterval(async () => {
              try {
                const msgs = await fetchMessages()
                setMessages((prev) => {
                  const existingIds = new Set(prev.map((m) => m.id))
                  const newMsgs = msgs.filter((m) => !existingIds.has(m.id))
                  if (newMsgs.length > 0) {
                    const updated = [...prev, ...newMsgs].slice(-MAX_MESSAGES)
                    if (isNearBottom) {
                      setTimeout(() => scrollToBottom(), 50)
                    } else {
                      setNewMessageCount((c) => c + newMsgs.length)
                    }
                    return updated
                  }
                  return prev
                })
              } catch (error) {
                console.error("[v0] Polling error:", error)
              }
            }, 15000)
          }
        }
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          setIsConnected(true)
        }
      })

    channelRef.current = channel

    return () => {
      if (channelRef.current) {
        channelRef.current.unsubscribe()
        channelRef.current = null
      }
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current)
        pollIntervalRef.current = null
      }
    }
  }, [filterValue, table, filterKey, fetchMessages, fetchProfile, isNearBottom, scrollToBottom, supabase])

  // Add optimistic message
  const addOptimisticMessage = useCallback(
    (content: string, userId: string, senderName: string, imageUrl?: string | null) => {
      const clientNonce = `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      const optimisticMsg: RealtimeMessage = {
        id: clientNonce,
        content,
        created_at: new Date().toISOString(),
        user_id: userId,
        type: "user",
        image_url: imageUrl,
        isOptimistic: true,
        clientNonce,
        sender_name: senderName,
        user_public_profile: {
          display_name: senderName,
          avatar_url: null,
        },
      }

      setMessages((prev) => [...prev, optimisticMsg].slice(-MAX_MESSAGES))
      setPendingCount((c) => c + 1)

      if (isNearBottom) {
        setTimeout(() => scrollToBottom(), 50)
      }

      return clientNonce
    },
    [isNearBottom, scrollToBottom],
  )

  // Confirm optimistic message (replace with real)
  const confirmOptimisticMessage = useCallback((clientNonce: string, realId: string) => {
    optimisticIdsRef.current.add(realId)
    setMessages((prev) =>
      prev.map((m) => (m.clientNonce === clientNonce ? { ...m, id: realId, isOptimistic: false } : m)),
    )
    setPendingCount((c) => Math.max(0, c - 1))
  }, [])

  // Mark optimistic message as failed
  const markOptimisticFailed = useCallback((clientNonce: string) => {
    setMessages((prev) =>
      prev.map((m) => (m.clientNonce === clientNonce ? { ...m, isFailed: true, isOptimistic: false } : m)),
    )
    setPendingCount((c) => Math.max(0, c - 1))
  }, [])

  // Remove failed message
  const removeFailedMessage = useCallback((clientNonce: string) => {
    setMessages((prev) => prev.filter((m) => m.clientNonce !== clientNonce))
  }, [])

  // Retry failed message
  const retryFailedMessage = useCallback((clientNonce: string) => {
    setMessages((prev) =>
      prev.map((m) => (m.clientNonce === clientNonce ? { ...m, isFailed: false, isOptimistic: true } : m)),
    )
    setPendingCount((c) => c + 1)
  }, [])

  return {
    messages,
    setMessages, // Export setMessages so Quilly can inject responses
    isConnected,
    isReconnecting,
    pendingCount,
    newMessageCount,
    isLoading,
    isNearBottom,
    scrollAreaRef,
    handleScroll,
    scrollToBottom,
    addOptimisticMessage,
    confirmOptimisticMessage,
    markOptimisticFailed,
    removeFailedMessage,
    retryFailedMessage,
  }
}

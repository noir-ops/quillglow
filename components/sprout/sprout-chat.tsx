"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { ChatMarkdown } from "@/components/chat/chat-markdown"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Loader2, MessageSquarePlus, Sparkles, Trash2 } from "lucide-react"

interface Msg {
  role: "user" | "assistant"
  content: string
  sources?: Array<{ id: number; namespace: string; snippet: string }>
}

interface SessionSummary {
  id: string
  title: string
  subject: string | null
  message_count: number
  updated_at: string
}

export function SproutChat({ subject, syllabus }: { subject?: string; syllabus?: string }) {
  const [sessions, setSessions] = useState<SessionSummary[]>([])
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Msg[]>([])
  const [input, setInput] = useState("")
  const [busy, setBusy] = useState(false)
  const [loadingHistory, setLoadingHistory] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const endRef = useRef<HTMLDivElement>(null)

  const loadSessions = useCallback(async () => {
    const res = await fetch("/api/sprout/sessions")
    const data = await res.json()
    return (data.sessions ?? []) as SessionSummary[]
  }, [])

  const loadSession = useCallback(async (id: string) => {
    const res = await fetch(`/api/sprout/sessions/${id}`)
    if (!res.ok) return null
    const data = await res.json()
    return data.session
  }, [])

  // On mount: load the chat list, then open the most recent conversation (if
  // any) so a returning student sees where they left off instead of a blank
  // screen. Falls back to a fresh, unsaved conversation with no history.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const list = await loadSessions()
      if (cancelled) return
      setSessions(list)

      if (list.length > 0) {
        const full = await loadSession(list[0].id)
        if (cancelled) return
        if (full) {
          setSessionId(full.id)
          setMessages(
            (full.messages ?? []).map((m: any) => ({ role: m.role, content: m.content, sources: m.sources })),
          )
        }
      }
      setLoadingHistory(false)
    })()
    return () => {
      cancelled = true
    }
  }, [loadSessions, loadSession])

  const openSession = async (id: string) => {
    if (id === sessionId || busy) return
    setLoadingHistory(true)
    const full = await loadSession(id)
    if (full) {
      setSessionId(full.id)
      setMessages((full.messages ?? []).map((m: any) => ({ role: m.role, content: m.content, sources: m.sources })))
    }
    setLoadingHistory(false)
  }

  const startNewChat = () => {
    if (busy) return
    setSessionId(null)
    setMessages([])
    setError(null)
  }

  const deleteChat = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    await fetch(`/api/sprout/sessions/${id}`, { method: "DELETE" })
    setSessions((s) => s.filter((x) => x.id !== id))
    if (id === sessionId) startNewChat()
  }

  const send = async () => {
    const text = input.trim()
    if (!text || busy) return

    setMessages((m) => [...m, { role: "user", content: text }])
    setInput("")
    setBusy(true)
    setError(null)

    try {
      const res = await fetch("/api/sprout/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, sessionId, subject, syllabus }),
      })
      const data = await res.json()

      if (res.status === 429) {
        setError(data.message ?? "You've reached your monthly limit.")
        return
      }
      if (!res.ok) throw new Error(data.error ?? "Request failed")

      setMessages((m) => [...m, { role: "assistant", content: data.reply, sources: data.sources }])

      // First message in a fresh conversation: the server created a session —
      // adopt its id and refresh the list so the new chat appears in history.
      if (!sessionId && data.sessionId) {
        setSessionId(data.sessionId)
        setSessions(await loadSessions())
      } else if (sessionId) {
        setSessions((prev) =>
          prev
            .map((s) => (s.id === sessionId ? { ...s, message_count: s.message_count + 2, updated_at: new Date().toISOString() } : s))
            .sort((a, b) => (a.id === sessionId ? -1 : b.id === sessionId ? 1 : 0)),
        )
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong")
    } finally {
      setBusy(false)
      requestAnimationFrame(() => endRef.current?.scrollIntoView({ behavior: "smooth" }))
    }
  }

  return (
    <div className="flex h-[560px] gap-4">
      {/* History sidebar */}
      <Card className="hidden w-64 shrink-0 flex-col sm:flex">
        <div className="border-b p-3">
          <Button variant="outline" size="sm" className="w-full justify-start" onClick={startNewChat}>
            <MessageSquarePlus className="mr-2 h-4 w-4" />
            New chat
          </Button>
        </div>
        <ScrollArea className="flex-1">
          <div className="space-y-1 p-2">
            {sessions.length === 0 && (
              <p className="p-2 text-xs text-muted-foreground">Your past conversations will appear here.</p>
            )}
            {sessions.map((s) => (
              <button
                key={s.id}
                onClick={() => openSession(s.id)}
                className={`group flex w-full items-center justify-between gap-2 rounded-md px-2 py-2 text-left text-sm transition-colors ${
                  s.id === sessionId ? "bg-accent" : "hover:bg-accent/50"
                }`}
              >
                <span className="truncate">{s.title}</span>
                <Trash2
                  className="h-3.5 w-3.5 shrink-0 opacity-0 text-muted-foreground hover:text-destructive group-hover:opacity-100"
                  onClick={(e) => deleteChat(s.id, e)}
                />
              </button>
            ))}
          </div>
        </ScrollArea>
      </Card>

      {/* Conversation */}
      <Card className="flex flex-1 flex-col">
        <CardContent className="flex-1 space-y-4 overflow-y-auto p-4">
          {loadingHistory ? (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading your conversation…
            </div>
          ) : messages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-center text-sm text-muted-foreground">
              <Sparkles className="mb-2 h-8 w-8 opacity-40" />
              <p className="font-medium">Sprout helps you work things out</p>
              <p className="mt-1 max-w-xs">
                Ask about anything you&apos;re stuck on. Sprout won&apos;t just hand you the answer.
              </p>
            </div>
          ) : (
            messages.map((m, i) => (
              <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
                <div
                  className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                    m.role === "user" ? "whitespace-pre-wrap bg-primary text-primary-foreground" : "bg-muted"
                  }`}
                >
                  {m.role === "assistant" ? <ChatMarkdown content={m.content} /> : m.content}
                  {m.sources && m.sources.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1 border-t pt-2">
                      {m.sources.map((s) => (
                        <Badge key={s.id} variant="secondary" className="text-[10px]">
                          {s.namespace.replace("syllabus_", "").toUpperCase()}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))
          )}

          {busy && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Sprout is thinking…
            </div>
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div ref={endRef} />
        </CardContent>

        <div className="flex gap-2 border-t p-3">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), send())}
            placeholder="What are you working on?"
            disabled={busy || loadingHistory}
          />
          <Button onClick={send} disabled={busy || loadingHistory || !input.trim()}>
            Send
          </Button>
        </div>
      </Card>
    </div>
  )
}

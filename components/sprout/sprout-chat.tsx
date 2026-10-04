"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { ChatMarkdown } from "@/components/chat/chat-markdown"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { ChevronLeft, ChevronRight, History, Loader2, MessageSquarePlus, Sparkles, Trash2 } from "lucide-react"

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

/**
 * One badge per distinct source, not one per retrieved passage.
 *
 * A reply is grounded in several passages (often 6-8) that all come from the
 * same syllabus, and the old code printed a badge for every passage — so an
 * answer ended with "IGCSE IGCSE IGCSE IGCSE IGCSE IGCSE IGCSE IGCSE". Shown
 * once each now, in first-seen order. Applied at render time, so it also
 * cleans up conversations that were saved before this fix.
 */
function sourceLabels(sources: Msg["sources"]): string[] {
  const seen = new Set<string>()
  for (const src of sources ?? []) {
    seen.add(
      src.namespace.startsWith("syllabus_")
        ? src.namespace.replace(/^syllabus_/, "").toUpperCase()
        : src.namespace === "user_upload"
          ? "Your uploads"
          : src.namespace,
    )
  }
  return Array.from(seen)
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
  // Desktop: the chat list can be folded away to give the conversation the
  // full width (same idea as the notes list). Mobile has its own toggle.
  const [collapsed, setCollapsed] = useState(false)
  const [mobileHistoryOpen, setMobileHistoryOpen] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

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
    setMobileHistoryOpen(false)
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
    setMobileHistoryOpen(false)
    if (busy) return
    setSessionId(null)
    setMessages([])
    setError(null)
  }

  const deleteChat = async (chat: SessionSummary) => {
    if (!confirm(`Delete "${chat.title}"? This can't be undone.`)) return
    setDeletingId(chat.id)
    setError(null)
    try {
      const res = await fetch(`/api/sprout/sessions/${chat.id}`, { method: "DELETE" })
      // Previously the chat was removed from the list without checking the
      // response, so a failed delete looked like it worked and the chat came
      // back on the next visit.
      if (!res.ok) throw new Error("Could not delete that chat. Please try again.")
      setSessions((prev) => prev.filter((x) => x.id !== chat.id))
      if (chat.id === sessionId) startNewChat()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete that chat.")
    } finally {
      setDeletingId(null)
    }
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

  // Shared by the desktop panel and the mobile list. The delete control is a
  // real, always-visible button next to the title — it used to be a 14px icon
  // that only appeared on hover, which never happens on a touch screen.
  const renderChatList = () => (
    <div className="space-y-1 p-2">
      {sessions.length === 0 && (
        <p className="p-2 text-xs text-muted-foreground">Your past conversations will appear here.</p>
      )}
      {sessions.map((s) => {
        const active = s.id === sessionId
        return (
          <div
            key={s.id}
            className={`flex items-start gap-1 rounded-md transition-colors ${active ? "bg-accent" : "hover:bg-accent/50"}`}
          >
            <button
              onClick={() => openSession(s.id)}
              title={s.title}
              // Full title, wrapping onto as many lines as it needs (it used
              // to be cut off with "…").
              className="min-w-0 flex-1 whitespace-normal break-words px-2 py-2 text-left text-sm leading-snug"
            >
              {s.title}
            </button>
            <button
              onClick={() => deleteChat(s)}
              disabled={deletingId === s.id || (busy && active)}
              aria-label={`Delete chat: ${s.title}`}
              title="Delete chat"
              className="mr-1 mt-1 shrink-0 rounded p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-40"
            >
              {deletingId === s.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
            </button>
          </div>
        )
      })}
    </div>
  )

  return (
    <div className="flex h-[560px]">
      {/* History panel (tablet/desktop) — collapsible. Margin rather than a
          flex gap, so a folded panel doesn't leave a blank strip behind. */}
      <div className={`relative hidden shrink-0 transition-all duration-200 sm:block ${collapsed ? "mr-0" : "mr-4"}`}>
        <div className={`h-full overflow-hidden transition-all duration-200 ${collapsed ? "w-0" : "w-64"}`}>
          <Card className="flex h-full w-64 flex-col">
            <div className="border-b p-3">
              <Button variant="outline" size="sm" className="w-full justify-start" onClick={startNewChat}>
                <MessageSquarePlus className="mr-2 h-4 w-4" />
                New chat
              </Button>
            </div>
            <ScrollArea className="flex-1">{renderChatList()}</ScrollArea>
          </Card>
        </div>
        {/* Sits outside the clipped area so it stays clickable when folded. */}
        <button
          onClick={() => setCollapsed((c) => !c)}
          aria-label={collapsed ? "Show chat list" : "Hide chat list"}
          title={collapsed ? "Show chat list" : "Hide chat list"}
          className={`absolute top-1/2 z-10 flex h-12 w-4 -translate-y-1/2 items-center justify-center rounded-r-md border border-l-0 bg-card text-muted-foreground transition-colors hover:bg-accent hover:text-foreground ${
            collapsed ? "left-0" : "left-full"
          }`}
        >
          {collapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />}
        </button>
      </div>

      {/* Conversation */}
      <Card className="flex min-w-0 flex-1 flex-col">
        {/* Phones have no side panel, so history and New chat live up here.
            Before this, a phone had no way to switch, start or delete a chat. */}
        <div className="flex items-center gap-2 border-b p-2 sm:hidden">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setMobileHistoryOpen((o) => !o)}>
            <History className="h-4 w-4" />
            History{sessions.length > 0 ? ` (${sessions.length})` : ""}
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={startNewChat}>
            <MessageSquarePlus className="h-4 w-4" />
            New chat
          </Button>
        </div>

        {mobileHistoryOpen && <div className="flex-1 overflow-y-auto sm:hidden">{renderChatList()}</div>}

        <CardContent className={`flex-1 space-y-4 overflow-y-auto p-4 ${mobileHistoryOpen ? "hidden sm:block" : ""}`}>
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
            messages.map((m, i) => {
              const labels = sourceLabels(m.sources)
              return (
                <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
                  <div
                    className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                      m.role === "user" ? "whitespace-pre-wrap bg-primary text-primary-foreground" : "bg-muted"
                    }`}
                  >
                    {m.role === "assistant" ? <ChatMarkdown content={m.content} /> : m.content}
                    {labels.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1 border-t pt-2">
                        {labels.map((label) => (
                          <Badge key={label} variant="secondary" className="text-[10px]">
                            {label}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )
            })
          )}

          {busy && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Sprout is thinking…
            </div>
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div ref={endRef} />
        </CardContent>

        <div className={`gap-2 border-t p-3 ${mobileHistoryOpen ? "hidden sm:flex" : "flex"}`}>
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

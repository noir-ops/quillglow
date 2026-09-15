"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { AppLayout } from "@/components/dashboard/app-layout"
import { ChatMarkdown } from "@/components/chat/chat-markdown"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Brain,
  HelpCircle,
  Sparkles,
  Send,
  RotateCcw,
  Loader2,
  User,
  Bot,
  ChevronDown,
  BookOpen,
  Lightbulb,
  Star,
  FileText,
  ClipboardList,
  BarChart3,
  GraduationCap,
  Headphones,
  CheckSquare,
  BookMarked,
  X,
  ChevronRight,
  Layers,
  FlaskConical,
  ArrowLeft,
  History,
  Clock,
  MessageSquare,
  Play,
  AlertTriangle,
  Zap,
  Lock,
  TrendingDown,
} from "lucide-react"
import { MemoryPanel } from "@/components/echomind/memory-panel"

type EchoMode = "my_knowledge" | "confusion_history" | "future_me"
type ViewState = "setup" | "session" | "history" | "history_detail" | "memory"

interface Message {
  role: "user" | "assistant"
  content: string
}

interface SelectedRef {
  type: string
  id: string
  label: string
  meta?: string
  data: Record<string, any>
}

interface LogEntry {
  id: string
  query: string
  mode: EchoMode
  response: string
  context_summary: string | null
  created_at: string
}

interface SessionGroup {
  topic: string
  mode: EchoMode
  date: string
  messages: { query: string; response: string; created_at: string }[]
}

interface UsageInfo {
  isGenius: boolean
  unlimited: boolean
  used: number
  limit: number | null
  remaining: number | null
  resetDate: string | null
}

const MODES: {
  id: EchoMode
  label: string
  tagline: string
  icon: React.ReactNode
  description: string
  accent: string
  glow: string
  pill: string
  placeholder: string
}[] = [
  {
    id: "my_knowledge",
    label: "Explain From My Knowledge",
    tagline: "Test what you know",
    icon: <Brain className="h-5 w-5" />,
    description: "Explain the topic as if you already know it. EchoMind listens, fills gaps, and reinforces your understanding.",
    accent: "from-blue-500/15 via-indigo-500/8 to-transparent border-blue-500/25 hover:border-blue-500/50",
    glow: "shadow-blue-500/10",
    pill: "bg-blue-500/15 text-blue-400 border-blue-500/25",
    placeholder: "What topic do you want to explain? e.g. Mitosis, Newton's Second Law...",
  },
  {
    id: "confusion_history",
    label: "Where I Was Confused",
    tagline: "Revisit sticking points",
    icon: <HelpCircle className="h-5 w-5" />,
    description: "Revisit a concept that tripped you up before. EchoMind addresses the specific confusion with a memory hook.",
    accent: "from-amber-500/15 via-orange-500/8 to-transparent border-amber-500/25 hover:border-amber-500/50",
    glow: "shadow-amber-500/10",
    pill: "bg-amber-500/15 text-amber-400 border-amber-500/25",
    placeholder: "What concept confused you? e.g. Integration by parts...",
  },
  {
    id: "future_me",
    label: "Future Me — Mastered",
    tagline: "Own your future knowledge",
    icon: <Sparkles className="h-5 w-5" />,
    description: "Imagine you have already mastered this topic. EchoMind shows you what that looks like — and challenges you.",
    accent: "from-violet-500/15 via-purple-500/8 to-transparent border-violet-500/25 hover:border-violet-500/50",
    glow: "shadow-violet-500/10",
    pill: "bg-violet-500/15 text-violet-400 border-violet-500/25",
    placeholder: "What do you want to master? e.g. Organic chemistry, SQL joins...",
  },
]

const MODE_ICON_MAP: Record<EchoMode, React.ReactNode> = {
  my_knowledge: <BookOpen className="h-4 w-4" />,
  confusion_history: <Lightbulb className="h-4 w-4" />,
  future_me: <Star className="h-4 w-4" />,
}

const MODE_LABEL_MAP: Record<EchoMode, string> = {
  my_knowledge: "Explain From My Knowledge",
  confusion_history: "Where I Was Confused",
  future_me: "Future Me",
}

const MODE_PILL_MAP: Record<EchoMode, string> = {
  my_knowledge: "bg-blue-500/12 text-blue-400 border-blue-500/20",
  confusion_history: "bg-amber-500/12 text-amber-400 border-amber-500/20",
  future_me: "bg-violet-500/12 text-violet-400 border-violet-500/20",
}

const MODE_GLOW_MAP: Record<EchoMode, string> = {
  my_knowledge: "border-blue-500/30 shadow-blue-500/8",
  confusion_history: "border-amber-500/30 shadow-amber-500/8",
  future_me: "border-violet-500/30 shadow-violet-500/8",
}

const REF_GROUPS = [
  { key: "exams", label: "Generated Exams", icon: <FlaskConical className="h-4 w-4" />, color: "text-emerald-400" },
  { key: "mockAttempts", label: "Mock Exam Results", icon: <BarChart3 className="h-4 w-4" />, color: "text-rose-400" },
  { key: "decks", label: "Flashcard Decks", icon: <Layers className="h-4 w-4" />, color: "text-blue-400" },
  { key: "notes", label: "Notes", icon: <FileText className="h-4 w-4" />, color: "text-yellow-400" },
  { key: "revisionNotes", label: "Revision Notes", icon: <BookMarked className="h-4 w-4" />, color: "text-purple-400" },
  { key: "essayAttempts", label: "Essay Attempts", icon: <ClipboardList className="h-4 w-4" />, color: "text-orange-400" },
  { key: "tasks", label: "Tasks", icon: <CheckSquare className="h-4 w-4" />, color: "text-teal-400" },
  { key: "tutorMemory", label: "Tutor Memory", icon: <GraduationCap className="h-4 w-4" />, color: "text-indigo-400" },
  { key: "audioOverviews", label: "Audio Overviews", icon: <Headphones className="h-4 w-4" />, color: "text-pink-400" },
]

function getRefLabel(type: string, item: any): { label: string; meta?: string } {
  switch (type) {
    case "exams": return { label: item.subject ?? "Exam", meta: item.pdf_filename }
    case "mockAttempts": return { label: `${item.score_percentage?.toFixed(0) ?? "?"}% score`, meta: item.completed_at ? new Date(item.completed_at).toLocaleDateString() : undefined }
    case "decks": return { label: item.name, meta: item.subject }
    case "notes": return { label: item.title, meta: item.subject }
    case "revisionNotes": return { label: item.title, meta: item.subject }
    case "essayAttempts": return { label: item.question_text?.slice(0, 60) + "...", meta: item.ai_score ? `Score: ${item.ai_score}/100` : undefined }
    case "tasks": return { label: item.title, meta: item.subject ?? item.priority }
    case "tutorMemory": return { label: item.topic, meta: `${item.subject} · ${item.confidence_level ?? "?"}` }
    case "audioOverviews": return { label: item.title, meta: item.subject }
    default: return { label: "Item" }
  }
}

// Markdown rendering is handled by <ChatMarkdown /> (components/chat/chat-markdown.tsx).
// The previous hand-rolled parser here only handled bold/italic/line breaks —
// no headers, no lists, no tables — and injected AI output into the DOM via
// dangerouslySetInnerHTML with no sanitization.

function groupLogsBySession(logs: LogEntry[]): SessionGroup[] {
  const sessions: SessionGroup[] = []
  for (const log of logs) {
    let topic = log.query
    try {
      if (log.context_summary) {
        const parsed = JSON.parse(log.context_summary)
        if (parsed.topic) topic = parsed.topic
      }
    } catch {}
    const dateKey = new Date(log.created_at).toDateString()
    const last = sessions[sessions.length - 1]
    if (last && last.topic === topic && last.mode === log.mode && last.date === dateKey) {
      last.messages.push({ query: log.query, response: log.response, created_at: log.created_at })
    } else {
      sessions.push({ topic, mode: log.mode, date: dateKey, messages: [{ query: log.query, response: log.response, created_at: log.created_at }] })
    }
  }
  return sessions
}

function isLikelyOffTopic(message: string, topic: string): boolean {
  if (!topic || !message) return false
  const STOPWORDS = new Set(["the","a","an","is","it","of","in","to","and","or","for","with","about","what","how","why","can","do","i","me","my","you","your"])
  const topicTokens = topic.toLowerCase().split(/\s+/).filter((w) => w.length > 2 && !STOPWORDS.has(w))
  if (topicTokens.length === 0) return false
  const msgLower = message.toLowerCase()
  return !topicTokens.some((token) => msgLower.includes(token))
}

export default function EchoMindPage() {
  const [view, setView] = useState<ViewState>("setup")
  const [selectedMode, setSelectedMode] = useState<EchoMode | null>(null)
  const [topic, setTopic] = useState("")
  const [context, setContext] = useState("")
  const [showContext, setShowContext] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [inputValue, setInputValue] = useState("")
  const [loading, setLoading] = useState(false)
  const [offTopicWarning, setOffTopicWarning] = useState<string | null>(null)

  // References
  const [refs, setRefs] = useState<Record<string, any[]>>({})
  const [refsLoading, setRefsLoading] = useState(false)
  const [showRefs, setShowRefs] = useState(false)
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null)
  const [selectedRefs, setSelectedRefs] = useState<SelectedRef[]>([])

  // History
  const [historyLogs, setHistoryLogs] = useState<LogEntry[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [selectedSession, setSelectedSession] = useState<SessionGroup | null>(null)

  // Usage / quota
  const [usage, setUsage] = useState<UsageInfo | null>(null)

  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  useEffect(() => {
    fetch("/api/echomind/usage")
      .then((r) => r.json())
      .then((data) => { if (!data.error) setUsage(data) })
      .catch(() => {})
  }, [])

  const loadRefs = useCallback(async () => {
    if (refsLoading || Object.keys(refs).length > 0) return
    setRefsLoading(true)
    try {
      const res = await fetch("/api/echomind/references")
      const data = await res.json()
      setRefs(data)
    } catch {} finally { setRefsLoading(false) }
  }, [refsLoading, refs])

  const openHistory = useCallback(async () => {
    setView("history")
    setHistoryLoading(true)
    try {
      const res = await fetch("/api/echomind/history")
      const data = await res.json()
      setHistoryLogs(data.logs ?? [])
    } catch {} finally { setHistoryLoading(false) }
  }, [])

  const toggleRef = useCallback((type: string, item: any) => {
    const { label, meta } = getRefLabel(type, item)
    setSelectedRefs((prev) => {
      const exists = prev.find((r) => r.type === type && r.id === item.id)
      if (exists) return prev.filter((r) => !(r.type === type && r.id === item.id))
      return [...prev, { type, id: item.id, label, meta, data: item }]
    })
  }, [])

  const isRefSelected = useCallback((type: string, id: string) =>
    selectedRefs.some((r) => r.type === type && r.id === id), [selectedRefs])

  const buildReferencesPayload = useCallback(() => {
    if (selectedRefs.length === 0) return undefined
    const result: Record<string, any[]> = {}
    for (const ref of selectedRefs) {
      if (!result[ref.type]) result[ref.type] = []
      result[ref.type].push(ref.data)
    }
    return result
  }, [selectedRefs])

  const selectedModeData = MODES.find((m) => m.id === selectedMode)
  const totalRefItems = Object.values(refs).reduce((a, v) => a + (v?.length ?? 0), 0)
  const sessions = groupLogsBySession(historyLogs)

  const startSession = useCallback(async (overrideTopic?: string, overrideMode?: EchoMode, preloadedMessages?: Message[]) => {
    const sessionTopic = overrideTopic ?? topic.trim()
    const sessionMode = overrideMode ?? selectedMode
    if (!sessionMode || !sessionTopic) return
    setSelectedMode(sessionMode)
    setTopic(sessionTopic)
    setOffTopicWarning(null)
    setLoading(true)
    setView("session")
    if (preloadedMessages && preloadedMessages.length > 0) {
      setMessages(preloadedMessages)
      setLoading(false)
      setTimeout(() => inputRef.current?.focus(), 100)
      return
    }
    setMessages([])
    try {
      const res = await fetch("/api/echomind", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: sessionTopic, mode: sessionMode, context: context.trim(), history: [], references: buildReferencesPayload() }),
      })
      const data = await res.json()
      if (res.status === 429 || data.error === "limit_reached") {
        fetch("/api/echomind/usage").then((r) => r.json()).then((u) => { if (!u.error) setUsage(u) }).catch(() => {})
        setMessages([{ role: "assistant", content: "**You've used all your 3 EchoMind sessions this month.**\n\nExam coming up? Unlock unlimited for $4.99 — less than a coffee. ☕" }])
        return
      }
      if (data.reply) {
        setMessages([{ role: "assistant", content: data.reply }])
        fetch("/api/echomind/usage").then((r) => r.json()).then((u) => { if (!u.error) setUsage(u) }).catch(() => {})
      }
    } catch {
      setMessages([{ role: "assistant", content: "Something went wrong. Please try again." }])
    } finally {
      setLoading(false)
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [selectedMode, topic, context, buildReferencesPayload])

  const continueSession = useCallback((session: SessionGroup) => {
    const preloaded: Message[] = session.messages.flatMap((m) => [
      { role: "user" as const, content: m.query },
      { role: "assistant" as const, content: m.response },
    ])
    setSelectedRefs([])
    startSession(session.topic, session.mode, preloaded)
  }, [startSession])

  const sendMessage = useCallback(async (forcedMessage?: string) => {
    const userMsg = (forcedMessage ?? inputValue).trim()
    if (!userMsg || loading) return
    if (!forcedMessage && messages.length >= 2 && isLikelyOffTopic(userMsg, topic)) {
      setOffTopicWarning(userMsg)
      return
    }
    setOffTopicWarning(null)
    setInputValue("")
    setMessages((prev) => [...prev, { role: "user", content: userMsg }])
    setLoading(true)
    try {
      const res = await fetch("/api/echomind", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: topic.trim(), mode: selectedMode, context: context.trim(), message: userMsg, history: messages.map((m) => ({ role: m.role, content: m.content })), references: buildReferencesPayload() }),
      })
      const data = await res.json()
      if (res.status === 429 || data.error === "limit_reached") {
        fetch("/api/echomind/usage").then((r) => r.json()).then((u) => { if (!u.error) setUsage(u) }).catch(() => {})
        setMessages((prev) => [...prev, { role: "assistant", content: "**You've used all your 3 EchoMind sessions this month.**\n\nExam coming up? Unlock unlimited for $4.99 — less than a coffee. ☕" }])
        return
      }
      if (data.reply) {
        setMessages((prev) => [...prev, { role: "assistant", content: data.reply }])
        fetch("/api/echomind/usage").then((r) => r.json()).then((u) => { if (!u.error) setUsage(u) }).catch(() => {})
      }
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", content: "Something went wrong. Please try again." }])
    } finally {
      setLoading(false)
    }
  }, [inputValue, loading, messages, selectedMode, topic, context, buildReferencesPayload])

  const resetSession = () => {
    setView("setup")
    setMessages([])
    setInputValue("")
    setTopic("")
    setContext("")
    setShowContext(false)
    setSelectedRefs([])
    setShowRefs(false)
    setOffTopicWarning(null)
  }

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto px-4 py-6 min-h-screen flex flex-col gap-6">

        {/* ── HEADER ─────────────────────────────────────────────── */}
        <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {(view !== "setup") && (
              <button
                onClick={() => {
                  if (view === "history_detail") { setView("history"); setSelectedSession(null) }
                  else if (view === "session") resetSession()
                  else setView("setup")
                }}
                className="h-9 w-9 rounded-xl border border-border bg-card hover:bg-accent flex items-center justify-center transition-all hover:scale-105 active:scale-95"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
            )}
            <div className="flex items-center gap-2.5">
              {/* Logo mark */}
              <div className="relative h-9 w-9 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/25">
                <Brain className="h-5 w-5 text-white" />
                <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-400 border-2 border-background" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-lg font-bold tracking-tight leading-none">EchoMind</h1>
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-indigo-500/15 text-indigo-400 border border-indigo-500/20 uppercase tracking-wider">AI</span>
                </div>
                <p className="text-xs text-muted-foreground leading-none mt-0.5">
                  {view === "history" ? "Reflection history" :
                   view === "history_detail" ? selectedSession?.topic :
                   view === "session" ? `Reflecting — ${topic}` :
                   view === "memory" ? "Memory decay tracker" :
                   "Personal knowledge companion"}
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {view === "setup" && (
              <>
                <button
                  onClick={() => setView("memory")}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-muted-foreground border border-border hover:border-violet-500/40 hover:text-violet-400 hover:bg-violet-500/5 transition-all"
                >
                  <TrendingDown className="h-3.5 w-3.5" />
                  Memory
                </button>
                <button
                  onClick={openHistory}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-muted-foreground border border-border hover:border-primary/40 hover:text-primary hover:bg-primary/5 transition-all"
                >
                  <History className="h-3.5 w-3.5" />
                  History
                </button>
              </>
            )}
            {view === "session" && (
              <button
                onClick={resetSession}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-muted-foreground border border-border hover:border-border hover:bg-muted/60 transition-all"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                New
              </button>
            )}
          </div>
        </motion.div>

        {/* ── SETUP VIEW ─────────────────────────────────────────── */}
        {view === "setup" && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} className="flex-1 space-y-5">

            {/* Usage pill */}
            {usage && !usage.unlimited && (
              <motion.div
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                className={`rounded-2xl border px-4 py-3.5 flex items-center justify-between gap-4 ${
                  usage.remaining === 0
                    ? "bg-red-500/6 border-red-500/20"
                    : usage.remaining === 1
                    ? "bg-amber-500/6 border-amber-500/20"
                    : "bg-card border-border"
                }`}
              >
                <div className="flex items-center gap-3">
                  {usage.remaining === 0
                    ? <div className="h-8 w-8 rounded-lg bg-red-500/10 flex items-center justify-center"><Lock className="h-4 w-4 text-red-400" /></div>
                    : <div className="h-8 w-8 rounded-lg bg-amber-500/10 flex items-center justify-center"><Zap className="h-4 w-4 text-amber-400" /></div>
                  }
                  <div>
                    {usage.remaining === 0 ? (
                      <>
                        <p className="text-sm font-semibold text-red-400 leading-none">You&apos;ve used all 3 sessions this month</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Exam coming up? Unlock unlimited for $4.99 — less than a coffee.
                          {usage.resetDate && ` Resets ${new Date(usage.resetDate).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}.`}
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="text-sm font-semibold leading-none">
                          {usage.remaining} free session{usage.remaining !== 1 ? "s" : ""} left
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {usage.used} of {usage.limit} used
                          {usage.resetDate && ` · resets ${new Date(usage.resetDate).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`}
                        </p>
                      </>
                    )}
                  </div>
                </div>
                <a href="/upgrade" className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-gradient-to-r from-indigo-500 to-violet-500 text-white shadow-md shadow-indigo-500/20 hover:shadow-indigo-500/40 transition-all hover:scale-105 active:scale-95 flex-shrink-0">
                  <Sparkles className="h-3.5 w-3.5" />
                  Unlock Genius
                </a>
              </motion.div>
            )}

            {usage?.unlimited && (
              <div className="rounded-2xl border border-indigo-500/20 bg-gradient-to-r from-indigo-500/8 to-violet-500/5 px-4 py-3 flex items-center gap-3">
                <div className="h-7 w-7 rounded-lg bg-indigo-500/15 flex items-center justify-center">
                  <Sparkles className="h-3.5 w-3.5 text-indigo-400" />
                </div>
                <p className="text-sm font-medium text-indigo-400">Genius plan — unlimited EchoMind access</p>
              </div>
            )}

            {/* Mode selector */}
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-3 px-0.5">Choose your reflection mode</p>
              <div className="grid gap-2.5">
                {MODES.map((mode, idx) => {
                  const isSelected = selectedMode === mode.id
                  return (
                    <motion.button
                      key={mode.id}
                      initial={{ opacity: 0, x: -12 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.07 }}
                      onClick={() => setSelectedMode(mode.id)}
                      className={`w-full text-left p-4 rounded-2xl border-2 bg-gradient-to-br transition-all duration-200 ${mode.accent} ${
                        isSelected
                          ? `ring-2 ring-offset-1 ring-offset-background shadow-xl ${mode.glow} scale-[1.01]`
                          : "hover:scale-[1.005]"
                      } ${isSelected ? "ring-indigo-500/40" : ""}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`h-9 w-9 rounded-xl flex items-center justify-center transition-colors ${isSelected ? "bg-white/10 text-white" : "bg-muted/60 text-muted-foreground"}`}>
                          {mode.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`font-semibold text-sm ${isSelected ? "text-foreground" : "text-foreground/80"}`}>{mode.label}</span>
                            <span className={`text-[10px] px-2 py-0.5 rounded-full border font-semibold uppercase tracking-wide ${mode.pill}`}>{mode.tagline}</span>
                          </div>
                          <p className="text-xs text-muted-foreground leading-relaxed mt-0.5">{mode.description}</p>
                        </div>
                        {isSelected && (
                          <div className="h-5 w-5 rounded-full bg-indigo-500 flex items-center justify-center flex-shrink-0">
                            <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          </div>
                        )}
                      </div>
                    </motion.button>
                  )
                })}
              </div>
            </div>

            {/* Topic + options — appear after mode selected */}
            <AnimatePresence>
              {selectedMode && (
                <motion.div
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.25 }}
                  className="space-y-4"
                >
                  {/* Topic input */}
                  <div className="relative">
                    <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-indigo-500/10 to-violet-500/5 blur-sm -z-10" />
                    <div className="flex items-center gap-3 px-4 py-1 rounded-2xl border-2 border-border focus-within:border-indigo-500/50 bg-card transition-all">
                      <div className="text-muted-foreground flex-shrink-0">
                        {MODE_ICON_MAP[selectedMode]}
                      </div>
                      <Input
                        placeholder={selectedModeData?.placeholder}
                        value={topic}
                        onChange={(e) => setTopic(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter" && topic.trim()) startSession() }}
                        className="border-0 shadow-none focus-visible:ring-0 bg-transparent h-11 px-0 text-sm font-medium placeholder:text-muted-foreground/50"
                        autoFocus
                      />
                    </div>
                  </div>

                  {/* References panel */}
                  <div className="rounded-2xl border border-border overflow-hidden bg-card">
                    <button
                      onClick={() => { setShowRefs((v) => !v); if (!showRefs) loadRefs() }}
                      className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-muted/40 transition-colors text-left"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="h-7 w-7 rounded-lg bg-indigo-500/12 flex items-center justify-center">
                          <Sparkles className="h-3.5 w-3.5 text-indigo-400" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold leading-none">Personal References</p>
                          <p className="text-xs text-muted-foreground mt-0.5">Connect your study data for smarter responses</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {selectedRefs.length > 0 && (
                          <span className="text-[11px] px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-400 border border-indigo-500/20 font-semibold">
                            {selectedRefs.length} active
                          </span>
                        )}
                        <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${showRefs ? "rotate-180" : ""}`} />
                      </div>
                    </button>

                    <AnimatePresence>
                      {showRefs && (
                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden border-t border-border">
                          <div className="p-3 space-y-1.5">
                            {refsLoading ? (
                              <div className="flex items-center justify-center py-8 gap-2 text-muted-foreground text-sm">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Loading your learning data...
                              </div>
                            ) : totalRefItems === 0 ? (
                              <p className="text-sm text-muted-foreground text-center py-6">No learning data found yet.</p>
                            ) : (
                              REF_GROUPS.map((group) => {
                                const items = refs[group.key] ?? []
                                if (items.length === 0) return null
                                const isExpanded = expandedGroup === group.key
                                const selectedCount = selectedRefs.filter((r) => r.type === group.key).length
                                return (
                                  <div key={group.key} className="rounded-xl border border-border overflow-hidden">
                                    <button
                                      onClick={() => setExpandedGroup(isExpanded ? null : group.key)}
                                      className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-muted/40 transition-colors"
                                    >
                                      <div className="flex items-center gap-2">
                                        <span className={group.color}>{group.icon}</span>
                                        <span className="text-sm font-medium">{group.label}</span>
                                        <span className="text-xs text-muted-foreground/60">({items.length})</span>
                                        {selectedCount > 0 && (
                                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-indigo-500/15 text-indigo-400 border border-indigo-500/20 font-semibold">{selectedCount}</span>
                                        )}
                                      </div>
                                      <ChevronRight className={`h-3.5 w-3.5 text-muted-foreground transition-transform duration-200 ${isExpanded ? "rotate-90" : ""}`} />
                                    </button>
                                    <AnimatePresence>
                                      {isExpanded && (
                                        <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }} className="overflow-hidden border-t border-border">
                                          <div className="px-3 py-2 space-y-1 max-h-44 overflow-y-auto">
                                            {items.map((item: any) => {
                                              const { label, meta } = getRefLabel(group.key, item)
                                              const selected = isRefSelected(group.key, item.id)
                                              return (
                                                <button
                                                  key={item.id}
                                                  onClick={() => toggleRef(group.key, item)}
                                                  className={`w-full text-left px-3 py-2 rounded-xl text-sm transition-all flex items-center justify-between gap-2 ${
                                                    selected
                                                      ? "bg-indigo-500/12 border border-indigo-500/30 text-foreground"
                                                      : "hover:bg-muted/50 border border-transparent text-muted-foreground hover:text-foreground"
                                                  }`}
                                                >
                                                  <div className="flex-1 min-w-0">
                                                    <p className="font-medium truncate">{label}</p>
                                                    {meta && <p className="text-xs opacity-50 truncate">{meta}</p>}
                                                  </div>
                                                  {selected && <span className="h-2 w-2 rounded-full bg-indigo-400 flex-shrink-0" />}
                                                </button>
                                              )
                                            })}
                                          </div>
                                        </motion.div>
                                      )}
                                    </AnimatePresence>
                                  </div>
                                )
                              })
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Selected ref chips */}
                  <AnimatePresence>
                    {selectedRefs.length > 0 && (
                      <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                        <p className="text-[11px] text-muted-foreground mb-2 font-medium uppercase tracking-wide">EchoMind will use:</p>
                        <div className="flex flex-wrap gap-1.5">
                          {selectedRefs.map((ref) => (
                            <span key={`${ref.type}-${ref.id}`} className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
                              {ref.label}
                              <button onClick={() => toggleRef(ref.type, { id: ref.id })} className="hover:opacity-60 transition-opacity">
                                <X className="h-3 w-3" />
                              </button>
                            </span>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Optional context */}
                  <button
                    onClick={() => setShowContext((v) => !v)}
                    className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-200 ${showContext ? "rotate-180" : ""}`} />
                    Add extra context or notes (optional)
                  </button>
                  <AnimatePresence>
                    {showContext && (
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                        <Textarea
                          placeholder="Paste notes, a definition, or describe what you already know..."
                          value={context}
                          onChange={(e) => setContext(e.target.value)}
                          rows={4}
                          className="resize-none text-sm rounded-xl border-border"
                        />
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* CTA */}
                  {usage?.remaining === 0 ? (
                    <a
                      href="/upgrade"
                      className="flex items-center justify-center gap-2 w-full h-12 rounded-2xl font-semibold text-sm bg-gradient-to-r from-indigo-500 to-violet-600 text-white shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 transition-all hover:scale-[1.01] active:scale-[0.99]"
                    >
                      <Lock className="h-4 w-4" />
                      Unlock unlimited for $4.99 — less than a coffee ☕
                    </a>
                  ) : (
                    <button
                      onClick={() => startSession()}
                      disabled={!topic.trim() || loading}
                      className="flex items-center justify-center gap-2 w-full h-12 rounded-2xl font-semibold text-sm bg-gradient-to-r from-indigo-500 to-violet-600 text-white shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:shadow-none"
                    >
                      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                      {loading ? "Starting..." : `Begin reflection${selectedRefs.length > 0 ? ` with ${selectedRefs.length} reference${selectedRefs.length > 1 ? "s" : ""}` : ""}`}
                    </button>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}

        {/* ── SESSION VIEW ───────────────────────────────────────── */}
        {view === "session" && (
          <div className="flex-1 flex flex-col gap-4">
            {/* Session context pill */}
            <div className="flex flex-wrap items-center gap-2">
              <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border ${selectedMode ? MODE_GLOW_MAP[selectedMode] : "border-border"} bg-card shadow-sm`}>
                <span className="text-muted-foreground">{selectedMode && MODE_ICON_MAP[selectedMode]}</span>
                <span className={`text-[11px] font-semibold px-1.5 py-0.5 rounded-full border ${selectedMode ? MODE_PILL_MAP[selectedMode] : ""}`}>
                  {selectedMode && MODE_LABEL_MAP[selectedMode]}
                </span>
                <span className="text-muted-foreground/40 text-xs mx-0.5">·</span>
                <span className="text-xs font-semibold truncate max-w-[160px]">{topic}</span>
              </div>
              {selectedRefs.length > 0 && (
                <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-500/8 border border-indigo-500/20">
                  <Sparkles className="h-3 w-3 text-indigo-400" />
                  <span className="text-xs font-medium text-indigo-400">{selectedRefs.length} ref{selectedRefs.length > 1 ? "s" : ""} active</span>
                </div>
              )}
            </div>

            {/* Messages */}
            <div className="flex-1 space-y-5 pb-2">
              <AnimatePresence initial={false}>
                {messages.map((msg, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 10, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ duration: 0.22 }}
                    className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}
                  >
                    <div className={`h-8 w-8 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm ${
                      msg.role === "assistant"
                        ? "bg-gradient-to-br from-indigo-500 to-violet-600 text-white"
                        : "bg-muted text-muted-foreground border border-border"
                    }`}>
                      {msg.role === "assistant" ? <Brain className="h-4 w-4" /> : <User className="h-4 w-4" />}
                    </div>
                    <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm ${
                      msg.role === "assistant"
                        ? "bg-card border border-border rounded-tl-sm"
                        : "bg-gradient-to-br from-indigo-500 to-violet-600 text-white rounded-tr-sm shadow-lg shadow-indigo-500/15"
                    }`}>
                      {msg.role === "assistant" ? (
                        <ChatMarkdown content={msg.content} />
                      ) : (
                        <p>{msg.content}</p>
                      )}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>

              {loading && (
                <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="flex gap-3 items-center">
                  <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center flex-shrink-0 shadow-sm">
                    <Brain className="h-4 w-4 text-white" />
                  </div>
                  <div className="bg-card border border-border rounded-2xl rounded-tl-sm px-4 py-3 flex gap-1.5 items-center">
                    <span className="h-2 w-2 rounded-full bg-indigo-400 animate-bounce [animation-delay:0ms]" />
                    <span className="h-2 w-2 rounded-full bg-violet-400 animate-bounce [animation-delay:160ms]" />
                    <span className="h-2 w-2 rounded-full bg-indigo-400 animate-bounce [animation-delay:320ms]" />
                  </div>
                </motion.div>
              )}
              <div ref={bottomRef} />
            </div>

            {/* Off-topic warning */}
            <AnimatePresence>
              {offTopicWarning && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 4 }}
                  className="rounded-2xl border border-amber-500/25 bg-amber-500/6 px-4 py-4"
                >
                  <div className="flex items-start gap-3">
                    <div className="h-7 w-7 rounded-lg bg-amber-500/12 flex items-center justify-center flex-shrink-0">
                      <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold leading-none mb-1">Looks like a new topic</p>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        This session is focused on <span className="font-semibold text-foreground">&ldquo;{topic}&rdquo;</span>. Staying on topic keeps reflections deep and effective.
                      </p>
                      <div className="flex flex-wrap gap-2 mt-3">
                        <button
                          onClick={() => { const msg = offTopicWarning; setOffTopicWarning(null); sendMessage(msg) }}
                          className="px-3 py-1.5 rounded-xl text-xs font-medium border border-amber-500/30 text-amber-400 hover:bg-amber-500/10 transition-colors"
                        >
                          Send anyway
                        </button>
                        <button
                          onClick={() => { setOffTopicWarning(null); resetSession() }}
                          className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-gradient-to-r from-indigo-500 to-violet-600 text-white shadow-sm hover:shadow-md transition-all"
                        >
                          New session
                        </button>
                        <button
                          onClick={() => setOffTopicWarning(null)}
                          className="px-3 py-1.5 rounded-xl text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Input bar */}
            <div className="sticky bottom-4 rounded-2xl border border-border bg-card shadow-xl shadow-black/8 overflow-hidden">
              <div className="flex gap-2 items-end p-3">
                <Textarea
                  ref={inputRef}
                  placeholder={`Reply about "${topic}"…`}
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage() } }}
                  rows={2}
                  className="resize-none border-0 shadow-none focus-visible:ring-0 bg-transparent text-sm min-h-0 p-0 flex-1"
                  disabled={loading}
                />
                <button
                  onClick={() => sendMessage()}
                  disabled={!inputValue.trim() || loading}
                  className="h-9 w-9 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white flex items-center justify-center flex-shrink-0 shadow-md shadow-indigo-500/25 hover:shadow-indigo-500/40 transition-all hover:scale-105 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:shadow-none"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </button>
              </div>
              <div className="px-4 pb-2.5 flex items-center gap-1.5">
                <span className="h-1 w-1 rounded-full bg-indigo-400/50" />
                <p className="text-[10px] text-muted-foreground/50 font-mono">Enter to send · Shift+Enter for new line</p>
              </div>
            </div>
          </div>
        )}

        {/* ── MEMORY VIEW ────────────────────────────────────────── */}
        {view === "memory" && (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="flex-1">
            <MemoryPanel
              onStartSession={(topicName) => {
                setTopic(topicName)
                setView("setup")
              }}
            />
          </motion.div>
        )}

        {/* ── HISTORY LIST ───────────────────────────────────────── */}
        {view === "history" && (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="flex-1">
            {historyLoading ? (
              <div className="flex items-center justify-center py-24 gap-3 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span className="text-sm">Loading sessions...</span>
              </div>
            ) : sessions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 text-center">
                <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-indigo-500/10 to-violet-500/10 border border-indigo-500/15 flex items-center justify-center mb-5">
                  <History className="h-7 w-7 text-indigo-400/60" />
                </div>
                <p className="font-semibold text-foreground mb-1.5">No sessions yet</p>
                <p className="text-sm text-muted-foreground max-w-xs">Start your first reflection session and it will appear here.</p>
                <button
                  onClick={() => setView("setup")}
                  className="mt-6 flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-gradient-to-r from-indigo-500 to-violet-600 text-white font-semibold text-sm shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 transition-all hover:scale-105 active:scale-95"
                >
                  <Brain className="h-4 w-4" />
                  Start a session
                </button>
              </div>
            ) : (
              <div className="space-y-2.5">
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest mb-4">
                  {sessions.length} session{sessions.length !== 1 ? "s" : ""} found
                </p>
                {sessions.map((session, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.04 }}
                    className="group p-4 rounded-2xl border border-border bg-card hover:border-indigo-500/30 hover:shadow-md hover:shadow-indigo-500/5 transition-all"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <button
                        className="flex items-start gap-3 min-w-0 flex-1 text-left"
                        onClick={() => { setSelectedSession(session); setView("history_detail") }}
                      >
                        <div className={`h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0 text-muted-foreground transition-colors group-hover:text-indigo-400 ${
                          session.mode === "my_knowledge" ? "bg-blue-500/8 group-hover:bg-blue-500/12" :
                          session.mode === "confusion_history" ? "bg-amber-500/8 group-hover:bg-amber-500/12" :
                          "bg-violet-500/8 group-hover:bg-violet-500/12"
                        }`}>
                          {MODE_ICON_MAP[session.mode]}
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-sm truncate">{session.topic}</p>
                          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                            <span className={`text-[10px] px-2 py-0.5 rounded-full border font-semibold ${MODE_PILL_MAP[session.mode]}`}>
                              {MODE_LABEL_MAP[session.mode]}
                            </span>
                            <span className="flex items-center gap-1 text-xs text-muted-foreground">
                              <MessageSquare className="h-3 w-3" />
                              {session.messages.length}
                            </span>
                            <span className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Clock className="h-3 w-3" />
                              {new Date(session.messages[0]?.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                            </span>
                          </div>
                        </div>
                      </button>

                      <button
                        onClick={() => continueSession(session)}
                        className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border border-indigo-500/25 text-indigo-400 hover:bg-indigo-500/8 transition-all hover:scale-105 active:scale-95"
                      >
                        <Play className="h-3 w-3" />
                        Continue
                      </button>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>
        )}

        {/* ── HISTORY DETAIL ─────────────────────────────────────── */}
        {view === "history_detail" && selectedSession && (
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.3 }} className="flex-1 space-y-5">
            {/* Meta bar */}
            <div className="flex flex-wrap items-center gap-2 pb-4 border-b border-border">
              <span className={`text-[10px] px-2.5 py-1 rounded-full border font-semibold ${MODE_PILL_MAP[selectedSession.mode]}`}>
                {MODE_LABEL_MAP[selectedSession.mode]}
              </span>
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {new Date(selectedSession.messages[0]?.created_at).toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
              </span>
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <MessageSquare className="h-3 w-3" />
                {selectedSession.messages.length} exchange{selectedSession.messages.length !== 1 ? "s" : ""}
              </span>
            </div>

            {/* Chat bubbles */}
            <div className="space-y-5">
              {selectedSession.messages.map((msg, i) => (
                <div key={i} className="space-y-3">
                  <div className="flex gap-3 flex-row-reverse">
                    <div className="h-8 w-8 rounded-xl bg-muted border border-border flex items-center justify-center flex-shrink-0">
                      <User className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="max-w-[85%] rounded-2xl rounded-tr-sm px-4 py-3 text-sm bg-gradient-to-br from-indigo-500 to-violet-600 text-white leading-relaxed shadow-md shadow-indigo-500/15">
                      {msg.query}
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center flex-shrink-0 shadow-sm">
                      <Brain className="h-4 w-4 text-white" />
                    </div>
                    <div className="max-w-[85%] rounded-2xl rounded-tl-sm px-4 py-3 text-sm bg-card border border-border leading-relaxed">
                      <ChatMarkdown content={msg.response} />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Action CTAs */}
            <div className="pt-4 border-t border-border flex flex-col sm:flex-row gap-2">
              <button
                onClick={() => continueSession(selectedSession)}
                className="flex-1 flex items-center justify-center gap-2 h-11 rounded-2xl font-semibold text-sm bg-gradient-to-r from-indigo-500 to-violet-600 text-white shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/35 transition-all hover:scale-[1.01] active:scale-[0.99]"
              >
                <Play className="h-4 w-4" />
                Continue this session
              </button>
              <button
                onClick={() => { setTopic(selectedSession.topic); setSelectedMode(selectedSession.mode); setView("setup") }}
                className="flex-1 flex items-center justify-center gap-2 h-11 rounded-2xl font-semibold text-sm border border-border bg-card hover:bg-muted/40 transition-all hover:scale-[1.01] active:scale-[0.99]"
              >
                <RotateCcw className="h-4 w-4" />
                New session on this topic
              </button>
            </div>
          </motion.div>
        )}

      </div>
    </AppLayout>
  )
}

"use client"

import type React from "react"
import { ChatMarkdown } from "@/components/chat/chat-markdown"

import { useState, useRef, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import {
  Send,
  Settings,
  Sparkles,
  RefreshCw,
  BookOpen,
  Loader2,
  ChevronDown,
  Copy,
  Check,
  ThumbsUp,
  ThumbsDown,
  ArrowLeft,
  Upload,
  X,
  FileText,
  Image as ImageIcon,
  Type,
  Folder,
  BookMarked,
  Lightbulb,
  ListChecks,
  StickyNote,
  Layers,
  Quote,
  Zap,
  Search,
  Calculator,
  Trash2,
} from "lucide-react"
import { createBrowserClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { InappropriateSearchNotice } from "@/components/inappropriate-search-notice"

interface StudySource {
  id: string
  type: "pdf" | "image" | "text" | "note"
  name: string
  content: string
  thumbnail?: string
}

interface Message {
  role: "user" | "assistant"
  content: string
  timestamp: string
  sources?: string[]
}

/** A subject the learner picked under their selected syllabus. */
interface SubjectOption {
  syllabus: string
  subject: string
}
const optionKey = (o: SubjectOption) => `${o.syllabus}::${o.subject}`

interface RecentSearch {
  id: string
  query: string
}

/**
 * Quick actions carried over from the Browse page. "Video Lessons" is
 * intentionally gone — video search lives in StudyPilot.
 */
const QUICK_ACTIONS = [
  { title: "Study Guide", description: "Get AI summaries", query: "Explain quantum physics", icon: BookOpen, tile: "bg-blue-100", glyph: "text-blue-600" },
  { title: "History Topics", description: "Learn history", query: "World War 2 history", icon: FileText, tile: "bg-orange-100", glyph: "text-orange-600" },
  { title: "Math Help", description: "Get solutions", query: "Solve algebra equations", icon: Calculator, tile: "bg-green-100", glyph: "text-green-600" },
] as const

interface TutorProfile {
  learning_style: string
  difficulty: string
  goal: string
  subjects: string[]
  keep_short: boolean
}

interface TutorChatProps {
  profile: TutorProfile
  onOpenSettings: () => void
  showBackButton?: boolean
}

const styleLabels: Record<string, string> = {
  simple_short: "Simple & Short",
  step_by_step: "Step-by-Step",
  examples_first: "Examples First",
  conceptual: "Conceptual",
}

const difficultyLabels: Record<string, string> = {
  gentle: "Gentle",
  standard: "Standard",
  challenging: "Challenging",
}

const goalLabels: Record<string, string> = {
  understand: "Understanding",
  practice: "Practice",
  exam_prep: "Exam Prep",
  revision: "Revision",
}

export function TutorChat({ profile, onOpenSettings, showBackButton = false }: TutorChatProps) {
  const router = useRouter()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [sessionId, setSessionId] = useState<string | null>(null)
  // Subject options now come from the learner's selected syllabus and
  // subjects (not the free-text list from onboarding). "" = General.
  const [subjectOptions, setSubjectOptions] = useState<SubjectOption[]>([])
  const [subjectsLoaded, setSubjectsLoaded] = useState(false)
  const [selectedKey, setSelectedKey] = useState<string>("")
  const [restoredSubject, setRestoredSubject] = useState<string | null>(null)
  const restoreApplied = useRef(false)

  // Merged from Browse: recent searches + the blocked-content notice.
  const [recentSearches, setRecentSearches] = useState<RecentSearch[]>([])
  const [showInappropriateNotice, setShowInappropriateNotice] = useState(false)
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null)
  const [showScrollButton, setShowScrollButton] = useState(false)

  // Multi-source state
  const [studySources, setStudySources] = useState<StudySource[]>([])
  const [studyMode, setStudyMode] = useState(false)
  const [showSourcePanel, setShowSourcePanel] = useState(false)
  const [textInput, setTextInput] = useState("")
  const [savedNotes, setSavedNotes] = useState<Array<{ id: string; title: string; content: string }>>([])
  const [loadingNotes, setLoadingNotes] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const chatContainerRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const supabase = createBrowserClient()

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  useEffect(() => {
    const container = chatContainerRef.current
    if (!container) return

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container
      setShowScrollButton(scrollHeight - scrollTop - clientHeight > 100)
    }

    container.addEventListener("scroll", handleScroll)
    return () => container.removeEventListener("scroll", handleScroll)
  }, [])

  useEffect(() => {
    const loadRecentSession = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return

      const { data: sessions } = await supabase
        .from("tutor_sessions")
        .select("*")
        .eq("user_id", user.id)
        .eq("context_type", "chat")
        .order("updated_at", { ascending: false })
        .limit(1)

      if (sessions && sessions.length > 0 && sessions[0].messages?.length > 0) {
        const session = sessions[0]
        const sessionDate = new Date(session.updated_at).toDateString()
        const today = new Date().toDateString()
        if (sessionDate === today) {
          setSessionId(session.id)
          setMessages(session.messages)
          if (session.subject) {
            setRestoredSubject(session.subject)
          }
        }
      }
    }

    loadRecentSession()
  }, [supabase])

  // Subject options from the learner's syllabus selection.
  useEffect(() => {
    let cancelled = false
    fetch("/api/syllabus/subjects", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled || !d) return
        const chosen: SubjectOption[] = (d.subjects ?? [])
          .filter((x: any) => x.selected)
          .map((x: any) => ({ syllabus: x.syllabus, subject: x.subject }))
        setSubjectOptions(chosen)
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setSubjectsLoaded(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  // A restored session remembers its subject by name only. Re-select the
  // matching option once — a ref, not a dependency on selectedKey, so the
  // learner can still switch back to General afterwards.
  useEffect(() => {
    if (restoreApplied.current || !restoredSubject || subjectOptions.length === 0) return
    restoreApplied.current = true
    const match = subjectOptions.find((o) => o.subject === restoredSubject)
    if (match) setSelectedKey(optionKey(match))
  }, [subjectOptions, restoredSubject])

  const fetchRecentSearches = async () => {
    try {
      const res = await fetch("/api/search/history", { cache: "no-store" })
      if (!res.ok) return
      const data = await res.json()
      // The same question can be asked many times; show it once, newest first.
      const seen = new Set<string>()
      const unique: RecentSearch[] = []
      for (const row of data.history ?? []) {
        const key = String(row.query ?? "").trim().toLowerCase()
        if (!key || seen.has(key)) continue
        seen.add(key)
        unique.push({ id: row.id, query: String(row.query).trim() })
        if (unique.length === 5) break
      }
      setRecentSearches(unique)
    } catch {
      // Recent searches are a convenience — never worth surfacing an error.
    }
  }

  useEffect(() => {
    fetchRecentSearches()
    // The old Browse history page linked here with ?q=… — prefill the search
    // bar (but don't auto-send: a link shouldn't spend an AI message by itself).
    const q = new URLSearchParams(window.location.search).get("q")
    if (q) setInput(q.slice(0, 500))
  }, [])

  const deleteRecentSearch = async (query: string) => {
    const before = recentSearches
    setRecentSearches((prev) => prev.filter((r) => r.query !== query))
    try {
      const res = await fetch(`/api/search/history?query=${encodeURIComponent(query)}`, { method: "DELETE" })
      if (!res.ok) throw new Error()
      // Older duplicates of the same question may now surface — refill to 5.
      fetchRecentSearches()
    } catch {
      setRecentSearches(before)
      toast.error("Could not remove that search. Please try again.")
    }
  }

  // Fetch saved notes for source selection
  const fetchSavedNotes = async () => {
    setLoadingNotes(true)
    try {
      const { data } = await supabase
        .from("notes")
        .select("id, title, content")
        .order("updated_at", { ascending: false })
        .limit(20)
      if (data) {
        setSavedNotes(data)
      }
    } catch (error) {
      console.error("Error fetching notes:", error)
    } finally {
      setLoadingNotes(false)
    }
  }

  useEffect(() => {
    if (showSourcePanel) {
      fetchSavedNotes()
    }
  }, [showSourcePanel])

  // Handle PDF upload - extract text client-side using pdfjs-dist
  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    for (const file of Array.from(files)) {
      if (file.type !== "application/pdf" && !file.name.endsWith(".pdf")) {
        toast.error("Please upload PDF files only")
        continue
      }

      if (file.size > 10 * 1024 * 1024) {
        toast.error("File size must be less than 10MB")
        continue
      }

      toast.loading(`Processing ${file.name}...`, { id: `pdf-${file.name}` })

      try {
        // Dynamically import pdfjs-dist for client-side extraction
        const pdfjsLib = await import("pdfjs-dist")
        pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`

        const arrayBuffer = await file.arrayBuffer()
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise

        let fullText = ""
        const totalPages = pdf.numPages

        for (let i = 1; i <= totalPages; i++) {
          const page = await pdf.getPage(i)
          const textContent = await page.getTextContent()
          const pageText = textContent.items.map((item: { str?: string }) => item.str || "").join(" ")
          fullText += pageText + "\n\n"
        }

        if (!fullText.trim()) {
          throw new Error("Could not extract text. The PDF may be image-based.")
        }

        const newSource: StudySource = {
          id: `pdf-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          type: "pdf",
          name: file.name,
          content: fullText.trim(),
        }
        setStudySources((prev) => [...prev, newSource])
        toast.success(`Added ${file.name}`, { id: `pdf-${file.name}` })
      } catch (error) {
        console.error("PDF extraction error:", error)
        toast.error(`Failed to process ${file.name}`, { id: `pdf-${file.name}` })
      }
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  // Handle image upload
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    for (const file of Array.from(files)) {
      if (!file.type.startsWith("image/")) {
        toast.error("Please upload image files only")
        continue
      }

      // Convert to base64 for vision API
      const reader = new FileReader()
      reader.onload = (event) => {
        const result = event.target?.result as string
        const newSource: StudySource = {
          id: `img-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          type: "image",
          name: file.name,
          content: result, // base64 data URL
          thumbnail: result,
        }
        setStudySources((prev) => [...prev, newSource])
        toast.success(`Added ${file.name}`)
      }
      reader.readAsDataURL(file)
    }

    if (imageInputRef.current) {
      imageInputRef.current.value = ""
    }
  }

  // Add text as source
  const handleAddText = () => {
    if (!textInput.trim()) return

    const newSource: StudySource = {
      id: `text-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      type: "text",
      name: `Text ${studySources.filter((s) => s.type === "text").length + 1}`,
      content: textInput.trim(),
    }
    setStudySources((prev) => [...prev, newSource])
    setTextInput("")
    toast.success("Text added as study source")
  }

  // Add note as source
  const handleAddNote = (note: { id: string; title: string; content: string }) => {
    if (studySources.some((s) => s.id === note.id)) {
      toast.error("This note is already added")
      return
    }

    const newSource: StudySource = {
      id: note.id,
      type: "note",
      name: note.title,
      content: note.content || "",
    }
    setStudySources((prev) => [...prev, newSource])
    toast.success(`Added "${note.title}"`)
  }

  // Remove source
  const removeSource = (id: string) => {
    setStudySources((prev) => prev.filter((s) => s.id !== id))
  }

  // `textOverride` lets a quick action or recent search send straight away
  // instead of going through the input box.
  const handleSend = async (textOverride?: string) => {
    const userMessage = (textOverride ?? input).trim()
    if (!userMessage || isLoading) return

    const isFirstMessage = messages.length === 0
    const activeOption = subjectOptions.find((o) => optionKey(o) === selectedKey)
    setInput("")
    setIsLoading(true)

    const newUserMessage: Message = {
      role: "user",
      content: userMessage,
      timestamp: new Date().toISOString(),
    }
    setMessages((prev) => [...prev, newUserMessage])

    try {
      const response = await fetch("/api/tutor/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMessage,
          sessionId,
          subject: activeOption?.subject ?? null,
          syllabus: activeOption?.syllabus ?? null,
          studyMode,
          studySources: studyMode ? studySources.map((s) => ({
            id: s.id,
            type: s.type,
            name: s.name,
            content: s.content,
          })) : [],
        }),
      })

      const data = await response.json()

      // Blocked by the explicit-content screen: take the question back out of
      // the conversation and show the notice, rather than leaving it behind
      // with a generic "I encountered an error" reply.
      if (response.status === 403 && data.error === "inappropriate_content") {
        setMessages((prev) => prev.slice(0, -1))
        setShowInappropriateNotice(true)
        return
      }

      if (!response.ok) {
        throw new Error(data.error || "Failed to get response")
      }

      if (data.sessionId && !sessionId) {
        setSessionId(data.sessionId)
      }

      const assistantMessage: Message = {
        role: "assistant",
        content: data.message,
        timestamp: new Date().toISOString(),
        sources: data.citedSources || [],
      }
      setMessages((prev) => [...prev, assistantMessage])

      // Feed the Recent searches list — the opening question of a conversation
      // is the "search"; follow-ups within it aren't.
      if (isFirstMessage) {
        fetch("/api/search/history", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: userMessage }),
        })
          .then(() => fetchRecentSearches())
          .catch(() => {})
      }
    } catch (error) {
      console.error("Chat error:", error)
      const errorMessage: Message = {
        role: "assistant",
        content: "I apologize, but I encountered an error. Please try again.",
        timestamp: new Date().toISOString(),
      }
      setMessages((prev) => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
      textareaRef.current?.focus()
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const copyMessage = async (content: string, index: number) => {
    await navigator.clipboard.writeText(content)
    setCopiedIndex(index)
    setTimeout(() => setCopiedIndex(null), 2000)
  }

  const startNewChat = async () => {
    setMessages([])
    setSessionId(null)
  }

  // Quick action handlers
  const handleQuickAction = (action: string, messageContent: string) => {
    let prompt = ""
    switch (action) {
      case "simplify":
        prompt = `Please simplify this explanation: "${messageContent.slice(0, 500)}..."`
        break
      case "fast-revision":
        prompt = `Explain this quickly for fast revision: "${messageContent.slice(0, 500)}..."`
        break
      case "turn-to-notes":
        prompt = `Turn this explanation into concise revision notes: "${messageContent.slice(0, 500)}..."`
        break
      case "generate-flashcards":
        prompt = `Generate 5 flashcards from this explanation: "${messageContent.slice(0, 500)}..."`
        break
      case "step-by-step":
        prompt = "Please teach me this step by step"
        break
      case "quiz-me":
        prompt = "Quiz me on this topic"
        break
    }
    setInput(prompt)
    textareaRef.current?.focus()
  }

  // Only used when studying from uploaded materials. Otherwise the welcome
  // screen shows the Quick Actions carried over from Browse.
  const studyReady = studyMode && studySources.length > 0
  const quickPrompts = [
    "Explain the main concepts from my materials",
    "Quiz me on my study materials",
    "Summarize the key points",
    "What are the most important things to remember?",
  ]
  const multiSyllabus = new Set(subjectOptions.map((o) => o.syllabus)).size > 1

  const getSourceIcon = (type: string) => {
    switch (type) {
      case "pdf":
        return <FileText className="h-3 w-3" />
      case "image":
        return <ImageIcon className="h-3 w-3" />
      case "text":
        return <Type className="h-3 w-3" />
      case "note":
        return <StickyNote className="h-3 w-3" />
      default:
        return <FileText className="h-3 w-3" />
    }
  }

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="flex-shrink-0 border-b bg-card/50 backdrop-blur-sm px-4 py-3 safe-area-top">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            {showBackButton && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => router.push("/dashboard")}
                className="flex-shrink-0 -ml-2"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
            )}
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center flex-shrink-0">
              <Sparkles className="h-5 w-5 text-primary-foreground" />
            </div>
            <div className="min-w-0">
              <h1 className="text-lg font-semibold text-foreground truncate">Study AI</h1>
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="secondary" className="text-xs">
                  {styleLabels[profile.learning_style] || "Step-by-Step"}
                </Badge>
                {studyMode && (
                  <Badge variant="default" className="text-xs bg-green-600">
                    Study Mode
                  </Badge>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <Button 
              variant={showSourcePanel ? "default" : "ghost"} 
              size="icon" 
              onClick={() => setShowSourcePanel(!showSourcePanel)} 
              title="Add Study Materials"
            >
              <Layers className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={startNewChat} title="New Chat">
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={onOpenSettings} title="Settings">
              <Settings className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Study Sources Display */}
        {studySources.length > 0 && (
          <div className="mt-3 space-y-2">
            {/* Toggle and count */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Switch
                  id="study-mode"
                  checked={studyMode}
                  onCheckedChange={setStudyMode}
                />
                <Label htmlFor="study-mode" className="text-sm font-medium">
                  Study Mode
                </Label>
                <Badge variant="secondary" className="text-xs">
                  {studySources.length} material{studySources.length > 1 ? "s" : ""}
                </Badge>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs h-7"
                onClick={() => setStudySources([])}
              >
                Clear All
              </Button>
            </div>
            
            {/* Materials Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
              {studySources.map((source) => (
                <div
                  key={source.id}
                  className={`relative group rounded-lg border-2 overflow-hidden transition-all ${
                    studyMode ? "border-primary bg-primary/5" : "border-border bg-muted/30"
                  }`}
                >
                  {/* Thumbnail or Icon */}
                  {source.type === "image" && source.thumbnail ? (
                    <div className="aspect-video bg-muted">
                      <img
                        src={source.thumbnail}
                        alt={source.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ) : (
                    <div className="aspect-video bg-muted/50 flex items-center justify-center">
                      {source.type === "pdf" && <FileText className="h-8 w-8 text-red-500" />}
                      {source.type === "text" && <Type className="h-8 w-8 text-blue-500" />}
                      {source.type === "note" && <StickyNote className="h-8 w-8 text-yellow-500" />}
                    </div>
                  )}
                  
                  {/* Name and Remove */}
                  <div className="p-2">
                    <p className="text-xs font-medium truncate" title={source.name}>
                      {source.name}
                    </p>
                    <p className="text-xs text-muted-foreground capitalize">{source.type}</p>
                  </div>
                  
                  {/* Remove Button */}
                  <button
                    onClick={() => removeSource(source.id)}
                    className="absolute top-1 right-1 h-6 w-6 rounded-full bg-background/80 backdrop-blur-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive hover:text-destructive-foreground"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                  
                  {/* Active indicator */}
                  {studyMode && (
                    <div className="absolute top-1 left-1">
                      <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Subject options — built from the learner's selected syllabus and
            subjects. This replaces the old chips, which came from a free-text
            list typed in during onboarding and never reached the model. */}
        {!studyMode && (
          <div className="flex items-center gap-2 mt-3 overflow-x-auto pb-1 scrollbar-hide">
            <span className="text-xs text-muted-foreground flex-shrink-0">Subject:</span>
            {subjectOptions.length > 0 ? (
              <div className="flex gap-1.5">
                <Badge
                  variant={!selectedKey ? "default" : "outline"}
                  className="cursor-pointer text-xs whitespace-nowrap"
                  onClick={() => setSelectedKey("")}
                >
                  General
                </Badge>
                {subjectOptions.map((o) => (
                  <Badge
                    key={optionKey(o)}
                    variant={selectedKey === optionKey(o) ? "default" : "outline"}
                    className="cursor-pointer text-xs whitespace-nowrap"
                    title={`${o.subject} — ${o.syllabus}`}
                    onClick={() => setSelectedKey(optionKey(o))}
                  >
                    {multiSyllabus ? `${o.subject} (${o.syllabus})` : o.subject}
                  </Badge>
                ))}
              </div>
            ) : subjectsLoaded ? (
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                Choose your syllabus and subjects on your{" "}
                <Link href="/dashboard" className="underline hover:text-foreground">
                  dashboard
                </Link>{" "}
                to get subject options.
              </span>
            ) : null}
          </div>
        )}
      </div>

      {/* Source Panel */}
      {showSourcePanel && (
        <div className="flex-shrink-0 border-b bg-muted/30 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium">Add Study Materials</h3>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setShowSourcePanel(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          <Tabs defaultValue="upload" className="w-full">
            <TabsList className="grid grid-cols-4 w-full">
              <TabsTrigger value="upload" className="text-xs gap-1">
                <Upload className="h-3 w-3" />
                PDF
              </TabsTrigger>
              <TabsTrigger value="image" className="text-xs gap-1">
                <ImageIcon className="h-3 w-3" />
                Image
              </TabsTrigger>
              <TabsTrigger value="text" className="text-xs gap-1">
                <Type className="h-3 w-3" />
                Text
              </TabsTrigger>
              <TabsTrigger value="notes" className="text-xs gap-1">
                <Folder className="h-3 w-3" />
                Notes
              </TabsTrigger>
            </TabsList>

            <TabsContent value="upload" className="mt-3">
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf"
                multiple
                onChange={handlePdfUpload}
                className="hidden"
              />
              <div
                className="w-full h-24 border-2 border-dashed rounded-lg flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-primary hover:bg-primary/5 transition-all"
                onClick={() => fileInputRef.current?.click()}
              >
                <div className="h-10 w-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                  <FileText className="h-5 w-5 text-red-600 dark:text-red-400" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium">Upload PDF Documents</p>
                  <p className="text-xs text-muted-foreground">Max 10MB per file</p>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="image" className="mt-3">
              <input
                ref={imageInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handleImageUpload}
                className="hidden"
              />
              <div
                className="w-full h-24 border-2 border-dashed rounded-lg flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-primary hover:bg-primary/5 transition-all"
                onClick={() => imageInputRef.current?.click()}
              >
                <div className="h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                  <ImageIcon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium">Upload Images</p>
                  <p className="text-xs text-muted-foreground">Diagrams, slides, textbook photos</p>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="text" className="mt-3 space-y-3">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="h-6 w-6 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                    <Type className="h-3 w-3 text-blue-600 dark:text-blue-400" />
                  </div>
                  <span className="text-sm font-medium">Paste Study Material</span>
                </div>
                <Textarea
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  placeholder="Paste your study material, notes, or any text content here..."
                  className="min-h-[100px] text-sm"
                />
              </div>
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                  {textInput.length > 0 ? `${textInput.length} characters` : "No content yet"}
                </p>
                <Button size="sm" onClick={handleAddText} disabled={!textInput.trim()}>
                  Add as Study Material
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="notes" className="mt-3">
              {loadingNotes ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-5 w-5 animate-spin" />
                </div>
              ) : savedNotes.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No saved notes found</p>
              ) : (
                <div className="max-h-40 overflow-y-auto space-y-1">
                  {savedNotes.map((note) => (
                    <button
                      key={note.id}
                      onClick={() => handleAddNote(note)}
                      className="w-full text-left p-2 rounded-lg hover:bg-muted transition-colors flex items-center gap-2"
                      disabled={studySources.some((s) => s.id === note.id)}
                    >
                      <StickyNote className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <span className="text-sm truncate">{note.title}</span>
                      {studySources.some((s) => s.id === note.id) && (
                        <Check className="h-4 w-4 text-green-500 ml-auto" />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      )}

      {/* Messages */}
      <div ref={chatContainerRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4 relative">
        {messages.length === 0 ? (
          <div className="mx-auto w-full max-w-5xl px-2 sm:px-4 py-4 sm:py-6">
            {/* Hero (from Browse) */}
            <div className="text-center mb-8 sm:mb-10 mt-2 sm:mt-6">
              <div className="inline-flex p-3 sm:p-4 bg-emerald-100 rounded-2xl mb-4 sm:mb-6">
                <Search className="h-8 w-8 sm:h-12 sm:w-12 text-emerald-600" />
              </div>
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-foreground mb-3 sm:mb-4 px-4">
                Study Smarter, Learn Faster
              </h2>
              <p className="text-base sm:text-lg text-muted-foreground px-4">
                Personal tutor with instant summaries and educational content
              </p>
            </div>

            {/* The one search bar. Browse's search bar and this chat's input
                box are merged: the welcome screen uses this, and once a
                conversation is under way the input moves to the bottom. */}
            <form
              onSubmit={(e) => {
                e.preventDefault()
                handleSend()
              }}
              className="mb-6 sm:mb-8"
            >
              <div className="flex flex-col sm:flex-row gap-3 max-w-3xl mx-auto">
                <div className="relative flex-1">
                  <Search className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground" />
                  <Input
                    type="text"
                    placeholder={studyReady ? "Ask about your study materials..." : "Ask anything... (e.g., 'Explain photosynthesis')"}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    disabled={isLoading}
                    className="h-12 sm:h-14 pl-10 sm:pl-12 text-sm sm:text-base rounded-xl border-2"
                  />
                </div>
                <Button
                  type="submit"
                  size="lg"
                  disabled={isLoading || !input.trim()}
                  className="h-12 sm:h-14 px-6 sm:px-8 rounded-xl font-semibold"
                >
                  {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Search"}
                </Button>
              </div>
              {studyReady && (
                <p className="text-xs text-muted-foreground text-center mt-3">
                  {`Studying from ${studySources.length} source${studySources.length > 1 ? "s" : ""} - answers based on your materials only`}
                </p>
              )}
            </form>

            {/* Image sources get their two one-tap starters here (they used to
                sit in the bottom input bar, which is hidden on this screen). */}
            {studyMode && studySources.some((src) => src.type === "image") && (
              <div className="flex items-center justify-center gap-2 mb-6 flex-wrap">
                <Button variant="outline" size="sm" className="text-xs h-8" onClick={() => handleQuickAction("step-by-step", "")}>
                  <ListChecks className="h-3 w-3 mr-1" />
                  Teach step by step
                </Button>
                <Button variant="outline" size="sm" className="text-xs h-8" onClick={() => handleQuickAction("quiz-me", "")}>
                  <BookMarked className="h-3 w-3 mr-1" />
                  Quiz me from this
                </Button>
              </div>
            )}

            {studyReady ? (
              <div className="mb-8">
                <h3 className="text-base sm:text-lg font-semibold text-muted-foreground mb-3 sm:mb-4 px-2">
                  Ask about your materials
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {quickPrompts.map((prompt) => (
                    <button
                      key={prompt}
                      onClick={() => setInput(prompt)}
                      className="text-left p-3 rounded-lg border border-border hover:bg-muted/50 hover:border-primary/30 transition-all text-sm text-muted-foreground hover:text-foreground"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <>
                {/* Quick Actions (from Browse) */}
                <div className="mb-8 sm:mb-12">
                  <h3 className="text-base sm:text-lg font-semibold text-muted-foreground mb-3 sm:mb-4 px-2">Quick Actions</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                    {QUICK_ACTIONS.map((a) => (
                      <Card
                        key={a.title}
                        className="cursor-pointer hover:shadow-lg transition-shadow border-2"
                        onClick={() => handleSend(a.query)}
                      >
                        <CardContent className="p-4 sm:p-6">
                          <div className="flex items-start gap-3 sm:gap-4">
                            <div className={`p-2 sm:p-3 ${a.tile} rounded-lg flex-shrink-0`}>
                              <a.icon className={`h-5 w-5 sm:h-6 sm:w-6 ${a.glyph}`} />
                            </div>
                            <div>
                              <h4 className="font-semibold text-base sm:text-lg mb-1">{a.title}</h4>
                              <p className="text-xs sm:text-sm text-muted-foreground">{a.description}</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>

                {/* Recent Searches (from Browse), now with a delete button on each */}
                <div>
                  <h3 className="text-base sm:text-lg font-semibold text-muted-foreground mb-3 sm:mb-4 px-2">Recent Searches</h3>
                  {recentSearches.length === 0 ? (
                    <Card className="border-2">
                      <CardContent className="p-6 sm:p-8 text-center">
                        <p className="text-sm sm:text-base text-muted-foreground">No recent searches yet. Start exploring!</p>
                      </CardContent>
                    </Card>
                  ) : (
                    <div className="space-y-2">
                      {recentSearches.map((item) => (
                        <Card key={item.query} className="border-2 hover:shadow-md transition-shadow">
                          <CardContent className="p-1.5 sm:p-2">
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => handleSend(item.query)}
                                disabled={isLoading}
                                className="flex min-w-0 flex-1 items-center gap-3 rounded-md px-2.5 py-2 text-left"
                              >
                                <Search className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                                <span className="text-sm font-medium truncate">{item.query}</span>
                              </button>
                              <button
                                onClick={() => deleteRecentSearch(item.query)}
                                aria-label={`Remove "${item.query}" from recent searches`}
                                title="Remove"
                                className="shrink-0 rounded-md p-2 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        ) : (
          <>
            {messages.map((message, index) => (
              <div
                key={index}
                className={`flex ${message.role === "user" ? "justify-end" : "justify-start"} animate-in fade-in slide-in-from-bottom-2 duration-300`}
              >
                <div
                  className={`max-w-[85%] sm:max-w-[75%] ${
                    message.role === "user"
                      ? "bg-primary text-primary-foreground rounded-2xl rounded-br-md px-4 py-3"
                      : "bg-muted/50 border border-border rounded-2xl rounded-bl-md px-4 py-3"
                  }`}
                >
                  {message.role === "assistant" ? (
                    <ChatMarkdown content={message.content} />
                  ) : (
                    <div className="whitespace-pre-wrap text-sm leading-relaxed">{message.content}</div>
                  )}

                  {/* Source Citations */}
                  {message.role === "assistant" && message.sources && message.sources.length > 0 && (
                    <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-border/50">
                      <Quote className="h-3 w-3 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">Sources:</span>
                      {message.sources.map((sourceId, idx) => {
                        const source = studySources.find((s) => s.id === sourceId)
                        return source ? (
                          <Badge key={idx} variant="outline" className="text-xs gap-1">
                            {getSourceIcon(source.type)}
                            {source.name}
                          </Badge>
                        ) : null
                      })}
                    </div>
                  )}

                  {/* Message Actions (for assistant messages) */}
                  {message.role === "assistant" && (
                    <div className="flex items-center gap-1 mt-2 pt-2 border-t border-border/50 flex-wrap">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => copyMessage(message.content, index)}
                        title="Copy"
                      >
                        {copiedIndex === index ? (
                          <Check className="h-3.5 w-3.5 text-green-500" />
                        ) : (
                          <Copy className="h-3.5 w-3.5" />
                        )}
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" title="Helpful">
                        <ThumbsUp className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" title="Not helpful">
                        <ThumbsDown className="h-3.5 w-3.5" />
                      </Button>
                      <div className="h-4 w-px bg-border mx-1" />
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs gap-1"
                        onClick={() => handleQuickAction("simplify", message.content)}
                        title="Simplify"
                      >
                        <Lightbulb className="h-3 w-3" />
                        Simplify
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs gap-1"
                        onClick={() => handleQuickAction("turn-to-notes", message.content)}
                        title="Turn into notes"
                      >
                        <StickyNote className="h-3 w-3" />
                        Notes
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs gap-1"
                        onClick={() => handleQuickAction("generate-flashcards", message.content)}
                        title="Generate flashcards"
                      >
                        <Zap className="h-3 w-3" />
                        Flashcards
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-muted/50 border border-border rounded-2xl rounded-bl-md px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    <span className="text-sm text-muted-foreground">
                      {studyMode ? "Analyzing your materials..." : "Thinking..."}
                    </span>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </>
        )}

        {/* Scroll to bottom button */}
        {showScrollButton && (
          <button
            onClick={scrollToBottom}
            className="fixed bottom-28 right-6 sm:right-8 h-10 w-10 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center hover:scale-105 transition-transform z-10"
          >
            <ChevronDown className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* Input Area — only once a conversation has started. On the welcome
          screen the merged search bar above is the input, so showing this too
          would put two search bars on one screen. */}
      {messages.length > 0 && (
      <div className="flex-shrink-0 border-t bg-card/80 backdrop-blur-sm p-4 pb-safe">
        <div className="flex items-end gap-2 max-w-4xl mx-auto">
          <div className="flex-1 relative">
            <Textarea
              ref={textareaRef}
              placeholder={studyMode && studySources.length > 0 
                ? "Ask about your study materials..." 
                : "Ask me anything..."}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isLoading}
              className="min-h-[48px] max-h-[200px] resize-none pr-12 rounded-xl border-border focus:border-primary"
              rows={1}
            />
          </div>
          <Button
            onClick={() => handleSend()}
            disabled={!input.trim() || isLoading}
            size="icon"
            className="h-12 w-12 rounded-xl flex-shrink-0"
          >
            {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground text-center mt-2">
          {studyMode && studySources.length > 0 
            ? `Studying from ${studySources.length} source${studySources.length > 1 ? "s" : ""} - answers based on your materials only`
            : "Press Enter to send, Shift+Enter for new line"}
        </p>
      </div>
      )}

      {/* Same notice Browse showed for blocked queries. */}
      <InappropriateSearchNotice
        isOpen={showInappropriateNotice}
        onClose={() => {
          setShowInappropriateNotice(false)
          setInput("")
        }}
      />
    </div>
  )
}

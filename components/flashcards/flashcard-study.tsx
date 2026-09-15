"use client"

import type React from "react"
import { useState, useCallback, useEffect, useMemo } from "react"
import { createPortal } from "react-dom"
import { motion, AnimatePresence } from "framer-motion"
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  RotateCw,
  Gamepad2,
  Shuffle,
  ArrowLeftRight,
  Flag,
  Pencil,
  Trash2,
  AlertTriangle,
  FileText,
  CheckCircle2,
  XCircle,
  MinusCircle,
  FolderInput,
  CheckSquare,
  Square,
  Search,
  X,
  Maximize2,
  Minimize2,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { createBrowserClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import Link from "next/link"
import type { Flashcard } from "@/lib/types/study"

interface FlashcardStudyProps {
  deck: any
  flashcards: Flashcard[]
  allTags?: string[]
  refreshRef?: React.MutableRefObject<(() => Promise<void>) | null>
}

function parseClozeText(text: string, showAnswer: boolean): string {
  if (!text) return ""
  const regex = /\{\{c\d+::([^:}]+)(?:::([^}]+))?\}\}/g
  if (showAnswer) {
    return text.replace(
      regex,
      '<span class="bg-emerald-200 dark:bg-emerald-800 px-1 rounded font-semibold">$1</span>',
    )
  }
  return text.replace(regex, (_, _answer, hint) => {
    return `<span class="bg-muted px-3 py-1 rounded border-2 border-dashed border-muted-foreground/50">${hint || "[...]"}</span>`
  })
}

type ConfidenceLevel = "again" | "hard" | "good" | "easy"

const confidenceConfig: Record<ConfidenceLevel, { label: string; color: string; icon: React.ReactNode; interval: (prev: number) => number }> = {
  again: {
    label: "Again",
    color: "text-red-600 border-red-300 bg-red-50 hover:bg-red-100 dark:bg-red-950/30 dark:border-red-800 dark:text-red-400",
    icon: <XCircle className="h-4 w-4" />,
    interval: () => 1,
  },
  hard: {
    label: "Hard",
    color: "text-orange-600 border-orange-300 bg-orange-50 hover:bg-orange-100 dark:bg-orange-950/30 dark:border-orange-800 dark:text-orange-400",
    icon: <MinusCircle className="h-4 w-4" />,
    interval: (prev) => Math.max(1, Math.ceil(prev * 0.6)),
  },
  good: {
    label: "Good",
    color: "text-blue-600 border-blue-300 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/30 dark:border-blue-800 dark:text-blue-400",
    icon: <CheckCircle2 className="h-4 w-4" />,
    interval: (prev) => Math.max(3, prev + 2),
  },
  easy: {
    label: "Easy",
    color: "text-emerald-600 border-emerald-300 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/30 dark:border-emerald-800 dark:text-emerald-400",
    icon: <CheckCircle2 className="h-4 w-4" />,
    interval: (prev) => Math.min(prev * 2, 30),
  },
}

export function FlashcardStudy({ deck, flashcards: initialFlashcards, allTags: initialTags = [], refreshRef }: FlashcardStudyProps) {
  const [flashcards, setFlashcards] = useState(initialFlashcards)
  const [allTags, setAllTags] = useState(initialTags)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [reverseMode, setReverseMode] = useState(false)
  const [sessionStats, setSessionStats] = useState({ again: 0, hard: 0, good: 0, easy: 0 })
  const [difficultIds, setDifficultIds] = useState<Set<string>>(new Set())
  const [convertLoading, setConvertLoading] = useState(false)
  const [focusMode, setFocusMode] = useState(false)

  // Filters — all live here, applied together via useMemo
  const [priorityFilter, setPriorityFilter] = useState<string>("all")
  const [activeTag, setActiveTag] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")

  // Move cards state
  const [moveOpen, setMoveOpen] = useState(false)
  const [allSets, setAllSets] = useState<any[]>([])
  const [selectedCards, setSelectedCards] = useState<Set<string>>(new Set())
  const [selectMode, setSelectMode] = useState(false)
  const [moveLoading, setMoveLoading] = useState(false)

  const router = useRouter()
  const supabase = createBrowserClient()

  // Keep flashcards in sync when prop changes (deck switch)
  useEffect(() => {
    setFlashcards(initialFlashcards)
    setAllTags(initialTags)
    setCurrentIndex(0)
    setFlipped(false)
    setActiveTag(null)
    setSearchQuery("")
    setPriorityFilter("all")
  }, [deck.id])

  // Expose a refreshCards function via ref so parent can trigger it silently
  const refreshCards = useCallback(async () => {
    const { data } = await supabase
      .from("flashcards")
      .select("*")
      .eq("deck_id", deck.id)
      .order("created_at", { ascending: false })
    if (data) {
      setFlashcards(data as Flashcard[])
      const tags = Array.from(new Set(data.flatMap((f: any) => f.tags || []))).sort() as string[]
      setAllTags(tags)
    }
  }, [deck.id])

  useEffect(() => {
    if (refreshRef) refreshRef.current = refreshCards
  }, [refreshRef, refreshCards])

  // Fetch all sets for move dialog
  useEffect(() => {
    const fetchSets = async () => {
      const { data } = await supabase
        .from("flashcard_decks")
        .select("id, name, subject")
        .order("name")
      if (data) setAllSets(data)
    }
    fetchSets()
  }, [])

  const [newCardReverseEnabled, setNewCardReverseEnabled] = useState(false)
  const [newCardClozeText, setNewCardClozeText] = useState("")
  const [newCardPriority, setNewCardPriority] = useState<string>("medium")
  const [useCloze, setUseCloze] = useState(false)

  const [editOpen, setEditOpen] = useState(false)
  const [editQuestion, setEditQuestion] = useState("")
  const [editAnswer, setEditAnswer] = useState("")
  const [editPriority, setEditPriority] = useState<string>("medium")
  const [editLoading, setEditLoading] = useState(false)

  // Single source of truth for filtered cards — all filters applied together
  const filteredFlashcards = useMemo(() => {
    let result = flashcards
    if (priorityFilter !== "all") {
      result = result.filter((c) => (c as any).priority === priorityFilter)
    }
    if (activeTag) {
      result = result.filter((c) => (c as any).tags?.includes(activeTag))
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim()
      result = result.filter(
        (c) =>
          c.question?.toLowerCase().includes(q) ||
          c.answer?.toLowerCase().includes(q) ||
          (c as any).cloze_text?.toLowerCase().includes(q)
      )
    }
    return result
  }, [flashcards, priorityFilter, activeTag, searchQuery])

  // Reset index whenever filters change so we never land on undefined card
  useEffect(() => {
    setCurrentIndex(0)
    setFlipped(false)
  }, [priorityFilter, activeTag, searchQuery])

  // Lock body scroll when focus mode is active
  useEffect(() => {
    if (focusMode) {
      document.body.style.overflow = "hidden"
    } else {
      document.body.style.overflow = ""
    }
    return () => { document.body.style.overflow = "" }
  }, [focusMode])

  const currentCard = filteredFlashcards[currentIndex]
  const isClozeCard = currentCard && (currentCard as any).cloze_text
  const totalReviewed = Object.values(sessionStats).reduce((a, b) => a + b, 0)
  const progressPct = filteredFlashcards.length > 0 ? (totalReviewed / filteredFlashcards.length) * 100 : 0

  const handleRateConfidence = useCallback(
    async (level: ConfidenceLevel) => {
      if (!currentCard) return
      const cfg = confidenceConfig[level]
      const newInterval = cfg.interval(currentCard.review_interval_days || 1)
      const nextReview = new Date()
      nextReview.setDate(nextReview.getDate() + newInterval)

      const difficultyMap: Record<ConfidenceLevel, number> = { again: 1, hard: 2, good: 4, easy: 5 }

      await supabase.from("flashcards").update({
        difficulty: difficultyMap[level],
        review_interval_days: newInterval,
        next_review_date: nextReview.toISOString(),
        times_reviewed: (currentCard.times_reviewed || 0) + 1,
      }).eq("id", currentCard.id)

      setSessionStats((prev) => ({ ...prev, [level]: prev[level] + 1 }))

      if (level === "again") {
        setDifficultIds((prev) => new Set([...prev, currentCard.id]))
      }

      handleNext()
    },
    [currentCard, supabase],
  )

  const handleMarkDifficult = async () => {
    if (!currentCard) return
    setDifficultIds((prev) => new Set([...prev, currentCard.id]))
    await supabase.from("flashcards").update({ priority: "high", difficulty: 1, review_interval_days: 1 }).eq("id", currentCard.id)
    setFlashcards(flashcards.map((c) => c.id === currentCard.id ? { ...c, priority: "high" } : c))
    toast.success("Marked as difficult — priority set to high")
  }

  const handleConvertToNote = async () => {
    if (!currentCard) return
    setConvertLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { toast.error("Not signed in"); return }
      const noteContent = isClozeCard
        ? `Cloze: ${(currentCard as any).cloze_text}`
        : `**Q:** ${currentCard.question}\n\n**A:** ${currentCard.answer}`
      const { error } = await supabase.from("notes").insert({
        user_id: user.id,
        title: isClozeCard ? "Flashcard (Cloze)" : currentCard.question.slice(0, 60),
        content: noteContent,
        subject: deck.subject || "",
        source: "flashcard",
        tags: currentCard.tags || [],
      })
      if (error) throw error
      toast.success("Converted to note!")
    } catch {
      toast.error("Failed to convert to note")
    } finally {
      setConvertLoading(false)
    }
  }

  const handleEditSave = async () => {
    if (!currentCard) return
    setEditLoading(true)
    const { error } = await supabase.from("flashcards").update({
      question: editQuestion,
      answer: editAnswer,
      priority: editPriority,
    }).eq("id", currentCard.id)

    if (error) {
      console.error("[flashcards] update failed:", error)
      toast.error(error.message || "Failed to update card")
    } else {
      toast.success("Card updated!")
      setFlashcards(flashcards.map((c) => c.id === currentCard.id ? { ...c, question: editQuestion, answer: editAnswer, priority: editPriority } : c))
      setEditOpen(false)
      router.refresh()
    }
    setEditLoading(false)
  }

  const handleDeleteCard = async () => {
    if (!currentCard) return
    const { error } = await supabase.from("flashcards").delete().eq("id", currentCard.id)
    if (error) {
      console.error("[flashcards] delete failed:", error)
      toast.error(error.message || "Failed to delete card")
    } else {
      toast.success("Card deleted!")
      const updated = flashcards.filter((c) => c.id !== currentCard.id)
      setFlashcards(updated)
      if (currentIndex >= updated.length && currentIndex > 0) setCurrentIndex(currentIndex - 1)
      setEditOpen(false)
      router.refresh()
    }
  }

  const handleAddCard = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    const formData = new FormData(e.currentTarget)
    const question = formData.get("question") as string
    const answer = formData.get("answer") as string
    const tags = (formData.get("tags") as string).split(",").map((t) => t.trim()).filter(Boolean)

    const { data, error } = await supabase.from("flashcards").insert({
      deck_id: deck.id,
      question: useCloze ? "Cloze Card" : question,
      answer: useCloze ? "" : answer,
      tags,
      reverse_enabled: newCardReverseEnabled,
      cloze_text: useCloze ? newCardClozeText : null,
      priority: newCardPriority,
    }).select().single()

    if (error) {
      // Surface the real Postgres message, not just "Failed to add card".
      // A generic toast is what let a schema mismatch (missing columns,
      // fixed in migration 054) look like cards mysteriously vanishing
      // rather than an error anyone could act on.
      console.error("[flashcards] insert failed:", error)
      toast.error(error.message || "Failed to add card")
    } else {
      toast.success("Card added!")
      setFlashcards([...flashcards, data])
      setOpen(false)
      setNewCardReverseEnabled(false)
      setNewCardClozeText("")
      setNewCardPriority("medium")
      setUseCloze(false)
      router.refresh()
    }
    setLoading(false)
  }

  const handleNext = () => {
    setFlipped(false)
    setTimeout(() => setCurrentIndex((prev) => (prev + 1) % filteredFlashcards.length), 100)
  }

  const handlePrevious = () => {
    setFlipped(false)
    setTimeout(() => setCurrentIndex((prev) => (prev - 1 + filteredFlashcards.length) % filteredFlashcards.length), 100)
  }

  // Keyboard navigation — placed after all handlers so they are initialized
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (filteredFlashcards.length === 0) return

      if (e.key === "Escape" && focusMode) { setFocusMode(false); return }
      if (e.key === "f" || e.key === "F") { setFocusMode((v) => !v); return }
      if (e.key === "ArrowRight" || e.key === "l") handleNext()
      else if (e.key === "ArrowLeft" || e.key === "h") handlePrevious()
      else if (e.key === " " || e.key === "Enter") { e.preventDefault(); setFlipped((v) => !v) }
      else if (e.key === "1") handleRateConfidence("again")
      else if (e.key === "2") handleRateConfidence("hard")
      else if (e.key === "3") handleRateConfidence("good")
      else if (e.key === "4") handleRateConfidence("easy")
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [focusMode, filteredFlashcards.length, flipped, handleNext, handlePrevious, handleRateConfidence])

  const handleShuffle = () => {
    setFlashcards([...flashcards].sort(() => Math.random() - 0.5))
    setCurrentIndex(0)
    setFlipped(false)
    toast.success("Cards shuffled!")
  }

  const handleStudyDifficult = () => {
    if (difficultIds.size === 0) { toast.info("No difficult cards yet"); return }
    setFlashcards(initialFlashcards.filter((c) => difficultIds.has(c.id)))
    setCurrentIndex(0)
    setFlipped(false)
    toast.success(`Studying ${difficultIds.size} difficult cards`)
  }

  const toggleSelectCard = (id: string) => {
    setSelectedCards((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const selectAllCards = () => {
    if (selectedCards.size === filteredFlashcards.length) {
      setSelectedCards(new Set())
    } else {
      setSelectedCards(new Set(filteredFlashcards.map((c) => c.id)))
    }
  }

  const handleMoveCards = async (targetSetId: string) => {
    if (selectedCards.size === 0) {
      toast.error("Select cards to move")
      return
    }
    if (targetSetId === deck.id) {
      toast.error("Cards are already in this set")
      return
    }

    setMoveLoading(true)
    try {
      const response = await fetch("/api/flashcards/move", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          flashcardIds: Array.from(selectedCards),
          targetSetId,
        }),
      })

      if (!response.ok) throw new Error("Failed to move")

      const data = await response.json()
      toast.success(`Moved ${data.moved} card${data.moved !== 1 ? "s" : ""} to new set`)

      // Remove moved cards from current view
      setFlashcards((prev) => prev.filter((c) => !selectedCards.has(c.id)))
      setSelectedCards(new Set())
      setSelectMode(false)
      setMoveOpen(false)
      if (currentIndex >= flashcards.length - selectedCards.size) {
        setCurrentIndex(Math.max(0, currentIndex - selectedCards.size))
      }
      router.refresh()
    } catch {
      toast.error("Failed to move cards")
    } finally {
      setMoveLoading(false)
    }
  }

  if (filteredFlashcards.length === 0) {
    const hasFilters = priorityFilter !== "all" || activeTag || searchQuery
    return (
      <Card>
        <CardContent className="py-12 text-center space-y-4">
          {hasFilters ? (
            <>
              <p className="text-muted-foreground font-medium">No cards match your filters</p>
              <p className="text-sm text-muted-foreground">
                {searchQuery && `Search: "${searchQuery}"`}
                {activeTag && ` Tag: "${activeTag}"`}
                {priorityFilter !== "all" && ` Priority: ${priorityFilter}`}
              </p>
              <Button
                variant="outline"
                onClick={() => { setPriorityFilter("all"); setActiveTag(null); setSearchQuery("") }}
              >
                <X className="h-4 w-4 mr-2" />
                Clear all filters
              </Button>
            </>
          ) : (
            <>
              <p className="text-muted-foreground">No flashcards yet</p>
              <Dialog open={open} onOpenChange={setOpen}>
                <DialogTrigger asChild>
                  <Button><Plus className="mr-2 h-4 w-4" />Add First Card</Button>
                </DialogTrigger>
                <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                  <DialogHeader><DialogTitle>Add Flashcard</DialogTitle></DialogHeader>
                  <AddCardForm
                    useCloze={useCloze} setUseCloze={setUseCloze}
                    newCardClozeText={newCardClozeText} setNewCardClozeText={setNewCardClozeText}
                    newCardPriority={newCardPriority} setNewCardPriority={setNewCardPriority}
                    newCardReverseEnabled={newCardReverseEnabled} setNewCardReverseEnabled={setNewCardReverseEnabled}
                    loading={loading} onSubmit={handleAddCard}
                    idSuffix="-empty"
                  />
                </DialogContent>
              </Dialog>
            </>
          )}
        </CardContent>
      </Card>
    )
  }

  const getCardContent = () => {
    if (isClozeCard) {
      const clozeText = (currentCard as any).cloze_text
      return { front: parseClozeText(clozeText, false), back: parseClozeText(clozeText, true), isCloze: true }
    }
    if (reverseMode && (currentCard as any).reverse_enabled) {
      return { front: currentCard.answer, back: currentCard.question, isCloze: false }
    }
    return { front: currentCard.question, back: currentCard.answer, isCloze: false }
  }

  const cardContent = getCardContent()
  const isDifficult = difficultIds.has(currentCard?.id)

  return (
    <div className="space-y-4">
      {/* Header Controls */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base sm:text-lg truncate">{deck.name}</CardTitle>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <Button variant={flipped ? "default" : "outline"} size="sm" onClick={() => setFlipped((prev) => !prev)} className="h-8 px-2" title={flipped ? "Show question" : "Show answer"}>
                  <ArrowLeftRight className="h-3.5 w-3.5" />
                </Button>
                <Button variant="outline" size="sm" onClick={handleShuffle} className="h-8 px-2">
                  <Shuffle className="h-3.5 w-3.5" />
                </Button>
                <Link href={`/flashcards?deck=${deck.id}&mode=quiz`}>
                  <Button variant="outline" size="sm" className="h-8 px-2">
                    <Gamepad2 className="h-3.5 w-3.5" />
                  </Button>
                </Link>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 px-2"
                  onClick={() => setFocusMode(true)}
                  title="Focus mode (F)"
                >
                  <Maximize2 className="h-3.5 w-3.5" />
                </Button>
                {difficultIds.size > 0 && (
                  <Button variant="outline" size="sm" onClick={handleStudyDifficult} className="h-8 px-2 border-red-300 text-red-600">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    <span className="ml-1 text-xs">{difficultIds.size}</span>
                  </Button>
                )}
              </div>
            </div>

            {/* Unified filter bar */}
            <div className="space-y-2">
              {/* Row 1: search + priority + progress */}
              <div className="flex items-center gap-2">
                {/* Search */}
                <div className="relative flex-1">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                  <Input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search cards..."
                    className="pl-8 h-8 text-xs"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery("")}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                {/* Priority filter */}
                <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                  <SelectTrigger className="w-[100px] h-8 text-xs shrink-0">
                    <Flag className="h-3 w-3 mr-1 shrink-0" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Row 2: tag chips */}
              {allTags.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {allTags.map((tag) => (
                    <button
                      key={tag}
                      onClick={() => setActiveTag(activeTag === tag ? null : tag)}
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium transition-colors ${
                        activeTag === tag
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground hover:bg-muted/80"
                      }`}
                    >
                      {tag}
                      {activeTag === tag && <X className="h-3 w-3" />}
                    </button>
                  ))}
                </div>
              )}

              {/* Row 3: active filter summary + progress */}
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5 flex-wrap">
                  {(priorityFilter !== "all" || activeTag || searchQuery) && (
                    <button
                      onClick={() => { setPriorityFilter("all"); setActiveTag(null); setSearchQuery("") }}
                      className="text-xs text-destructive hover:underline flex items-center gap-0.5"
                    >
                      <X className="h-3 w-3" />
                      Clear all filters
                    </button>
                  )}
                  <span className="text-xs text-muted-foreground">
                    {filteredFlashcards.length} of {flashcards.length} cards
                  </span>
                </div>
                <div className="flex-1 space-y-0.5">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Card {filteredFlashcards.length > 0 ? currentIndex + 1 : 0} / {filteredFlashcards.length}</span>
                    <span>{totalReviewed} reviewed</span>
                  </div>
                  <Progress value={progressPct} className="h-1.5" />
                </div>
              </div>
            </div>

            {/* Session stats */}
            {totalReviewed > 0 && (
              <div className="flex gap-2 flex-wrap">
                {(["again", "hard", "good", "easy"] as ConfidenceLevel[]).map((l) =>
                  sessionStats[l] > 0 ? (
                    <span key={l} className={`text-xs px-2 py-0.5 rounded-full border ${confidenceConfig[l].color}`}>
                      {confidenceConfig[l].label}: {sessionStats[l]}
                    </span>
                  ) : null
                )}
              </div>
            )}

            {/* Card badges */}
            <div className="flex gap-1.5 flex-wrap">
              {(currentCard as any).priority && (
                <Badge variant="outline" className={`text-xs ${
                  (currentCard as any).priority === "high" ? "border-red-300 text-red-600" :
                  (currentCard as any).priority === "medium" ? "border-orange-300 text-orange-600" :
                  "border-emerald-300 text-emerald-600"
                }`}>
                  <Flag className="h-3 w-3 mr-1" />{(currentCard as any).priority}
                </Badge>
              )}
              {isClozeCard && <Badge variant="outline" className="text-xs border-blue-300 text-blue-600">Cloze</Badge>}
              {reverseMode && (currentCard as any).reverse_enabled && <Badge variant="outline" className="text-xs">Reverse</Badge>}
              {isDifficult && <Badge variant="outline" className="text-xs border-red-300 text-red-600"><AlertTriangle className="h-3 w-3 mr-1" />Difficult</Badge>}
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Flashcard */}
      <div className="relative h-[280px] sm:h-[360px] cursor-pointer" onClick={() => setFlipped(!flipped)}>
        <AnimatePresence mode="wait">
          <motion.div
            key={`${currentIndex}-${flipped}`}
            initial={{ rotateY: flipped ? -90 : 90, opacity: 0 }}
            animate={{ rotateY: 0, opacity: 1 }}
            exit={{ rotateY: flipped ? 90 : -90, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="absolute inset-0"
          >
            <Card className={`h-full border-2 transition-colors ${
              flipped
                ? "bg-gradient-to-br from-primary/10 to-blue-500/10 border-primary/30"
                : "bg-card border-border hover:border-primary/20"
            }`}>
              <CardContent className="h-full flex flex-col items-center justify-center p-6 sm:p-10 gap-4">
                <span className={`text-xs font-medium uppercase tracking-wide px-2 py-0.5 rounded-full ${
                  flipped ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"
                }`}>
                  {isClozeCard ? (flipped ? "Revealed" : "Fill in the blank") : flipped ? (reverseMode ? "Question" : "Answer") : (reverseMode ? "Answer" : "Question")}
                </span>
                {cardContent.isCloze ? (
                  <p
                    className="text-lg sm:text-2xl font-medium text-center leading-relaxed"
                    dangerouslySetInnerHTML={{ __html: flipped ? cardContent.back : cardContent.front }}
                  />
                ) : (
                  <p className="text-lg sm:text-2xl font-medium text-center leading-relaxed">
                    {flipped ? cardContent.back : cardContent.front}
                  </p>
                )}
                {currentCard.tags && currentCard.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 justify-center mt-2">
                    {currentCard.tags.map((tag) => (
                      <span key={tag} className="px-2 py-0.5 text-xs bg-primary/10 text-primary rounded-full">{tag}</span>
                    ))}
                  </div>
                )}
                {!flipped && (
                  <p className="text-xs text-muted-foreground mt-2">Tap to reveal</p>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Navigation */}
      <div className="flex gap-2">
        <Button variant="outline" onClick={handlePrevious} className="flex-1 bg-transparent">
          <ChevronLeft className="h-4 w-4 mr-1" />
          <span className="hidden sm:inline">Previous</span>
          <span className="sm:hidden">Prev</span>
        </Button>
        <Button variant="outline" onClick={() => setFlipped(!flipped)} className="px-4">
          <RotateCw className="h-4 w-4" />
        </Button>
        <Button variant="outline" onClick={handleNext} className="flex-1 bg-transparent">
          <span className="hidden sm:inline">Next</span>
          <span className="sm:hidden">Next</span>
          <ChevronRight className="h-4 w-4 ml-1" />
        </Button>
      </div>

      {/* Confidence Rating — shown after flip */}
      <AnimatePresence>
        {flipped && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.2 }}
          >
            <Card>
              <CardContent className="pt-4 pb-4 space-y-3">
                <p className="text-sm font-medium text-center text-muted-foreground">How confident were you?</p>
                <div className="grid grid-cols-4 gap-2">
                  {(["again", "hard", "good", "easy"] as ConfidenceLevel[]).map((level) => {
                    const cfg = confidenceConfig[level]
                    return (
                      <button
                        key={level}
                        onClick={() => handleRateConfidence(level)}
                        className={`flex flex-col items-center gap-1 py-3 px-2 rounded-xl border-2 font-medium transition-all text-sm ${cfg.color}`}
                      >
                        {cfg.icon}
                        <span className="text-xs">{cfg.label}</span>
                      </button>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Card Actions */}
      <div className="flex gap-2 flex-wrap">
        <Button variant="outline" size="sm" onClick={handleMarkDifficult} disabled={isDifficult} className="flex-1 h-9 text-xs">
          <AlertTriangle className="h-3.5 w-3.5 mr-1.5" />
          Mark Difficult
        </Button>

        <Button variant="outline" size="sm" onClick={handleConvertToNote} disabled={convertLoading} className="flex-1 h-9 text-xs">
          <FileText className="h-3.5 w-3.5 mr-1.5" />
          {convertLoading ? "Saving..." : "Save as Note"}
        </Button>

        {/* Edit Dialog */}
        <Dialog open={editOpen} onOpenChange={(open) => {
          setEditOpen(open)
          if (open && currentCard) {
            setEditQuestion(currentCard.question || "")
            setEditAnswer(currentCard.answer || "")
            setEditPriority((currentCard as any).priority || "medium")
          }
        }}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" className="flex-1 h-9 text-xs">
              <Pencil className="h-3.5 w-3.5 mr-1.5" />
              Edit Card
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>Edit Flashcard</DialogTitle></DialogHeader>
            <div className="space-y-4">
              {!isClozeCard && (
                <>
                  <div className="space-y-2">
                    <Label>Question</Label>
                    <Textarea value={editQuestion} onChange={(e) => setEditQuestion(e.target.value)} rows={3} />
                  </div>
                  <div className="space-y-2">
                    <Label>Answer</Label>
                    <Textarea value={editAnswer} onChange={(e) => setEditAnswer(e.target.value)} rows={3} />
                  </div>
                </>
              )}
              <div className="space-y-2">
                <Label>Priority</Label>
                <div className="grid grid-cols-3 gap-2">
                  {(["high", "medium", "low"] as const).map((p) => (
                    <button
                      key={p}
                      onClick={() => setEditPriority(p)}
                      className={`py-2 rounded-lg border-2 text-sm font-medium transition-all capitalize ${
                        editPriority === p
                          ? p === "high" ? "border-red-500 bg-red-500 text-white"
                          : p === "medium" ? "border-orange-500 bg-orange-500 text-white"
                          : "border-emerald-500 bg-emerald-500 text-white"
                          : "border-border hover:border-primary/40"
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex gap-2">
                <Button onClick={handleEditSave} disabled={editLoading} className="flex-1">
                  {editLoading ? "Saving..." : "Save Changes"}
                </Button>
                <Button variant="destructive" onClick={handleDeleteCard}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Add Card Dialog */}
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="h-9 text-xs px-3">
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              Add Card
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Add Flashcard</DialogTitle></DialogHeader>
            <AddCardForm
              useCloze={useCloze} setUseCloze={setUseCloze}
              newCardClozeText={newCardClozeText} setNewCardClozeText={setNewCardClozeText}
              newCardPriority={newCardPriority} setNewCardPriority={setNewCardPriority}
              newCardReverseEnabled={newCardReverseEnabled} setNewCardReverseEnabled={setNewCardReverseEnabled}
              loading={loading} onSubmit={handleAddCard}
              idSuffix="-main"
            />
          </DialogContent>
        </Dialog>

        {/* Focus Mode Portal */}
        {focusMode && typeof window !== "undefined" && createPortal(
          <AnimatePresence>
            <motion.div
              key="focus-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-black/95 p-6 backdrop-blur-sm"
              onClick={(e) => { if (e.target === e.currentTarget) setFocusMode(false) }}
            >
              {/* Top bar */}
              <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-6 py-4">
                <div className="flex items-center gap-3">
                  <span className="text-white/50 text-sm font-medium truncate max-w-[200px]">{deck.name}</span>
                  <span className="text-white/30 text-xs">·</span>
                  <span className="text-white/40 text-xs">{currentIndex + 1} / {filteredFlashcards.length}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-white/30 text-xs hidden sm:block">Esc to exit · Space to flip · ← → to navigate · 1-4 to rate</span>
                  <button
                    onClick={() => setFocusMode(false)}
                    className="p-2 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-colors"
                  >
                    <Minimize2 className="h-5 w-5" />
                  </button>
                </div>
              </div>

              {/* Progress bar */}
              <div className="absolute top-0 left-0 right-0 h-0.5 bg-white/10">
                <motion.div
                  className="h-full bg-primary"
                  initial={{ width: 0 }}
                  animate={{ width: `${progressPct}%` }}
                  transition={{ duration: 0.4, ease: "easeOut" }}
                />
              </div>

              {/* Card area */}
              <div
                className="relative w-full max-w-2xl cursor-pointer select-none"
                style={{ height: "clamp(260px, 40vh, 420px)" }}
                onClick={() => setFlipped((v) => !v)}
              >
                <AnimatePresence mode="wait">
                  <motion.div
                    key={`focus-${currentIndex}-${flipped}`}
                    initial={{ rotateY: flipped ? -80 : 80, opacity: 0, scale: 0.97 }}
                    animate={{ rotateY: 0, opacity: 1, scale: 1 }}
                    exit={{ rotateY: flipped ? 80 : -80, opacity: 0, scale: 0.97 }}
                    transition={{ duration: 0.22, ease: "easeOut" }}
                    className="absolute inset-0"
                  >
                    <div className={`h-full rounded-2xl border flex flex-col items-center justify-center p-8 sm:p-14 gap-5 transition-colors ${
                      flipped
                        ? "bg-primary/15 border-primary/40"
                        : "bg-white/5 border-white/10"
                    }`}>
                      <span className={`text-xs font-medium uppercase tracking-widest px-3 py-1 rounded-full ${
                        flipped ? "bg-primary/30 text-primary-foreground/90" : "bg-white/10 text-white/40"
                      }`}>
                        {isClozeCard
                          ? (flipped ? "Revealed" : "Fill in the blank")
                          : flipped ? (reverseMode ? "Question" : "Answer") : (reverseMode ? "Answer" : "Question")}
                      </span>
                      {cardContent.isCloze ? (
                        <p
                          className="text-xl sm:text-3xl font-medium text-center leading-relaxed text-white"
                          dangerouslySetInnerHTML={{ __html: flipped ? cardContent.back : cardContent.front }}
                        />
                      ) : (
                        <p className="text-xl sm:text-3xl font-medium text-center leading-relaxed text-white">
                          {flipped ? cardContent.back : cardContent.front}
                        </p>
                      )}
                      {!flipped && (
                        <p className="text-xs text-white/30 mt-1">Tap or press Space to reveal</p>
                      )}
                    </div>
                  </motion.div>
                </AnimatePresence>
              </div>

              {/* Navigation row */}
              <div className="flex items-center gap-4 mt-8">
                <button
                  onClick={handlePrevious}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/8 hover:bg-white/14 text-white/70 hover:text-white transition-colors border border-white/10 text-sm"
                >
                  <ChevronLeft className="h-4 w-4" /> Prev
                </button>
                <button
                  onClick={() => setFlipped((v) => !v)}
                  className="px-5 py-2.5 rounded-xl bg-white/8 hover:bg-white/14 text-white/70 hover:text-white transition-colors border border-white/10"
                >
                  <RotateCw className="h-4 w-4" />
                </button>
                <button
                  onClick={handleNext}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/8 hover:bg-white/14 text-white/70 hover:text-white transition-colors border border-white/10 text-sm"
                >
                  Next <ChevronRight className="h-4 w-4" />
                </button>
              </div>

              {/* Confidence rating — appears after flip */}
              <AnimatePresence>
                {flipped && (
                  <motion.div
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 8 }}
                    transition={{ duration: 0.18 }}
                    className="mt-6 w-full max-w-sm"
                  >
                    <p className="text-white/40 text-xs text-center mb-3 font-medium">How confident were you?</p>
                    <div className="grid grid-cols-4 gap-2">
                      {(["again", "hard", "good", "easy"] as ConfidenceLevel[]).map((level, i) => {
                        const cfg = confidenceConfig[level]
                        return (
                          <button
                            key={level}
                            onClick={() => handleRateConfidence(level)}
                            className={`flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl border-2 font-medium transition-all text-sm ${cfg.color}`}
                          >
                            {cfg.icon}
                            <span className="text-xs">{cfg.label}</span>
                            <span className="text-[10px] opacity-60">[{i + 1}]</span>
                          </button>
                        )
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Session stats footer */}
              {totalReviewed > 0 && (
                <div className="absolute bottom-5 flex items-center gap-3">
                  {(["again", "hard", "good", "easy"] as ConfidenceLevel[]).map((l) =>
                    sessionStats[l] > 0 ? (
                      <span key={l} className={`text-xs px-2 py-0.5 rounded-full border ${confidenceConfig[l].color} opacity-70`}>
                        {confidenceConfig[l].label}: {sessionStats[l]}
                      </span>
                    ) : null
                  )}
                </div>
              )}
            </motion.div>
          </AnimatePresence>,
          document.body
        )}

        {/* Move to Set */}
        <Dialog open={moveOpen} onOpenChange={(open) => {
          setMoveOpen(open)
          if (!open) {
            setSelectMode(false)
            setSelectedCards(new Set())
          }
        }}>
          <DialogTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="h-9 text-xs"
              onClick={() => {
                setSelectMode(true)
                setSelectedCards(new Set([currentCard?.id]))
              }}
            >
              <FolderInput className="h-3.5 w-3.5 mr-1.5" />
              Move
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Move Cards to Another Set</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {/* Selection controls */}
              <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <div>
                  <p className="text-sm font-medium">{selectedCards.size} card{selectedCards.size !== 1 ? "s" : ""} selected</p>
                  <p className="text-xs text-muted-foreground">Select cards to move</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={selectAllCards}
                >
                  {selectedCards.size === filteredFlashcards.length ? (
                    <>
                      <CheckSquare className="h-4 w-4 mr-1.5" />
                      Deselect All
                    </>
                  ) : (
                    <>
                      <Square className="h-4 w-4 mr-1.5" />
                      Select All
                    </>
                  )}
                </Button>
              </div>

              {/* Card list for selection */}
              <div className="max-h-40 overflow-y-auto space-y-1.5 border rounded-lg p-2">
                {filteredFlashcards.map((card) => (
                  <button
                    key={card.id}
                    onClick={() => toggleSelectCard(card.id)}
                    className={`w-full flex items-center gap-2 p-2 rounded-md text-left text-sm transition-colors ${
                      selectedCards.has(card.id)
                        ? "bg-primary/10 border border-primary/30"
                        : "hover:bg-muted"
                    }`}
                  >
                    {selectedCards.has(card.id) ? (
                      <CheckSquare className="h-4 w-4 text-primary flex-shrink-0" />
                    ) : (
                      <Square className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    )}
                    <span className="truncate">
                      {(card as any).cloze_text
                        ? (card as any).cloze_text.replace(/\{\{c\d+::([^:}]+)(?:::[^}]+)?\}\}/g, "[$1]").slice(0, 50)
                        : card.question.slice(0, 50)}
                    </span>
                  </button>
                ))}
              </div>

              {/* Target set selection */}
              <div className="space-y-2">
                <Label>Move to set:</Label>
                <div className="max-h-48 overflow-y-auto space-y-1.5">
                  {allSets
                    .filter((s) => s.id !== deck.id)
                    .map((set) => (
                      <button
                        key={set.id}
                        onClick={() => handleMoveCards(set.id)}
                        disabled={moveLoading || selectedCards.size === 0}
                        className="w-full flex items-center gap-3 p-3 rounded-lg border hover:bg-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <FolderInput className="h-4 w-4 text-muted-foreground" />
                        <div className="text-left">
                          <p className="font-medium text-sm">{set.name}</p>
                          {set.subject && (
                            <p className="text-xs text-muted-foreground">{set.subject}</p>
                          )}
                        </div>
                      </button>
                    ))}
                  {allSets.filter((s) => s.id !== deck.id).length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No other sets available. Create a new set first.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}

// Extracted add-card form to avoid duplication
function AddCardForm({
  useCloze, setUseCloze,
  newCardClozeText, setNewCardClozeText,
  newCardPriority, setNewCardPriority,
  newCardReverseEnabled, setNewCardReverseEnabled,
  loading, onSubmit, idSuffix,
}: {
  useCloze: boolean; setUseCloze: (v: boolean) => void
  newCardClozeText: string; setNewCardClozeText: (v: string) => void
  newCardPriority: string; setNewCardPriority: (v: string) => void
  newCardReverseEnabled: boolean; setNewCardReverseEnabled: (v: boolean) => void
  loading: boolean; onSubmit: (e: React.FormEvent<HTMLFormElement>) => void
  idSuffix: string
}) {
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
        <div>
          <Label htmlFor={`use-cloze${idSuffix}`}>Cloze / Fill-in-blank</Label>
          <p className="text-xs text-muted-foreground">Use {"{{c1::answer}}"} syntax</p>
        </div>
        <Switch id={`use-cloze${idSuffix}`} checked={useCloze} onCheckedChange={setUseCloze} />
      </div>

      {useCloze ? (
        <div className="space-y-2">
          <Label>Cloze Text *</Label>
          <Textarea value={newCardClozeText} onChange={(e) => setNewCardClozeText(e.target.value)} placeholder='The {{c1::mitochondria}} is the powerhouse of the cell' required rows={3} />
        </div>
      ) : (
        <>
          <div className="space-y-2">
            <Label htmlFor={`question${idSuffix}`}>Question *</Label>
            <Textarea id={`question${idSuffix}`} name="question" placeholder="Enter the question..." required rows={3} />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`answer${idSuffix}`}>Answer *</Label>
            <Textarea id={`answer${idSuffix}`} name="answer" placeholder="Enter the answer..." required rows={3} />
          </div>
        </>
      )}

      <div className="space-y-2">
        <Label htmlFor={`tags${idSuffix}`}>Tags (comma-separated)</Label>
        <Input id={`tags${idSuffix}`} name="tags" placeholder="e.g. biology, cells, mitosis" />
      </div>

      <div className="space-y-2">
        <Label>Priority</Label>
        <Select value={newCardPriority} onValueChange={setNewCardPriority}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="high"><span className="flex items-center gap-2"><Flag className="h-4 w-4 text-red-500" />High</span></SelectItem>
            <SelectItem value="medium"><span className="flex items-center gap-2"><Flag className="h-4 w-4 text-orange-500" />Medium</span></SelectItem>
            <SelectItem value="low"><span className="flex items-center gap-2"><Flag className="h-4 w-4 text-emerald-500" />Low</span></SelectItem>
          </SelectContent>
        </Select>
      </div>

      {!useCloze && (
        <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
          <div className="flex items-center gap-2">
            <ArrowLeftRight className="h-4 w-4" />
            <Label htmlFor={`reverse${idSuffix}`}>Two-Way Study</Label>
          </div>
          <Switch id={`reverse${idSuffix}`} checked={newCardReverseEnabled} onCheckedChange={setNewCardReverseEnabled} />
        </div>
      )}

      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "Adding..." : "Add Card"}
      </Button>
    </form>
  )
}

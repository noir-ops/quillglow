"use client"

import { useEffect, useState, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Button } from "@/components/ui/button"
import { ChatMarkdown } from "@/components/chat/chat-markdown"
import {
  Brain,
  TrendingDown,
  AlertTriangle,
  Info,
  Zap,
  ChevronRight,
  RotateCcw,
  Loader2,
  CheckCircle2,
  SkipForward,
  BookOpen,
  FlaskConical,
  Wind,
  Layers,
} from "lucide-react"

interface MemoryItem {
  id: string
  topic: string
  subject: string | null
  source_type: string
  memory_strength_score: number
  predicted_forget_date: string | null
  urgency: "critical" | "high" | "medium" | "low"
  daysUntilForgot: number
}

const urgencyConfig = {
  critical: { label: "Forget soon", color: "text-red-500", bg: "bg-red-500/8 border-red-500/20", dot: "bg-red-500", barColor: "bg-red-500", icon: AlertTriangle },
  high:     { label: "Review today", color: "text-orange-500", bg: "bg-orange-500/8 border-orange-500/20", dot: "bg-orange-500", barColor: "bg-orange-500", icon: TrendingDown },
  medium:   { label: "Review soon", color: "text-amber-500", bg: "bg-amber-500/8 border-amber-500/20", dot: "bg-amber-500", barColor: "bg-amber-400", icon: Info },
  low:      { label: "Strong", color: "text-emerald-500", bg: "bg-emerald-500/8 border-emerald-500/20", dot: "bg-emerald-500", barColor: "bg-emerald-500", icon: Zap },
}

const sourceLabel: Record<string, string> = {
  tutor_memory: "AI Tutor",
  flashcard: "Flashcards",
  mock_exam: "Mock Exam",
  echomind: "EchoMind",
}

type ReviewType = "quick" | "quiz" | "recap" | "blended"

const reviewTypes: { id: ReviewType; label: string; icon: React.ElementType; description: string }[] = [
  { id: "quick", label: "Quick Explain", icon: Zap, description: "Short, focused recap" },
  { id: "quiz", label: "Mini Quiz", icon: FlaskConical, description: "Test your understanding" },
  { id: "recap", label: "Full Recap", icon: BookOpen, description: "Key points refresher" },
  { id: "blended", label: "Time-Travel", icon: Wind, description: "Past confusion + now" },
]

interface MemoryPanelProps {
  onStartSession?: (topic: string) => void
}

export function MemoryPanel({ onStartSession }: MemoryPanelProps) {
  const [feed, setFeed] = useState<MemoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [reviewed, setReviewed] = useState<Set<string>>(new Set())
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [reviewContent, setReviewContent] = useState<Record<string, string>>({})
  const [reviewLoading, setReviewLoading] = useState<string | null>(null)
  const [selectedReviewType, setSelectedReviewType] = useState<ReviewType>("quick")

  const fetchFeed = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/memory/feed")
      const data = await res.json()
      if (data.feed) setFeed(data.feed)
    } catch {}
    setLoading(false)
  }, [])

  useEffect(() => { fetchFeed() }, [fetchFeed])

  const handleReview = async (item: MemoryItem, reviewType: ReviewType = selectedReviewType) => {
    const key = `${item.id}-${reviewType}`
    if (reviewContent[key]) {
      setExpandedId(item.id)
      return
    }
    setReviewLoading(item.id)
    try {
      const res = await fetch("/api/memory/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memoryId: item.id, reviewType }),
      })
      const data = await res.json()
      if (data.review) {
        setReviewContent((prev) => ({ ...prev, [key]: data.review }))
        setExpandedId(item.id)
      }
    } catch {}
    setReviewLoading(null)
  }

  const handleMarkReviewed = async (id: string, skipped = false) => {
    setReviewed((prev) => new Set([...prev, id]))
    setExpandedId(null)
    await fetch("/api/memory/feed", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, skipped }),
    }).catch(() => {})
  }

  const visibleFeed = feed.filter((item) => !reviewed.has(item.id))

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-8 justify-center">
        <Loader2 className="h-4 w-4 animate-spin" />
        Calculating memory scores...
      </div>
    )
  }

  if (feed.length === 0) {
    return (
      <div className="text-center py-10">
        <Brain className="h-10 w-10 mx-auto text-muted-foreground/30 mb-3" />
        <p className="text-sm font-medium text-muted-foreground">No memory tracking data yet</p>
        <p className="text-xs text-muted-foreground/60 mt-1">Start studying and QuillGlow will track what you need to review</p>
      </div>
    )
  }

  if (visibleFeed.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex flex-col items-center gap-2 py-10 text-center"
      >
        <CheckCircle2 className="h-10 w-10 text-emerald-500" />
        <p className="text-sm font-semibold">All reviews done</p>
        <p className="text-xs text-muted-foreground">Memory scores updated. Check back tomorrow.</p>
        <Button variant="outline" size="sm" onClick={fetchFeed} className="mt-2 gap-1.5">
          <RotateCcw className="h-3.5 w-3.5" /> Refresh
        </Button>
      </motion.div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Review type selector */}
      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
        {reviewTypes.map((rt) => (
          <button
            key={rt.id}
            onClick={() => setSelectedReviewType(rt.id)}
            className={`flex items-center gap-1.5 px-2.5 py-2 rounded-lg border text-xs font-medium transition-all ${
              selectedReviewType === rt.id
                ? "bg-primary/10 border-primary/40 text-primary"
                : "border-border text-muted-foreground hover:border-border/80 hover:text-foreground"
            }`}
          >
            <rt.icon className="h-3.5 w-3.5 flex-shrink-0" />
            {rt.label}
          </button>
        ))}
      </div>

      <AnimatePresence mode="popLayout">
        {visibleFeed.map((item) => {
          const cfg = urgencyConfig[item.urgency]
          const UrgencyIcon = cfg.icon
          const isExpanded = expandedId === item.id
          const content = reviewContent[`${item.id}-${selectedReviewType}`]

          return (
            <motion.div
              key={item.id}
              layout
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: -24, height: 0, marginBottom: 0 }}
              transition={{ duration: 0.2 }}
              className={`rounded-xl border p-4 ${cfg.bg}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0 flex-1">
                  <div className={`mt-1.5 h-2 w-2 rounded-full flex-shrink-0 ${cfg.dot}`} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold leading-tight">{item.topic}</p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <span className={`text-xs font-medium ${cfg.color} flex items-center gap-1`}>
                        <UrgencyIcon className="h-3 w-3" />
                        {cfg.label}
                      </span>
                      {item.source_type && (
                        <>
                          <span className="text-muted-foreground/30 text-xs">·</span>
                          <span className="text-xs text-muted-foreground">{sourceLabel[item.source_type] ?? item.source_type}</span>
                        </>
                      )}
                      {item.daysUntilForgot <= 7 && item.urgency !== "low" && (
                        <>
                          <span className="text-muted-foreground/30 text-xs">·</span>
                          <span className={`text-xs ${cfg.color}`}>
                            {item.daysUntilForgot <= 0 ? "forgetting now" : `~${item.daysUntilForgot}d left`}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex-shrink-0 text-right">
                  <p className="text-sm font-bold">{item.memory_strength_score}%</p>
                  <p className="text-[10px] text-muted-foreground">memory</p>
                </div>
              </div>

              {/* Strength bar */}
              <div className="mt-2.5 h-1.5 w-full bg-muted/60 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${item.memory_strength_score}%` }}
                  transition={{ duration: 0.6, ease: "easeOut" }}
                  className={`h-full rounded-full ${cfg.barColor}`}
                />
              </div>

              {/* Expanded review content */}
              <AnimatePresence>
                {isExpanded && content && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                    className="mt-3 p-3 bg-background/70 rounded-lg border border-border/60"
                  >
                    <ChatMarkdown content={content} />
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="flex items-center gap-2 mt-3 flex-wrap">
                {!isExpanded ? (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs px-3 gap-1.5 bg-background/60"
                    onClick={() => handleReview(item)}
                    disabled={reviewLoading === item.id}
                  >
                    {reviewLoading === item.id
                      ? <Loader2 className="h-3 w-3 animate-spin" />
                      : <Brain className="h-3 w-3" />}
                    Review
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    className="h-7 text-xs px-3 gap-1.5"
                    onClick={() => handleMarkReviewed(item.id, false)}
                  >
                    <CheckCircle2 className="h-3 w-3" />
                    Got it
                  </Button>
                )}

                {onStartSession && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs px-2 gap-1 text-muted-foreground"
                    onClick={() => onStartSession(item.topic)}
                  >
                    Deep dive <ChevronRight className="h-3 w-3" />
                  </Button>
                )}

                <button
                  className="ml-auto text-muted-foreground/40 hover:text-muted-foreground transition-colors"
                  onClick={() => handleMarkReviewed(item.id, true)}
                  title="Skip"
                >
                  <SkipForward className="h-3.5 w-3.5" />
                </button>
              </div>
            </motion.div>
          )
        })}
      </AnimatePresence>
    </div>
  )
}

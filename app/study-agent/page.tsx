"use client"

import { useState, useEffect, useRef } from "react"
import { ChatMarkdown } from "@/components/chat/chat-markdown"
import { motion, AnimatePresence } from "framer-motion"
import Link from "next/link"
import {
  Zap, Sparkles, FileText, Brain, ClipboardList, Youtube, RotateCcw, Trash2, Loader2,
  AlertTriangle, CheckCircle2, ArrowLeft, History, ChevronRight,
  BookOpen, Target, Calendar, Play, ExternalLink, Copy, Lock,
  Layers, ListChecks, Map, GraduationCap, Video, RefreshCw,
  Clock, Star, TrendingUp, ChevronDown, ChevronUp, Search,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { StudyAgentExport } from "@/components/study-agent/study-agent-export"

// ─── Types ───────────────────────────────────────────────────────────────────
interface AgentResult {
  sessionId?: string
  analysis: any
  studyPlan: any
  revisionNotes: any
  flashcardData: any
  flashcardDeckId?: string | null
  practiceExam: any
  youtubeLinks: any[]
  youtubeApiUsed: boolean
  reviewPlan: any
  weaknessInsights: any
  personalDataUsed: any | null
  isGenius: boolean
}

interface UsageInfo {
  isGenius: boolean
  unlimited: boolean
  used: number
  remaining: number | null
  limit: number | null
}

interface HistorySession {
  id: string
  input_text: string
  input_type: string
  subject: string | null
  status: string
  steps_completed: number
  created_at: string
}

// ─── Steps config ─────────────────────────────────────────────────────────────
const STEPS = [
  { id: 1, label: "Analysing input", icon: Search },
  { id: 2, label: "Building study plan", icon: Calendar },
  { id: 3, label: "Writing revision notes", icon: FileText },
  { id: 4, label: "Mapping concepts", icon: Map },
  { id: 5, label: "Generating exam questions", icon: GraduationCap },
  { id: 6, label: "Finding video resources", icon: Video },
  { id: 7, label: "Planning smart review", icon: RotateCcw },
  { id: 8, label: "Integrating your data", icon: TrendingUp },
]

const TABS = [
  { id: "plan", label: "Study Planner", icon: Calendar },
  { id: "notes", label: "Notes", icon: FileText },
  { id: "flashcards", label: "Flashcards", icon: Brain },
  { id: "exam", label: "Practice Exam", icon: GraduationCap },
  { id: "videos", label: "Videos", icon: Youtube },
  { id: "review", label: "Review Plan", icon: RotateCcw },
]

// ─── Component ────────────────────────────────────────────────────────────────
export default function StudyAgentPage() {
  const [view, setView] = useState<"input" | "loading" | "result" | "history">("input")
  const [inputText, setInputText] = useState("")
  const [inputType, setInputType] = useState<"topic" | "syllabus" | "question">("topic")
  const [subject, setSubject] = useState("")
  const [mySubjects, setMySubjects] = useState<{ syllabus: string; subject: string }[]>([])
  // "syllabus": generate straight from the selected subject's indexed
  // curriculum — no paste required. "manual": the original topic/paste/
  // question flow, for a custom topic or when no subject is selected.
  const [source, setSource] = useState<"syllabus" | "manual">("manual")
  const [topicFocus, setTopicFocus] = useState("")
  // Explicit, so output depth is consistent run to run instead of being
  // inferred differently by the model each time.
  const [level, setLevel] = useState("intermediate")
  const [scope, setScope] = useState("broad")
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [usePersonalData, setUsePersonalData] = useState(false)
  const [currentStep, setCurrentStep] = useState(0)
  const [result, setResult] = useState<AgentResult | null>(null)
  const [activeTab, setActiveTab] = useState("plan")
  const [error, setError] = useState<string | null>(null)
  const [usage, setUsage] = useState<UsageInfo | null>(null)
  const [history, setHistory] = useState<HistorySession[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [expandedSection, setExpandedSection] = useState<string | null>(null)
  const [examAnswer, setExamAnswer] = useState<Record<number, number>>({})
  const [examChecked, setExamChecked] = useState(false)
  const stepIntervalRef = useRef<NodeJS.Timeout | null>(null)

  // Fetch usage on mount
  useEffect(() => {
    fetch("/api/study-agent/usage")
      .then((r) => r.json())
      .then((d) => { if (!d.error) setUsage(d) })
      .catch(() => {})
  }, [])

  // The learner's subjects, from their selected syllabi. Only the ones they
  // actually chose — a syllabus can carry many more than they study.
  useEffect(() => {
    fetch("/api/syllabus/subjects")
      .then((r) => r.json())
      .then((d) => {
        const chosen = (d.subjects ?? []).filter((s: any) => s.selected)
        const list = chosen.map((s: any) => ({ syllabus: s.syllabus, subject: s.subject }))
        setMySubjects(list)
        if (list.length > 0) {
          setSource("syllabus")
          setSubject((prev) => prev || list[0].subject)
        }
      })
      .catch(() => {})
  }, [])

  // Animate steps during loading
  useEffect(() => {
    if (view === "loading") {
      setCurrentStep(0)
      let step = 0
      stepIntervalRef.current = setInterval(() => {
        step++
        if (step <= STEPS.length) setCurrentStep(step)
      }, 900)
    } else {
      if (stepIntervalRef.current) clearInterval(stepIntervalRef.current)
    }
    return () => { if (stepIntervalRef.current) clearInterval(stepIntervalRef.current) }
  }, [view])

  const generate = async () => {
    const readyViaSyllabus = source === "syllabus" && !!subject
    if (!inputText.trim() && !readyViaSyllabus) return
    setError(null)
    setView("loading")
    setCurrentStep(0)
    setExamAnswer({})
    setExamChecked(false)

    try {
      const owningSyllabus = mySubjects.find((s) => s.subject === subject)?.syllabus
      const res = await fetch("/api/study-agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          // In syllabus mode there's nothing pasted — the route builds the
          // content from the subject's indexed curriculum instead.
          inputText: source === "syllabus" ? "" : inputText,
          inputType: source === "syllabus" ? "syllabus" : inputType,
          subject: subject.trim() || undefined,
          syllabus: source === "syllabus" ? owningSyllabus : undefined,
          topicFocus: source === "syllabus" ? topicFocus.trim() || undefined : undefined,
          level,
          scope,
          usePersonalData,
        }),
      })
      const data = await res.json()

      if (res.status === 429 || data.error === "monthly_limit_reached") {
        setError("monthly_limit_reached")
        setView("input")
        fetch("/api/study-agent/usage").then((r) => r.json()).then((d) => { if (!d.error) setUsage(d) }).catch(() => {})
        return
      }
      if (!res.ok || data.error) {
        setError(data.error || "Something went wrong. Please try again.")
        setView("input")
        return
      }

      setResult(data)
      setActiveTab("plan")
      setView("result")
      fetch("/api/study-agent/usage").then((r) => r.json()).then((d) => { if (!d.error) setUsage(d) }).catch(() => {})
    } catch {
      setError("Connection error. Please try again.")
      setView("input")
    }
  }

  const openHistory = async () => {
    setHistoryLoading(true)
    setView("history")
    try {
      const res = await fetch("/api/study-agent/history")
      const data = await res.json()
      setHistory(data.sessions || [])
    } catch {
      setHistory([])
    } finally {
      setHistoryLoading(false)
    }
  }

  const deleteSession = async (id: string) => {
    if (!confirm("Delete this study system? This can't be undone.")) return
    setDeletingId(id)
    try {
      const res = await fetch(`/api/study-agent/session?id=${id}`, { method: "DELETE" })
      if (!res.ok) throw new Error()
      // Drop it locally rather than refetching the whole list.
      setHistory((h) => h.filter((s: any) => s.id !== id))
      // If the deleted session is the one on screen, go back to the input view.
      setResult((r) => (r?.sessionId === id ? null : r))
      setView((v) => (v === "result" && result?.sessionId === id ? "input" : v))
    } catch {
      setError("Could not delete that study system.")
    } finally {
      setDeletingId(null)
    }
  }

  const loadSession = async (id: string) => {
    setView("loading")
    setCurrentStep(8)
    try {
      const res = await fetch(`/api/study-agent/session?id=${id}`)
      const data = await res.json()
      if (data.session) {
        setResult({
          sessionId: data.session.id,
          analysis: data.session.analysis,
          studyPlan: data.session.study_plan,
          revisionNotes: data.session.generated_notes,
          flashcardData: data.session.mind_map_data,
          practiceExam: data.session.generated_exam,
          youtubeLinks: data.session.youtube_links || [],
          youtubeApiUsed: false,
          reviewPlan: data.session.review_plan,
          weaknessInsights: data.session.weakness_insights,
          isGenius: false,
        })
        setActiveTab("plan")
        setView("result")
      }
    } catch {
      setView("history")
    }
  }

  const copyToClipboard = (text: string) => navigator.clipboard.writeText(text).catch(() => {})

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 py-6 sm:py-10">

        {/* Top nav */}
        <div className="flex items-center justify-between mb-8">
          {view !== "input" ? (
            <button
              onClick={() => setView("input")}
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />Back
            </button>
          ) : (
            <Link href="/dashboard" className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="h-4 w-4" />Dashboard
            </Link>
          )}
          <div className="flex items-center gap-1.5">
            <div className="h-7 w-7 rounded-lg bg-primary flex items-center justify-center">
              <Zap className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="font-bold text-sm">StudyPilot</span>
          </div>
        </div>

        {/* ─── INPUT VIEW ─────────────────────────────────────────────────── */}
        <AnimatePresence mode="wait">
          {view === "input" && (
            <motion.div key="input" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="max-w-2xl mx-auto w-full space-y-6">

              {/* Genius-only gate — show FIRST before hero */}
              {usage && !usage.unlimited && (
                <>
                  <div className="rounded-2xl border-2 border-primary/30 bg-gradient-to-br from-primary/8 to-primary/3 p-8 text-center space-y-5">
                    <div className="space-y-2">
                      <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-primary/15 border border-primary/20 mx-auto mb-3">
                        <Lock className="h-8 w-8 text-primary" />
                      </div>
                      <h2 className="text-2xl font-bold">StudyPilot is Genius Exclusive</h2>
                      <p className="text-muted-foreground max-w-sm mx-auto">
                        StudyPilot builds your complete study system in one run. This premium feature is available only on the Genius plan.
                      </p>
                    </div>
                    <div className="flex items-center justify-center gap-3">
                      <Button asChild size="lg" className="gap-2">
                        <Link href="/upgrade">
                          <Sparkles className="h-4 w-4" />
                          Upgrade to Genius
                        </Link>
                      </Button>
                      <Button asChild variant="outline" size="lg">
                        <Link href="/dashboard">
                          Back to Dashboard
                        </Link>
                      </Button>
                    </div>
                  </div>
                </>
              )}

              {/* Hero — only show for Genius */}
              {usage?.unlimited && (
              <>

              {/* Hero */}
              <div className="text-center space-y-3 pb-2">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-semibold uppercase tracking-wider">
                  <Zap className="h-3.5 w-3.5" />
                  StudyPilot
                </div>
                <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
                  Your complete study system,{" "}
                  <span className="text-primary">generated instantly.</span>
                </h1>
                <p className="text-muted-foreground text-base max-w-lg mx-auto">
                  Enter a topic, paste a syllabus, or drop a question. The agent builds your entire study system in one run.
                </p>
              </div>

              {/* Genius plan status badge */}
              {usage?.unlimited && (
                <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-2.5 flex items-center gap-2.5">
                  <Zap className="h-4 w-4 text-primary shrink-0" />
                  <p className="text-sm font-medium text-primary">Genius plan — unlimited StudyPilot runs</p>
                </div>
              )}

              {/* Other errors */}
              {error && error !== "monthly_limit_reached" && (
                <div className="rounded-xl border border-destructive/30 bg-destructive/8 px-4 py-3 flex items-center gap-2.5">
                  <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
                  <p className="text-sm text-destructive">{error}</p>
                </div>
              )}

              {/* Input card */}
              <Card className="p-5 space-y-4 border-border/60">
                {/* Source toggle — only shown when the learner has subjects
                    selected. Syllabus mode needs nothing pasted: the topic
                    list comes from indexed curriculum. Manual mode is the
                    original flow, for a custom topic/question or no subject. */}
                {mySubjects.length > 0 && (
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setSource("syllabus")}
                      className={cn(
                        "px-3 py-2 rounded-lg text-sm font-semibold transition-all border",
                        source === "syllabus"
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-muted/40 border-transparent text-muted-foreground hover:border-border"
                      )}
                    >
                      From my syllabus
                    </button>
                    <button
                      onClick={() => setSource("manual")}
                      className={cn(
                        "px-3 py-2 rounded-lg text-sm font-semibold transition-all border",
                        source === "manual"
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-muted/40 border-transparent text-muted-foreground hover:border-border"
                      )}
                    >
                      Custom topic / question
                    </button>
                  </div>
                )}

                {source === "syllabus" && mySubjects.length > 0 ? (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-muted-foreground">Subject</label>
                      <select
                        value={subject}
                        onChange={(e) => setSubject(e.target.value)}
                        className="w-full h-9 px-3 rounded-lg border border-border/60 bg-muted/30 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-colors"
                      >
                        {mySubjects.map((s) => (
                          <option key={`${s.syllabus}::${s.subject}`} value={s.subject}>
                            {s.subject} ({s.syllabus})
                          </option>
                        ))}
                      </select>
                      <p className="text-xs text-muted-foreground">
                        Built from your {mySubjects.find((s) => s.subject === subject)?.syllabus ?? "syllabus"}{" "}
                        curriculum — nothing to paste.
                      </p>
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-muted-foreground">
                        Topic focus <span className="font-normal">(optional)</span>
                      </label>
                      <input
                        value={topicFocus}
                        onChange={(e) => setTopicFocus(e.target.value)}
                        placeholder="e.g. Photosynthesis — leave blank to cover the whole subject"
                        className="w-full h-9 px-3 rounded-lg border border-border/60 bg-muted/30 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-colors"
                      />
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Input type selector */}
                    <div className="flex gap-2">
                      {(["topic", "syllabus", "question"] as const).map((type) => (
                        <button
                          key={type}
                          onClick={() => setInputType(type)}
                          className={cn(
                            "px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all border",
                            inputType === type
                              ? "bg-primary/10 border-primary/40 text-primary"
                              : "bg-muted/40 border-transparent text-muted-foreground hover:border-border"
                          )}
                        >{type}</button>
                      ))}
                    </div>

                    {/* Text input — NOT a nested component, so typing won't remount */}
                    <div className="space-y-2">
                      <Textarea
                        value={inputText}
                        onChange={(e) => setInputText(e.target.value)}
                        placeholder={
                          inputType === "topic" ? "e.g. Quantum entanglement, photosynthesis, the Cold War..."
                          : inputType === "syllabus" ? "Paste your syllabus, course outline, or module list..."
                          : "e.g. Explain the causes and consequences of World War I..."
                        }
                        className="min-h-[130px] resize-none border-border/60 bg-muted/30 focus:bg-background transition-colors text-sm"
                      />
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">{inputText.length} / 3000 characters</span>
                        {inputText.length > 2800 && <span className="text-xs text-primary">Approaching limit</span>}
                      </div>
                    </div>

                    {/* Subject (manual entry — no curriculum selected) */}
                    {mySubjects.length === 0 && (
                      <input
                        value={subject}
                        onChange={(e) => setSubject(e.target.value)}
                        placeholder="Subject (optional, e.g. Biology)"
                        className="w-full h-9 px-3 rounded-lg border border-border/60 bg-muted/30 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-colors"
                      />
                    )}
                  </>
                )}

                {/* Level + scope — explicit rather than inferred, so the
                    same topic doesn't come back "intermediate" one run and
                    "advanced" the next. */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground">Study level</label>
                    <select
                      value={level}
                      onChange={(e) => setLevel(e.target.value)}
                      className="w-full h-9 px-3 rounded-lg border border-border/60 bg-muted/30 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-colors"
                    >
                      <option value="basic">Basic</option>
                      <option value="intermediate">Intermediate</option>
                      <option value="advanced">Advanced</option>
                      <option value="expert">Expert</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground">Scope</label>
                    <select
                      value={scope}
                      onChange={(e) => setScope(e.target.value)}
                      className="w-full h-9 px-3 rounded-lg border border-border/60 bg-muted/30 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-colors"
                    >
                      <option value="narrow">Narrow — core topic only</option>
                      <option value="broad">Broad — topic + subtopics</option>
                      <option value="wide">Wide — plus adjacent areas</option>
                    </select>
                  </div>
                </div>

                {/* Personal data toggle */}
                <button
                  onClick={() => setUsePersonalData((v) => !v)}
                  className={cn(
                    "flex items-center gap-2 px-3 h-9 rounded-lg border text-xs font-semibold transition-all",
                    usePersonalData
                      ? "bg-primary/10 border-primary/40 text-primary"
                      : "bg-muted/40 border-transparent text-muted-foreground hover:border-border"
                  )}
                >
                  <TrendingUp className="h-3.5 w-3.5" />
                  {usePersonalData ? "Using your data" : "Use my past data"}
                </button>

                {/* Generate button */}
                <Button
                  onClick={generate}
                  disabled={
                    (source === "syllabus" && mySubjects.length > 0 ? !subject : !inputText.trim()) ||
                    (usage?.remaining === 0 && !usage?.unlimited)
                  }
                  className="w-full h-12 text-base font-bold gap-2"
                >
                  {usage?.remaining === 0 && !usage?.unlimited ? (
                    <><Lock className="h-4 w-4" />Upgrade to Generate</>
                  ) : (
                    <><Zap className="h-4 w-4" />Generate My Study System</>
                  )}
                </Button>

                <p className="text-center text-xs text-muted-foreground">
                  Your StudyPilot builds your system — you just follow it.
                </p>
              </Card>

              {/* History link */}
              <button
                onClick={openHistory}
                className="w-full flex items-center justify-center gap-2 py-2.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <History className="h-4 w-4" />
                View previous study systems
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
              </>
              )}
            </motion.div>
          )}

          {/* ─── LOADING VIEW ─────────────────────────────────────────────── */}
          {view === "loading" && (
            <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="max-w-md mx-auto w-full space-y-8 py-8">
              <div className="text-center space-y-2">
                <div className="inline-flex items-center justify-center h-14 w-14 rounded-2xl bg-primary/10 border border-primary/20 mx-auto mb-4">
                  <Zap className="h-7 w-7 text-primary animate-pulse" />
                </div>
                <h2 className="text-xl font-bold">Building your study system</h2>
                <p className="text-sm text-muted-foreground">The agent is working through {STEPS.length} steps — this takes about 30 seconds.</p>
              </div>

              <div className="space-y-2">
                {STEPS.map((step, i) => {
                  const done = currentStep > step.id
                  const active = currentStep === step.id
                  return (
                    <motion.div
                      key={step.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className={cn(
                        "flex items-center gap-3 px-4 py-3 rounded-xl border transition-all duration-300",
                        done ? "bg-green-500/8 border-green-500/20" :
                        active ? "bg-primary/8 border-primary/30 shadow-sm" :
                        "bg-muted/30 border-transparent opacity-40"
                      )}
                    >
                      <div className={cn(
                        "h-7 w-7 rounded-full flex items-center justify-center shrink-0 transition-all",
                        done ? "bg-green-500/20" : active ? "bg-primary/20" : "bg-muted"
                      )}>
                        {done
                          ? <CheckCircle2 className="h-4 w-4 text-green-500" />
                          : active
                          ? <step.icon className="h-4 w-4 text-primary animate-pulse" />
                          : <step.icon className="h-4 w-4 text-muted-foreground" />
                        }
                      </div>
                      <span className={cn(
                        "text-sm font-medium",
                        done ? "text-green-600 dark:text-green-400" :
                        active ? "text-foreground" : "text-muted-foreground"
                      )}>
                        Step {step.id}: {step.label}
                        {active && <span className="ml-1.5 text-primary animate-pulse">...</span>}
                      </span>
                    </motion.div>
                  )
                })}
              </div>
            </motion.div>
          )}

          {/* ─── RESULT VIEW ──────────────────────────────────────────────── */}
          {view === "result" && result && (
            <motion.div key="result" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="w-full space-y-5">
              {/* Result header */}
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                    <h2 className="font-bold text-lg">Study system ready</h2>
                  </div>
                  {result.analysis?.subject && <p className="text-sm text-muted-foreground">{result.analysis.subject}</p>}
                </div>
                <Button variant="outline" size="sm" onClick={() => { setView("input"); setResult(null) }} className="gap-1.5 shrink-0">
                  <RefreshCw className="h-3.5 w-3.5" />New session
                </Button>
              </div>

              {/* Export — placed directly under the header so it's the first
                  thing seen after "Study system ready", not buried below the
                  generated content. */}
              <StudyAgentExport
                sessionId={result.sessionId}
                hasPlan={Array.isArray(result.studyPlan?.schedule) && result.studyPlan.schedule.length > 0}
                hasNotes={Array.isArray(result.revisionNotes?.sections) && result.revisionNotes.sections.length > 0}
                hasExam={Array.isArray(result.practiceExam?.mcqs) && result.practiceExam.mcqs.length > 0}
                hasFlashcards={Array.isArray(result.flashcardData?.cards) && result.flashcardData.cards.length > 0}
              />

              {/* Personal data used banner */}
              {result.personalDataUsed?.hasData && (
                <Card className="p-4 border-primary/20 bg-primary/5">
                  <div className="flex items-start gap-3">
                    <div className="h-8 w-8 rounded-lg bg-primary/15 flex items-center justify-center shrink-0">
                      <TrendingUp className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-primary mb-1.5">Personalised using your study data</p>
                      <div className="flex flex-wrap gap-2">
                        {result.personalDataUsed.weakTopics?.length > 0 && (
                          <div className="space-y-1 w-full">
                            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Weak areas prioritised</p>
                            <div className="flex flex-wrap gap-1.5">
                              {result.personalDataUsed.weakTopics.map((t: any, i: number) => (
                                <span key={i} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs font-medium">
                                  <span className="h-1.5 w-1.5 rounded-full bg-red-500 shrink-0" />
                                  {t.topic}
                                  {t.timesAsked > 1 && <span className="opacity-60">×{t.timesAsked}</span>}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                        {result.personalDataUsed.mockExams?.count > 0 && (
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <GraduationCap className="h-3.5 w-3.5 text-primary shrink-0" />
                            <span>{result.personalDataUsed.mockExams.count} past mock exam{result.personalDataUsed.mockExams.count !== 1 ? "s" : ""} reviewed</span>
                            {result.personalDataUsed.mockExams.avgScore != null && (
                              <span className={cn("font-semibold", result.personalDataUsed.mockExams.avgScore >= 70 ? "text-green-600 dark:text-green-400" : result.personalDataUsed.mockExams.avgScore >= 50 ? "text-primary" : "text-red-500")}>
                                · avg {result.personalDataUsed.mockExams.avgScore}%
                              </span>
                            )}
                          </div>
                        )}
                        {result.personalDataUsed.flashcardDecks?.length > 0 && (
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Layers className="h-3.5 w-3.5 text-primary shrink-0" />
                            <span>Flashcard decks: {result.personalDataUsed.flashcardDecks.map((d: any) => d.name).join(", ")}</span>
                          </div>
                        )}
                        {result.personalDataUsed.echomindSessions?.length > 0 && (
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Sparkles className="h-3.5 w-3.5 text-primary shrink-0" />
                            <span>Recent EchoMind topics: {result.personalDataUsed.echomindSessions.slice(0, 3).map((s: any) => s.query).join(", ")}</span>
                          </div>
                        )}
                        {result.personalDataUsed.recentNotes?.length > 0 && (
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <FileText className="h-3.5 w-3.5 text-primary shrink-0" />
                            <span>Notes cross-referenced: {result.personalDataUsed.recentNotes.map((n: any) => n.title).join(", ")}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </Card>
              )}

              {/* Tabs */}
              <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
                {TABS.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={cn(
                      "flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all border shrink-0",
                      activeTab === tab.id
                        ? "bg-primary/10 border-primary/40 text-primary"
                        : "bg-muted/40 border-transparent text-muted-foreground hover:border-border hover:text-foreground"
                    )}
                  >
                    <tab.icon className="h-3.5 w-3.5" />
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Tab content */}
              <AnimatePresence mode="wait">
                <motion.div key={activeTab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>

                  {/* PLAN TAB */}
                  {activeTab === "plan" && (
                    <div className="space-y-4">
                      {result.analysis && (
                        <Card className="p-4 bg-primary/5 border-primary/20">
                          <div className="flex flex-wrap gap-2 mb-3">
                            {result.analysis.difficultyLevel && <Badge variant="outline" className="capitalize border-primary/30 text-primary">{result.analysis.difficultyLevel}</Badge>}
                            {result.analysis.studyScope && <Badge variant="outline" className="capitalize">{result.analysis.studyScope} scope</Badge>}
                            {result.analysis.estimatedHours && <Badge variant="outline" className="gap-1"><Clock className="h-3 w-3" />{result.analysis.estimatedHours}h estimated</Badge>}
                          </div>
                          {result.analysis.mainTopics?.length > 0 && (
                            <div className="flex flex-wrap gap-1.5">
                              {result.analysis.mainTopics.map((t: string, i: number) => (
                                <span key={i} className="px-2.5 py-1 rounded-lg bg-primary/10 text-primary text-xs font-medium">{t}</span>
                              ))}
                            </div>
                          )}
                        </Card>
                      )}
                      {result.studyPlan?.schedule?.length > 0 && (
                        <div className="space-y-2">
                          <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Daily Schedule</h3>
                          {result.studyPlan.schedule.map((day: any, i: number) => (
                            <Card key={i} className="p-3.5 flex items-start gap-3">
                              <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                                <span className="text-xs font-bold text-primary">D{day.day || i + 1}</span>
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="font-semibold text-sm">{day.topic}</p>
                                {day.subtopics?.length > 0 && <p className="text-xs text-muted-foreground mt-0.5">{day.subtopics.join(" · ")}</p>}
                                <div className="flex items-center gap-2 mt-1.5">
                                  {day.timeMinutes && <span className="text-xs bg-muted px-2 py-0.5 rounded-full">{day.timeMinutes} min</span>}
                                  {day.priority && <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", day.priority === "high" ? "bg-red-500/10 text-red-500" : day.priority === "medium" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground")}>{day.priority}</span>}
                                </div>
                              </div>
                            </Card>
                          ))}
                        </div>
                      )}
                      {result.studyPlan?.keyMilestones?.length > 0 && (
                        <Card className="p-4">
                          <h3 className="font-semibold text-sm mb-3 flex items-center gap-1.5"><Star className="h-4 w-4 text-primary" />Key Milestones</h3>
                          <ul className="space-y-2">
                            {result.studyPlan.keyMilestones.map((m: string, i: number) => (
                              <li key={i} className="flex items-start gap-2 text-sm"><CheckCircle2 className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />{m}</li>
                            ))}
                          </ul>
                        </Card>
                      )}
                    </div>
                  )}

                  {/* NOTES TAB */}
                  {activeTab === "notes" && (
                    <div className="space-y-3">
                      {result.revisionNotes?.sections?.length > 0 ? result.revisionNotes.sections.map((sec: any, i: number) => (
                        <Card key={i} className="overflow-hidden">
                          <button
                            onClick={() => setExpandedSection(expandedSection === `notes-${i}` ? null : `notes-${i}`)}
                            className="w-full flex items-center justify-between p-4 text-left hover:bg-muted/30 transition-colors"
                          >
                            <span className="font-semibold">{sec.title}</span>
                            {expandedSection === `notes-${i}` ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                          </button>
                          <AnimatePresence>
                            {expandedSection === `notes-${i}` && (
                              <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }} className="overflow-hidden">
                                <div className="px-4 pb-4 space-y-4 border-t border-border/50">
                                  {sec.keyPoints?.length > 0 && (
                                    <div className="pt-3">
                                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Key Points</p>
                                      <ul className="space-y-1.5">{sec.keyPoints.map((p: string, j: number) => <li key={j} className="flex items-start gap-2 text-sm"><span className="h-1.5 w-1.5 rounded-full bg-primary shrink-0 mt-2" />{p}</li>)}</ul>
                                    </div>
                                  )}
                                  {sec.definitions?.length > 0 && (
                                    <div>
                                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Definitions</p>
                                      <div className="space-y-2">{sec.definitions.map((d: any, j: number) => <div key={j} className="text-sm"><span className="font-semibold text-primary">{d.term}: </span><span className="text-muted-foreground">{d.definition}</span></div>)}</div>
                                    </div>
                                  )}
                                  {sec.examTips?.length > 0 && (
                                    <div>
                                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Exam Tips</p>
                                      <ul className="space-y-1.5">{sec.examTips.map((t: string, j: number) => <li key={j} className="flex items-start gap-2 text-sm text-primary"><Star className="h-3.5 w-3.5 shrink-0 mt-0.5 text-primary" />{t}</li>)}</ul>
                                    </div>
                                  )}
                                  {sec.mnemonics?.length > 0 && (
                                    <div>
                                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Mnemonics</p>
                                      <ul className="space-y-1.5">{sec.mnemonics.map((m: string, j: number) => <li key={j} className="text-sm font-mono bg-muted px-3 py-2 rounded-lg">{m}</li>)}</ul>
                                    </div>
                                  )}
                                  <button onClick={() => copyToClipboard(JSON.stringify(sec, null, 2))} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
                                    <Copy className="h-3.5 w-3.5" />Copy section
                                  </button>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </Card>
                      )) : <p className="text-sm text-muted-foreground text-center py-8">No notes generated.</p>}
                    </div>
                  )}

                  {/* FLASHCARDS TAB */}
                  {activeTab === "flashcards" && (
                    <div className="space-y-4">
                      {result.flashcardData?.cards?.length > 0 ? (
                        <>
                          <p className="text-sm text-muted-foreground">
                            {result.flashcardData.cards.length} cards — already saved to your Flashcards.
                          </p>

                          <div className="space-y-2">
                            {result.flashcardData.cards.map((card: any, i: number) => (
                              <div key={i} className="rounded-xl border border-border/60 bg-muted/20 p-4">
                                <div className="flex items-start justify-between gap-3">
                                  <p className="text-sm font-semibold">{card.question}</p>
                                  {card.difficulty != null && (
                                    <span className="shrink-0 text-[11px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                                      Level {card.difficulty}
                                    </span>
                                  )}
                                </div>
                                <p className="text-sm text-muted-foreground mt-2">{card.answer}</p>
                              </div>
                            ))}
                          </div>

                        </>
                      ) : (
                        <p className="text-sm text-muted-foreground text-center py-8">No flashcards generated.</p>
                      )}
                    </div>
                  )}

                  {/* EXAM TAB */}
                  {activeTab === "exam" && (
                    <div className="space-y-4">
                      {result.practiceExam?.mcqs?.length > 0 && (
                        <div className="space-y-3">
                          <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Multiple Choice</h3>
                          {result.practiceExam.mcqs.map((q: any, i: number) => (
                            <Card key={i} className="p-4 space-y-3">
                              <p className="font-medium text-sm">{i + 1}. {q.question}</p>
                              <div className="grid grid-cols-1 gap-2">
                                {q.options?.map((opt: string, j: number) => {
                                  const isSelected = examAnswer[i] === j
                                  const isCorrect = j === q.correctIndex
                                  const showResult = examChecked
                                  return (
                                    <button
                                      key={j}
                                      onClick={() => !examChecked && setExamAnswer((prev) => ({ ...prev, [i]: j }))}
                                      className={cn(
                                        "text-left text-sm px-4 py-2.5 rounded-xl border transition-all",
                                        showResult && isCorrect ? "bg-green-500/10 border-green-500/40 text-green-700 dark:text-green-300 font-medium" :
                                        showResult && isSelected && !isCorrect ? "bg-red-500/10 border-red-500/40 text-red-700 dark:text-red-300" :
                                        isSelected ? "bg-primary/10 border-primary/40" :
                                        "bg-muted/30 border-border/50 hover:border-border"
                                      )}
                                    >
                                      <span className="font-mono text-xs mr-2 opacity-60">{String.fromCharCode(65 + j)}.</span>
                                      {opt}
                                    </button>
                                  )
                                })}
                              </div>
                              {examChecked && q.explanation && (
                                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-xs text-muted-foreground bg-muted/50 rounded-lg px-3 py-2">
                                  <ChatMarkdown content={q.explanation} className="text-xs" />
                                </motion.div>
                              )}
                            </Card>
                          ))}
                          {!examChecked ? (
                            <Button onClick={() => setExamChecked(true)} className="w-full gap-2">
                              <CheckCircle2 className="h-4 w-4" />Check My Answers
                            </Button>
                          ) : (
                            <Button variant="outline" onClick={() => { setExamAnswer({}); setExamChecked(false) }} className="w-full gap-2">
                              <RefreshCw className="h-4 w-4" />Retry Exam
                            </Button>
                          )}
                        </div>
                      )}
                      {result.practiceExam?.shortAnswer?.length > 0 && (
                        <div className="space-y-3">
                          <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Short Answer</h3>
                          {result.practiceExam.shortAnswer.map((q: any, i: number) => (
                            <Card key={i} className="p-4 space-y-2">
                              <div className="flex items-start justify-between gap-2">
                                <p className="font-medium text-sm">{q.question}</p>
                                {q.difficulty && <Badge variant="outline" className="text-xs shrink-0 capitalize">{q.difficulty}</Badge>}
                              </div>
                              {q.markScheme && (
                                <details className="group">
                                  <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground transition-colors list-none flex items-center gap-1">
                                    <ChevronRight className="h-3 w-3 group-open:rotate-90 transition-transform" />
                                    Show mark scheme
                                  </summary>
                                  <p className="text-xs text-muted-foreground bg-muted/50 rounded-lg px-3 py-2 mt-2">{q.markScheme}</p>
                                </details>
                              )}
                            </Card>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* VIDEOS TAB */}
                  {activeTab === "videos" && (
                    <div className="space-y-3">
                      {result.youtubeLinks?.length > 0 ? (
                        result.youtubeLinks.map((v: any, i: number) => (
                          <Card key={i} className="p-4 flex gap-4">
                            {v.thumbnail && (
                              <div className="relative h-16 w-28 rounded-lg overflow-hidden shrink-0 bg-muted">
                                <img src={v.thumbnail} alt={v.title} className="h-full w-full object-cover" />
                                <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                                  <Play className="h-5 w-5 text-white" />
                                </div>
                              </div>
                            )}
                            <div className="flex-1 min-w-0 space-y-1">
                              <p className="font-semibold text-sm line-clamp-2">{v.title || v.searchQuery}</p>
                              {v.channel && <p className="text-xs text-muted-foreground">{v.channel}</p>}
                              {v.description && <p className="text-xs text-muted-foreground line-clamp-2">{v.description}</p>}
                              {v.reason && <p className="text-xs text-primary">{v.reason}</p>}
                              {v.url ? (
                                <a href={v.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
                                  <Youtube className="h-3.5 w-3.5" />Watch on YouTube
                                  <ExternalLink className="h-3 w-3" />
                                </a>
                              ) : v.searchQuery ? (
                                <a href={`https://www.youtube.com/results?search_query=${encodeURIComponent(v.searchQuery)}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
                                  <Search className="h-3.5 w-3.5" />Search: {v.searchQuery}
                                  <ExternalLink className="h-3 w-3" />
                                </a>
                              ) : null}
                            </div>
                          </Card>
                        ))
                      ) : (
                        <p className="text-sm text-muted-foreground text-center py-8">No videos found. Try adding YOUTUBE_API_KEY to enable video search.</p>
                      )}
                    </div>
                  )}

                  {/* REVIEW TAB */}
                  {activeTab === "review" && (
                    <div className="space-y-4">
                      {result.reviewPlan && (
                        <>
                          {[
                            { key: "immediateRevision", label: "Immediate Revision (Today)", colorClass: "text-red-400" },
                            { key: "day3Review", label: "3-Day Review", colorClass: "text-primary" },
                            { key: "day7Review", label: "7-Day Review", colorClass: "text-green-400" },
                          ].map(({ key, label, colorClass }) => {
                            const items = result.reviewPlan[key]
                            if (!items?.length) return null
                            return (
                              <Card key={key} className="p-4">
                                <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
                                  <RotateCcw className={cn("h-4 w-4", colorClass)} />
                                  {label}
                                </h3>
                                <div className="space-y-2">
                                  {items.map((item: any, i: number) => (
                                    <div key={i} className="flex items-start gap-2 text-sm">
                                      <span className="h-5 w-5 rounded-full bg-muted flex items-center justify-center shrink-0 text-xs font-bold">{i + 1}</span>
                                      <div>
                                        <p className="font-medium">{item.topic}</p>
                                        {(item.action || item.method) && <p className="text-xs text-muted-foreground mt-0.5">{item.action || item.method}</p>}
                                        {item.timeMinutes && <span className="text-xs text-muted-foreground">{item.timeMinutes} min</span>}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </Card>
                            )
                          })}
                          {result.reviewPlan.weeklyCheck && (
                            <Card className="p-4 bg-primary/5 border-primary/20">
                              <p className="text-sm font-medium flex items-start gap-2"><Target className="h-4 w-4 text-primary shrink-0 mt-0.5" />{result.reviewPlan.weeklyCheck}</p>
                            </Card>
                          )}
                        </>
                      )}
                      {result.weaknessInsights && (
                        <Card className="p-4 border-destructive/20 bg-destructive/5">
                          <h3 className="font-semibold text-sm mb-3 flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-destructive" />Your Weak Areas</h3>
                          {result.weaknessInsights.priorityGaps?.map((gap: any, i: number) => (
                            <div key={i} className="flex items-start gap-2 text-sm mb-2">
                              <span className={cn("text-xs px-2 py-0.5 rounded-full font-semibold shrink-0", gap.urgency === "high" ? "bg-red-500/15 text-red-500" : gap.urgency === "medium" ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground")}>{gap.urgency}</span>
                              <div><p className="font-medium">{gap.topic}</p><p className="text-xs text-muted-foreground">{gap.reason}</p></div>
                            </div>
                          ))}
                          {result.weaknessInsights.studyTip && <p className="text-xs text-muted-foreground mt-2 bg-muted/50 rounded-lg px-3 py-2">{result.weaknessInsights.studyTip}</p>}
                        </Card>
                      )}
                    </div>
                  )}

                </motion.div>
              </AnimatePresence>
            </motion.div>
          )}

          {/* ─── HISTORY VIEW ─────────────────────────────────────────────── */}
          {view === "history" && (
            <motion.div key="history" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="max-w-2xl mx-auto w-full space-y-4">
              <h2 className="font-bold text-lg">Previous Study Systems</h2>
              {historyLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => <div key={i} className="h-16 rounded-xl bg-muted/40 animate-pulse" />)}
                </div>
              ) : history.length === 0 ? (
                <div className="text-center py-16">
                  <Layers className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
                  <p className="text-muted-foreground">No study systems generated yet.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {history.map((session) => (
                    <Card key={session.id} className="p-4 hover:border-primary/30 transition-all group">
                      <div className="flex items-start justify-between gap-3">
                        {/* The card body opens the session; delete sits outside
                            it so the two targets can't be mis-tapped. */}
                        <button onClick={() => loadSession(session.id)} className="flex-1 min-w-0 text-left">
                          <p className="font-semibold text-sm line-clamp-1">{session.input_text}</p>
                          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                            {session.subject && <Badge variant="outline" className="text-xs capitalize">{session.subject}</Badge>}
                            <Badge variant="outline" className="text-xs capitalize">{session.input_type}</Badge>
                            <span className="text-xs text-muted-foreground">{new Date(session.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</span>
                          </div>
                        </button>

                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => deleteSession(session.id)}
                            disabled={deletingId === session.id}
                            aria-label="Delete this study system"
                            className="p-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50"
                          >
                            {deletingId === session.id
                              ? <Loader2 className="h-4 w-4 animate-spin" />
                              : <Trash2 className="h-4 w-4" />}
                          </button>
                          <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

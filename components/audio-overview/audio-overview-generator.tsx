"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import {
  Play, Pause, SkipBack, SkipForward, Volume2, VolumeX,
  Upload, FileText, Sparkles, Clock, BookOpen, Mic,
  RotateCcw, Trash2, List, Settings2, X, Headphones,
  Car, Moon, Zap, Brain,
} from "lucide-react"
import { toast } from "sonner"
import { createBrowserClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"

interface Section {
  index: number
  text: string
  startWord: number
}

interface AudioOverview {
  id: string
  title: string
  script_text: string
  sections: Section[]
  duration_mode: string
  word_count: number
  style: string
}

interface HistoryItem {
  id: string
  title: string
  subject: string
  duration_mode: string
  created_at: string
  source_type: string
}

const SPEED_OPTIONS = [0.75, 1, 1.25, 1.5, 1.75, 2]

function formatDurationMode(mode: string) {
  const map: Record<string, string> = { short: "~2 min", medium: "~5 min", long: "~10 min" }
  return map[mode] || mode || ""
}

function WaveformBars({ playing, progress }: { playing: boolean; progress: number }) {
  return (
    <div className="flex items-center gap-0.5 h-8">
      {Array.from({ length: 32 }).map((_, i) => {
        const filled = (i / 32) * 100 <= progress
        const height = [4, 6, 8, 12, 16, 10, 14, 8, 6, 18, 12, 8, 14, 10, 6, 16, 8, 12, 10, 6, 18, 14, 8, 12, 10, 16, 6, 14, 8, 12, 10, 6][i]
        return (
          <div
            key={i}
            className={cn(
              "w-1 rounded-full transition-all",
              filled ? "bg-primary" : "bg-muted-foreground/30",
              playing && filled && "animate-pulse"
            )}
            style={{
              height: `${height}px`,
              animationDelay: `${i * 40}ms`,
              animationDuration: playing ? `${600 + (i % 5) * 100}ms` : undefined,
            }}
          />
        )
      })}
    </div>
  )
}

export function AudioOverviewGenerator() {
  const [user, setUser] = useState<{ id: string } | null>(null)
  const supabaseRef = useRef(createBrowserClient())

  // Generator state
  const [inputTab, setInputTab] = useState<"text" | "pdf">("text")
  const [textInput, setTextInput] = useState("")
  const [title, setTitle] = useState("")
  const [subject, setSubject] = useState("")
  const [style, setStyle] = useState<"conversational" | "lecture" | "podcast">("conversational")
  const [length, setLength] = useState<"short" | "medium" | "long">("medium")
  const [generating, setGenerating] = useState(false)

  // Player state
  const [overview, setOverview] = useState<AudioOverview | null>(null)
  const [currentSection, setCurrentSection] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState(1)
  const [volume, setVolume] = useState(1)
  const [muted, setMuted] = useState(false)
  const [showScript, setShowScript] = useState(true)
  const [showSettings, setShowSettings] = useState(false)

  // Study modes
  const [commuteMode, setCommuteMode] = useState(false)
  const [nightMode, setNightMode] = useState(false)

  // History
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)

  // TTS refs
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null)
  const scriptRef = useRef<HTMLDivElement>(null)
  const sectionRefs = useRef<(HTMLParagraphElement | null)[]>([])
  const stoppedIntentionally = useRef(false)
  const speakTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Auth setup
  useEffect(() => {
    const supabase = supabaseRef.current
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setUser({ id: data.user.id })
    })
  }, [])

  // Fetch history when user is set
  useEffect(() => {
    if (!user) return
    const fetchHistory = async () => {
      setLoadingHistory(true)
      try {
        const { data, error } = await supabaseRef.current
          .from("audio_overviews")
          .select("id, title, subject, duration_mode, created_at, source_type")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(20)
        if (!error && data) setHistory(data)
      } catch { /* silent */ }
      finally { setLoadingHistory(false) }
    }
    fetchHistory()
  }, [user])

  // Cleanup speech on unmount
  useEffect(() => {
    return () => {
      stoppedIntentionally.current = true
      if (speakTimeoutRef.current) clearTimeout(speakTimeoutRef.current)
      if (typeof window !== "undefined" && window.speechSynthesis) {
        window.speechSynthesis.cancel()
      }
    }
  }, [])

  // Apply study mode effects - restart playback with new speed
  const handleCommuteModeToggle = () => {
    const newCommute = !commuteMode
    setCommuteMode(newCommute)
    if (newCommute) {
      setNightMode(false)
      setSpeed(1.5)
      // Restart playback with new speed if currently playing
      if (playing && overview) {
        stopSpeech()
        speakTimeoutRef.current = setTimeout(() => speakSection(currentSection, overview, 1.5, volume, muted), 100)
      }
    }
  }

  const handleNightModeToggle = () => {
    const newNight = !nightMode
    setNightMode(newNight)
    if (newNight) {
      setCommuteMode(false)
      setSpeed(0.75)
      // Restart playback with new speed if currently playing
      if (playing && overview) {
        stopSpeech()
        speakTimeoutRef.current = setTimeout(() => speakSection(currentSection, overview, 0.75, volume, muted), 100)
      }
    }
  }

  // Handle speed change - restart playback with new speed
  const handleSpeedChange = (newSpeed: number) => {
    setSpeed(newSpeed)
    setCommuteMode(false)
    setNightMode(false)
    if (playing && overview) {
      stopSpeech()
      speakTimeoutRef.current = setTimeout(() => speakSection(currentSection, overview, newSpeed, volume, muted), 100)
    }
  }

  // Handle volume change - restart playback with new volume
  const handleVolumeChange = (newVolume: number) => {
    setVolume(newVolume)
    if (playing && overview) {
      stopSpeech()
      speakTimeoutRef.current = setTimeout(() => speakSection(currentSection, overview, speed, newVolume, muted), 100)
    }
  }

  // Handle mute toggle - restart playback
  const handleMuteToggle = () => {
    const newMuted = !muted
    setMuted(newMuted)
    if (playing && overview) {
      stopSpeech()
      speakTimeoutRef.current = setTimeout(() => speakSection(currentSection, overview, speed, volume, newMuted), 100)
    }
  }

  // PDF extraction
  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    toast.loading("Extracting text from PDF...", { id: "pdf" })
    try {
      const pdfjsLib = await import("pdfjs-dist")
      pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`
      const buf = await file.arrayBuffer()
      const pdf = await pdfjsLib.getDocument({ data: buf }).promise
      let text = ""
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i)
        const content = await page.getTextContent()
        text += content.items.map((item: { str?: string }) => item.str || "").join(" ") + "\n\n"
      }
      setTextInput(text.trim())
      if (!title) setTitle(file.name.replace(".pdf", ""))
      toast.success("PDF extracted successfully", { id: "pdf" })
      setInputTab("text")
    } catch {
      toast.error("Failed to extract PDF text", { id: "pdf" })
    }
    if (e.target) e.target.value = ""
  }

  const handleGenerate = async () => {
    if (!textInput.trim() || textInput.trim().length < 50) {
      toast.error("Please enter at least 50 characters of content")
      return
    }
    if (!user) {
      toast.error("Please sign in to generate audio overviews")
      return
    }
    setGenerating(true)
    stopSpeech()
    try {
      const res = await fetch("/api/audio-overview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentText: textInput, title, subject, style, length }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to generate")
      
      const wordCount = data.script_text?.split(/\s+/).length || 0
      setOverview({
        id: data.id,
        title: data.title,
        script_text: data.script_text,
        sections: data.sections || [],
        duration_mode: data.duration_mode || length,
        word_count: wordCount,
        style: data.style || style,
      })
      setCurrentSection(0)
      setPlaying(false)
      toast.success("Audio overview ready! Press play to listen.")
      
      // Refresh history
      const { data: historyData } = await supabaseRef.current
        .from("audio_overviews")
        .select("id, title, subject, duration_mode, created_at, source_type")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(20)
      if (historyData) setHistory(historyData)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to generate audio overview")
    } finally {
      setGenerating(false)
    }
  }

  // TTS controls
  const stopSpeech = useCallback(() => {
    stoppedIntentionally.current = true
    if (speakTimeoutRef.current) {
      clearTimeout(speakTimeoutRef.current)
      speakTimeoutRef.current = null
    }
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel()
    }
    utteranceRef.current = null
    setPlaying(false)
  }, [])

  const speakSection = useCallback((sectionIdx: number, currentOverview: AudioOverview | null, currentSpeed: number, currentVolume: number, isMuted: boolean) => {
    if (!currentOverview) return

    const section = currentOverview.sections[sectionIdx]
    if (!section) return

    stoppedIntentionally.current = false

    const utterance = new SpeechSynthesisUtterance(section.text)
    utterance.rate = currentSpeed
    utterance.volume = isMuted ? 0 : currentVolume

    utterance.onend = () => {
      if (stoppedIntentionally.current) return
      if (sectionIdx < currentOverview.sections.length - 1) {
        const next = sectionIdx + 1
        setCurrentSection(next)
        speakTimeoutRef.current = setTimeout(() => speakSection(next, currentOverview, currentSpeed, currentVolume, isMuted), 100)
      } else {
        setPlaying(false)
        setCurrentSection(0)
        toast.success("Audio overview complete!")
      }
    }

    utterance.onerror = (e) => {
      if (e.error === "interrupted" || e.error === "canceled") return
      console.error("[v0] TTS error:", e.error)
      setPlaying(false)
    }

    utteranceRef.current = utterance
    window.speechSynthesis.speak(utterance)
    setCurrentSection(sectionIdx)
    setPlaying(true)
  }, [])

  // Scroll active section into view
  useEffect(() => {
    sectionRefs.current[currentSection]?.scrollIntoView({ behavior: "smooth", block: "nearest" })
  }, [currentSection])

  const handlePlayPause = () => {
    if (!overview) return
    if (playing) {
      stoppedIntentionally.current = true
      window.speechSynthesis.cancel()
      setPlaying(false)
    } else {
      speakSection(currentSection, overview, speed, volume, muted)
    }
  }

  const handlePrevSection = () => {
    if (!overview) return
    const wasPlaying = playing
    stopSpeech()
    const prev = Math.max(0, currentSection - 1)
    setCurrentSection(prev)
    if (wasPlaying) {
      speakTimeoutRef.current = setTimeout(() => speakSection(prev, overview, speed, volume, muted), 100)
    }
  }

  const handleNextSection = () => {
    if (!overview) return
    const wasPlaying = playing
    stopSpeech()
    const next = Math.min(overview.sections.length - 1, currentSection + 1)
    setCurrentSection(next)
    if (wasPlaying) {
      speakTimeoutRef.current = setTimeout(() => speakSection(next, overview, speed, volume, muted), 100)
    }
  }

  const handleRestart = () => {
    stopSpeech()
    setCurrentSection(0)
  }

  const handleLoadHistory = async (id: string) => {
    if (!user) return
    try {
      const { data, error } = await supabaseRef.current
        .from("audio_overviews")
        .select("*")
        .eq("id", id)
        .eq("user_id", user.id)
        .single()
      
      if (error) throw error
      
      // Parse script JSON
      let scriptText = ""
      let sections: Section[] = []
      try {
        const parsed = JSON.parse(data.script || "{}")
        scriptText = parsed.text || ""
        sections = parsed.sections || []
      } catch { 
        scriptText = data.script || "" 
      }
      
      const wordCount = scriptText.split(/\s+/).length
      
      setOverview({
        id: data.id,
        title: data.title,
        script_text: scriptText,
        sections,
        duration_mode: data.duration_mode || "medium",
        word_count: wordCount,
        style: data.voice_style || "conversational",
      })
      setCurrentSection(0)
      stopSpeech()
    } catch {
      toast.error("Failed to load overview")
    }
  }

  const handleDelete = async (id: string) => {
    if (!user) return
    try {
      const { error } = await supabaseRef.current
        .from("audio_overviews")
        .delete()
        .eq("id", id)
        .eq("user_id", user.id)
      
      if (error) throw error
      
      setHistory((prev) => prev.filter((h) => h.id !== id))
      if (overview?.id === id) { 
        setOverview(null)
        stopSpeech() 
      }
      toast.success("Deleted")
    } catch {
      toast.error("Failed to delete")
    }
  }

  const progress = overview
    ? ((currentSection / Math.max(overview.sections.length - 1, 1)) * 100)
    : 0

  const charCount = textInput.length

  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <Headphones className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Audio Overview</h1>
          <p className="text-sm text-muted-foreground">Revision you can listen to anywhere</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Generator + History */}
        <div className="lg:col-span-1 space-y-4">
          {/* Generator Card */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                Generate Overview
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Input Tabs */}
              <Tabs value={inputTab} onValueChange={(v) => setInputTab(v as "text" | "pdf")}>
                <TabsList className="w-full h-8">
                  <TabsTrigger value="text" className="flex-1 text-xs">Text / Notes</TabsTrigger>
                  <TabsTrigger value="pdf" className="flex-1 text-xs">Upload PDF</TabsTrigger>
                </TabsList>
                <TabsContent value="text" className="mt-2">
                  <Textarea
                    value={textInput}
                    onChange={(e) => setTextInput(e.target.value)}
                    placeholder="Paste your notes, textbook excerpts, or any study material here..."
                    className="min-h-[120px] text-sm resize-none"
                  />
                  <p className="text-xs text-muted-foreground mt-1">{charCount} characters</p>
                </TabsContent>
                <TabsContent value="pdf" className="mt-2">
                  <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-lg p-6 cursor-pointer hover:border-primary hover:bg-primary/5 transition-all">
                    <Upload className="h-6 w-6 text-muted-foreground" />
                    <span className="text-sm font-medium">Upload PDF</span>
                    <span className="text-xs text-muted-foreground">Max 10MB</span>
                    <input type="file" accept=".pdf" className="hidden" onChange={handlePdfUpload} />
                  </label>
                </TabsContent>
              </Tabs>

              {/* Title & Subject */}
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">Title</Label>
                  <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Cell Biology" className="h-8 text-sm" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Subject</Label>
                  <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="e.g. Biology" className="h-8 text-sm" />
                </div>
              </div>

              {/* Style */}
              <div className="space-y-1.5">
                <Label className="text-xs">Voice Style</Label>
                <div className="grid grid-cols-3 gap-1.5">
                  {([
                    { key: "conversational", icon: Brain, label: "Tutor" },
                    { key: "lecture", icon: BookOpen, label: "Lecture" },
                    { key: "podcast", icon: Mic, label: "Podcast" },
                  ] as const).map((s) => (
                    <button
                      key={s.key}
                      onClick={() => setStyle(s.key)}
                      className={cn(
                        "rounded-md border px-2 py-2 text-xs font-medium transition-all flex flex-col items-center gap-1",
                        style === s.key ? "border-primary bg-primary/10 text-primary" : "border-border hover:border-primary/50"
                      )}
                    >
                      <s.icon className="h-4 w-4" />
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Length */}
              <div className="space-y-1.5">
                <Label className="text-xs">Duration</Label>
                <div className="grid grid-cols-3 gap-1.5">
                  {([
                    { key: "short", label: "Quick", desc: "~2 min" },
                    { key: "medium", label: "Standard", desc: "~5 min" },
                    { key: "long", label: "Deep", desc: "~10 min" },
                  ] as const).map((l) => (
                    <button
                      key={l.key}
                      onClick={() => setLength(l.key)}
                      className={cn(
                        "rounded-md border px-2 py-2 text-xs font-medium transition-all flex flex-col items-center",
                        length === l.key ? "border-primary bg-primary/10 text-primary" : "border-border hover:border-primary/50"
                      )}
                    >
                      <span>{l.label}</span>
                      <span className="text-[10px] text-muted-foreground">{l.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              <Button onClick={handleGenerate} disabled={generating || !textInput.trim() || !user} className="w-full">
                {generating ? (
                  <><Sparkles className="h-4 w-4 mr-2 animate-spin" /> Generating...</>
                ) : (
                  <><Mic className="h-4 w-4 mr-2" /> Generate Audio Overview</>
                )}
              </Button>
              
              {!user && (
                <p className="text-xs text-center text-muted-foreground">Sign in to generate audio overviews</p>
              )}
            </CardContent>
          </Card>

          {/* History */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <List className="h-4 w-4" />
                History
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 max-h-64 overflow-y-auto">
              {loadingHistory ? (
                <p className="text-xs text-muted-foreground text-center py-4">Loading...</p>
              ) : history.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">No overviews yet</p>
              ) : (
                history.map((item) => (
                  <div
                    key={item.id}
                    className={cn(
                      "group flex items-center gap-2 rounded-lg border p-2.5 cursor-pointer hover:border-primary/50 hover:bg-muted/50 transition-all",
                      overview?.id === item.id && "border-primary bg-primary/5"
                    )}
                    onClick={() => handleLoadHistory(item.id)}
                  >
                    <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Headphones className="h-3.5 w-3.5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{item.title}</p>
                      <p className="text-xs text-muted-foreground">{formatDurationMode(item.duration_mode)}</p>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDelete(item.id) }}
                      className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right: Player */}
        <div className="lg:col-span-2 space-y-4">
          {!overview ? (
            <div className="flex flex-col items-center justify-center h-96 border-2 border-dashed rounded-2xl text-center space-y-3">
              <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center">
                <Headphones className="h-8 w-8 text-primary" />
              </div>
              <div>
                <p className="font-medium text-muted-foreground">No audio overview yet</p>
                <p className="text-sm text-muted-foreground">Generate one from your study material</p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Now Playing Card */}
              <Card className="border-primary/20 bg-card">
                <CardContent className="p-5 space-y-4">
                  {/* Title + meta */}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h2 className="font-semibold text-lg leading-tight text-balance">{overview.title}</h2>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <Badge variant="secondary" className="text-xs capitalize">{overview.style}</Badge>
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatDurationMode(overview.duration_mode)}
                        </span>
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <BookOpen className="h-3 w-3" />
                          {overview.word_count} words
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setShowScript((s) => !s)} title="Toggle script">
                        <FileText className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setShowSettings((s) => !s)} title="Settings">
                        <Settings2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Study Mode toggles */}
                  <div className="flex gap-3">
                    <button
                      onClick={handleCommuteModeToggle}
                      className={cn(
                        "flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition-all",
                        commuteMode ? "border-amber-500 bg-amber-500/10 text-amber-600 dark:text-amber-400" : "border-border hover:border-amber-500/50"
                      )}
                    >
                      <Car className="h-3.5 w-3.5" />
                      Commute {commuteMode && "(1.5x)"}
                    </button>
                    <button
                      onClick={handleNightModeToggle}
                      className={cn(
                        "flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition-all",
                        nightMode ? "border-indigo-500 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400" : "border-border hover:border-indigo-500/50"
                      )}
                    >
                      <Moon className="h-3.5 w-3.5" />
                      Night {nightMode && "(0.75x)"}
                    </button>
                  </div>

                  {/* Waveform + progress */}
                  <div className="space-y-2">
                    <WaveformBars playing={playing} progress={progress} />
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>Section {currentSection + 1} / {overview.sections.length}</span>
                      <span>{Math.round(progress)}%</span>
                    </div>
                    {/* Section progress bar */}
                    <div
                      className="h-1.5 bg-muted rounded-full cursor-pointer"
                      onClick={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect()
                        const pct = (e.clientX - rect.left) / rect.width
                        const targetSection = Math.round(pct * (overview.sections.length - 1))
                        stopSpeech()
                        setCurrentSection(targetSection)
                        speakSection(targetSection, overview, speed, volume, muted)
                      }}
                    >
                      <div
                        className="h-full bg-primary rounded-full transition-all duration-300"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>

                  {/* Controls */}
                  <div className="flex items-center justify-center gap-2">
                    <Button variant="ghost" size="icon" className="h-9 w-9" onClick={handleRestart} title="Restart">
                      <RotateCcw className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-9 w-9" onClick={handlePrevSection} disabled={currentSection === 0}>
                      <SkipBack className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      className="h-12 w-12 rounded-full shadow-lg"
                      onClick={handlePlayPause}
                    >
                      {playing ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 ml-0.5" />}
                    </Button>
                    <Button variant="ghost" size="icon" className="h-9 w-9" onClick={handleNextSection} disabled={currentSection >= overview.sections.length - 1}>
                      <SkipForward className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9"
                      onClick={handleMuteToggle}
                      title={muted ? "Unmute" : "Mute"}
                    >
                      {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                    </Button>
                  </div>

                  {/* Settings panel */}
                  {showSettings && (
                    <div className="rounded-xl border bg-muted/30 p-3 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium">Playback Settings</span>
                        <button onClick={() => setShowSettings(false)}><X className="h-4 w-4 text-muted-foreground" /></button>
                      </div>
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <Label className="text-xs">Speed</Label>
                          <span className="text-xs font-mono text-primary">{speed}x</span>
                        </div>
                        <div className="flex gap-1">
                          {SPEED_OPTIONS.map((s) => (
                            <button
                              key={s}
                              onClick={() => handleSpeedChange(s)}
                              className={cn(
                                "flex-1 rounded text-xs py-1 border transition-all",
                                speed === s ? "border-primary bg-primary/10 text-primary font-medium" : "border-border hover:border-primary/50"
                              )}
                            >
                              {s}x
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <Label className="text-xs">Volume</Label>
                          <span className="text-xs font-mono text-primary">{Math.round(volume * 100)}%</span>
                        </div>
                        <Slider
                          value={[volume]}
                          min={0}
                          max={1}
                          step={0.1}
                          onValueChange={([v]) => handleVolumeChange(v)}
                          className="w-full"
                        />
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Section Navigator */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center justify-between">
                    <span className="flex items-center gap-2"><List className="h-4 w-4" /> Sections</span>
                    <span className="text-xs font-normal text-muted-foreground">{overview.sections.length} parts</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                    {overview.sections.map((_, i) => (
                      <button
                        key={i}
                        onClick={() => { stopSpeech(); setCurrentSection(i); speakSection(i, overview, speed, volume, muted) }}
                        className={cn(
                          "flex-shrink-0 h-8 w-8 rounded-full text-xs font-medium border transition-all",
                          i === currentSection
                            ? "border-primary bg-primary text-primary-foreground"
                            : i < currentSection
                            ? "border-primary/50 bg-primary/10 text-primary"
                            : "border-border text-muted-foreground hover:border-primary/50"
                        )}
                      >
                        {i + 1}
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Script viewer */}
              {showScript && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      Script
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div ref={scriptRef} className="max-h-72 overflow-y-auto space-y-3 pr-1">
                      {overview.sections.map((section, i) => (
                        <p
                          key={i}
                          ref={(el) => { sectionRefs.current[i] = el }}
                          onClick={() => { stopSpeech(); setCurrentSection(i); speakSection(i, overview, speed, volume, muted) }}
                          className={cn(
                            "text-sm leading-relaxed rounded-lg p-2.5 cursor-pointer transition-all border",
                            i === currentSection
                              ? "border-primary/40 bg-primary/5 text-foreground"
                              : "border-transparent text-muted-foreground hover:border-border hover:text-foreground"
                          )}
                        >
                          <span className="inline-flex items-center justify-center h-4 w-4 rounded-full bg-muted text-[10px] font-medium mr-2 flex-shrink-0">
                            {i + 1}
                          </span>
                          {section.text}
                        </p>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

"use client"

import type React from "react"
import { useState, useRef, useEffect } from "react"
import { motion } from "framer-motion"
import {
  Sparkles, Loader2, FileText, Upload, Minus, Plus, Image as ImageIcon,
  StickyNote, BookOpenCheck, MessageSquare, X, ChevronDown, ChevronUp,
  Zap, BookOpen, GraduationCap,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { toast } from "sonner"
import { PDFUpload } from "./pdf-upload"
import { createBrowserClient } from "@/lib/supabase/client"

interface AIFlashcardGeneratorProps {
  deckId: string
  subject?: string
  onGenerated?: () => void
}

type GenerationMode = "quick" | "full" | "exam"
type CardType = "qa" | "definition" | "cloze"

interface SourceItem {
  id: string
  type: "note" | "revision" | "tutor"
  title: string
  content: string
}

export function AIFlashcardGenerator({ deckId, subject, onGenerated }: AIFlashcardGeneratorProps) {
  const [inputMode, setInputMode] = useState<"text" | "pdf" | "image" | "saved">("text")
  const [content, setContent] = useState("")
  const [pdfFileName, setPdfFileName] = useState<string | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [cardCount, setCardCount] = useState(10)
  const [mode, setMode] = useState<GenerationMode>("full")
  const [cardTypes, setCardTypes] = useState<CardType[]>(["qa", "definition", "cloze"])
  const [loading, setLoading] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)

  // Saved sources
  const [savedSources, setSavedSources] = useState<SourceItem[]>([])
  const [selectedSources, setSelectedSources] = useState<string[]>([])
  const [loadingSources, setLoadingSources] = useState(false)

  const imageInputRef = useRef<HTMLInputElement>(null)
  const supabase = createBrowserClient()

  useEffect(() => {
    if (inputMode === "saved") fetchSavedSources()
  }, [inputMode])

  const fetchSavedSources = async () => {
    setLoadingSources(true)
    try {
      const [notesRes, revisionRes, tutorRes] = await Promise.all([
        supabase.from("notes").select("id, title, content").order("updated_at", { ascending: false }).limit(20),
        supabase.from("revision_notes").select("id, title, ai_notes").order("created_at", { ascending: false }).limit(20),
        supabase.from("tutor_sessions").select("id, subject, messages").order("updated_at", { ascending: false }).limit(10),
      ])

      const sources: SourceItem[] = []

      notesRes.data?.forEach((n) => {
        if (n.content) sources.push({ id: `note-${n.id}`, type: "note", title: n.title || "Untitled Note", content: n.content })
      })
      revisionRes.data?.forEach((r) => {
        const text = typeof r.ai_notes === "object" && r.ai_notes
          ? (r.ai_notes as any).sections?.map((s: any) => `${s.title}\n${s.content}`).join("\n\n") || JSON.stringify(r.ai_notes)
          : ""
        if (text) sources.push({ id: `rev-${r.id}`, type: "revision", title: r.title || "Revision Notes", content: text })
      })
      tutorRes.data?.forEach((s) => {
        const msgs = Array.isArray(s.messages) ? s.messages : []
        const text = msgs.filter((m: any) => m.role === "assistant").map((m: any) => m.content).join("\n\n")
        if (text) sources.push({ id: `tutor-${s.id}`, type: "tutor", title: s.subject || "Tutor Session", content: text })
      })

      setSavedSources(sources)
    } catch {
      toast.error("Failed to load saved sources")
    } finally {
      setLoadingSources(false)
    }
  }

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith("image/")) { toast.error("Please upload an image file"); return }
    if (file.size > 5 * 1024 * 1024) { toast.error("Image must be under 5MB"); return }
    setImageFile(file)
    const reader = new FileReader()
    reader.onload = (ev) => setImagePreview(ev.target?.result as string)
    reader.readAsDataURL(file)
    toast.success(`Image ready: ${file.name}`)
  }

  const toggleCardType = (type: CardType) => {
    setCardTypes((prev) =>
      prev.includes(type) ? (prev.length > 1 ? prev.filter((t) => t !== type) : prev) : [...prev, type]
    )
  }

  const toggleSource = (id: string) => {
    setSelectedSources((prev) => prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id])
  }

  const getModeConfig = (m: GenerationMode) => ({
    quick: { label: "Quick Review", desc: "Fewer, high-yield cards", icon: Zap, count: Math.min(cardCount, 8) },
    full: { label: "Full Coverage", desc: "Maximum concept coverage", icon: BookOpen, count: cardCount },
    exam: { label: "Exam Focus", desc: "Likely testable facts only", icon: GraduationCap, count: Math.min(cardCount, 15) },
  })[m]

  const handleGenerate = async () => {
    let finalContent = content

    if (inputMode === "saved") {
      const combined = savedSources
        .filter((s) => selectedSources.includes(s.id))
        .map((s) => `=== ${s.title} ===\n${s.content}`)
        .join("\n\n")
      if (!combined.trim()) { toast.error("Select at least one source"); return }
      finalContent = combined
    } else if (inputMode === "image") {
      if (!imagePreview) { toast.error("Please upload an image"); return }
      finalContent = imagePreview // send as base64 for API to handle
    } else {
      if (!finalContent.trim()) { toast.error("Please provide content"); return }
    }

    setLoading(true)
    try {
      const response = await fetch("/api/ai/generate-flashcards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: finalContent,
          deckId,
          subject,
          cardCount,
          mode,
          cardTypes,
          isImage: inputMode === "image",
        }),
      })

      if (!response.ok) {
        const err = await response.json()
        throw new Error(err.error || "Failed to generate")
      }

      const data = await response.json()
      toast.success(`Generated ${data.count} flashcards!`)
      setContent("")
      setPdfFileName(null)
      setImagePreview(null)
      setImageFile(null)
      setSelectedSources([])
      // Call the parent's refresh callback instead of router.refresh()
      // so only the card list updates, not the entire page
      onGenerated?.()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to generate flashcards")
    } finally {
      setLoading(false)
    }
  }

  const canGenerate = () => {
    if (loading) return false
    if (inputMode === "text") return content.trim().length > 0
    if (inputMode === "pdf") return content.trim().length > 0
    if (inputMode === "image") return !!imagePreview
    if (inputMode === "saved") return selectedSources.length > 0
    return false
  }

  const modeConfig = getModeConfig(mode)

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            AI Flashcard Generator
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">

          {/* Generation Mode */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Generation Mode</Label>
            <div className="grid grid-cols-3 gap-2">
              {(["quick", "full", "exam"] as GenerationMode[]).map((m) => {
                const cfg = getModeConfig(m)
                const Icon = cfg.icon
                return (
                  <button
                    key={m}
                    onClick={() => setMode(m)}
                    className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all text-center ${
                      mode === m
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border hover:border-primary/40 hover:bg-muted/50"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="text-xs font-semibold">{cfg.label}</span>
                    <span className="text-[10px] text-muted-foreground leading-tight">{cfg.desc}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Input Source Tabs */}
          <Tabs value={inputMode} onValueChange={(v) => setInputMode(v as typeof inputMode)}>
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="text" className="flex items-center gap-1.5 text-xs">
                <FileText className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Text</span>
              </TabsTrigger>
              <TabsTrigger value="pdf" className="flex items-center gap-1.5 text-xs">
                <Upload className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">PDF</span>
              </TabsTrigger>
              <TabsTrigger value="image" className="flex items-center gap-1.5 text-xs">
                <ImageIcon className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Image</span>
              </TabsTrigger>
              <TabsTrigger value="saved" className="flex items-center gap-1.5 text-xs">
                <StickyNote className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Saved</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="text" className="mt-3 space-y-2">
              <Textarea
                placeholder="Paste your notes, textbook excerpts, or any study material..."
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={6}
                className="resize-none"
              />
              <p className="text-xs text-muted-foreground">{content.length} characters</p>
            </TabsContent>

            <TabsContent value="pdf" className="mt-3 space-y-3">
              <PDFUpload
                onTextExtracted={(text, name) => {
                  setContent(text)
                  setPdfFileName(name)
                  toast.success(`Extracted from ${name}`)
                }}
                disabled={loading}
              />
              {pdfFileName && content && (
                <div className="p-3 bg-muted/50 rounded-lg">
                  <p className="text-xs text-muted-foreground mb-1 font-medium">{pdfFileName} — preview:</p>
                  <p className="text-xs line-clamp-3">{content.substring(0, 300)}...</p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="image" className="mt-3 space-y-3">
              <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
              {!imagePreview ? (
                <div
                  className="border-2 border-dashed rounded-xl p-6 text-center cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-all"
                  onClick={() => imageInputRef.current?.click()}
                >
                  <div className="h-12 w-12 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center mx-auto mb-3">
                    <ImageIcon className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                  </div>
                  <p className="text-sm font-medium">Upload a diagram, slide, or textbook photo</p>
                  <p className="text-xs text-muted-foreground mt-1">JPG, PNG, WEBP — max 5MB</p>
                </div>
              ) : (
                <div className="relative rounded-xl overflow-hidden border">
                  <img src={imagePreview} alt="Uploaded" className="w-full max-h-48 object-contain bg-muted/30" />
                  <Button
                    size="icon"
                    variant="destructive"
                    className="absolute top-2 right-2 h-7 w-7"
                    onClick={() => { setImagePreview(null); setImageFile(null) }}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )}
              <p className="text-xs text-muted-foreground">AI will analyze the image and extract key concepts to build flashcards.</p>
            </TabsContent>

            <TabsContent value="saved" className="mt-3 space-y-3">
              {loadingSources ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : savedSources.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  No saved notes, revision notes, or tutor sessions found.
                </div>
              ) : (
                <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                  {savedSources.map((src) => {
                    const icons = { note: StickyNote, revision: BookOpenCheck, tutor: MessageSquare }
                    const colors = { note: "text-yellow-600", revision: "text-green-600", tutor: "text-blue-600" }
                    const Icon = icons[src.type]
                    const selected = selectedSources.includes(src.id)
                    return (
                      <div
                        key={src.id}
                        onClick={() => toggleSource(src.id)}
                        className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                          selected ? "border-primary bg-primary/5" : "border-border hover:border-primary/30"
                        }`}
                      >
                        <Checkbox checked={selected} onCheckedChange={() => toggleSource(src.id)} />
                        <Icon className={`h-4 w-4 flex-shrink-0 ${colors[src.type]}`} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{src.title}</p>
                          <p className="text-xs text-muted-foreground capitalize">{src.type}</p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
              {selectedSources.length > 0 && (
                <p className="text-xs text-muted-foreground">{selectedSources.length} source{selectedSources.length > 1 ? "s" : ""} selected</p>
              )}
            </TabsContent>
          </Tabs>

          {/* Advanced Options Toggle */}
          <button
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => setShowAdvanced(!showAdvanced)}
          >
            {showAdvanced ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            Advanced Options
          </button>

          {showAdvanced && (
            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4 border rounded-xl p-4 bg-muted/30">
              {/* Card Count */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Number of Cards</Label>
                <div className="flex items-center gap-2">
                  <Button type="button" variant="outline" size="icon" onClick={() => setCardCount((p) => Math.max(1, p - 1))} disabled={cardCount <= 1} className="h-9 w-9 bg-transparent">
                    <Minus className="h-3.5 w-3.5" />
                  </Button>
                  <Input
                    type="number"
                    min={1}
                    max={50}
                    value={cardCount}
                    onChange={(e) => setCardCount(Math.max(1, Math.min(50, parseInt(e.target.value) || 10)))}
                    className="text-center font-medium w-20"
                  />
                  <Button type="button" variant="outline" size="icon" onClick={() => setCardCount((p) => Math.min(50, p + 1))} disabled={cardCount >= 50} className="h-9 w-9 bg-transparent">
                    <Plus className="h-3.5 w-3.5" />
                  </Button>
                  <span className="text-xs text-muted-foreground">max 50</span>
                </div>
              </div>

              {/* Card Types */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Card Types</Label>
                <div className="flex gap-2 flex-wrap">
                  {([
                    { type: "qa" as CardType, label: "Q & A" },
                    { type: "definition" as CardType, label: "Definition" },
                    { type: "cloze" as CardType, label: "Fill-in-blank" },
                  ]).map(({ type, label }) => (
                    <button
                      key={type}
                      onClick={() => toggleCardType(type)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium border-2 transition-all ${
                        cardTypes.includes(type)
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border text-muted-foreground hover:border-primary/40"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">AI will mix selected card types</p>
              </div>
            </motion.div>
          )}

          {/* Generate Button */}
          <Button className="w-full" onClick={handleGenerate} disabled={!canGenerate()}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating {cardCount} cards...
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                Generate {cardCount} Flashcards
                <Badge variant="secondary" className="ml-2 text-xs">
                  {modeConfig.label}
                </Badge>
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    </motion.div>
  )
}

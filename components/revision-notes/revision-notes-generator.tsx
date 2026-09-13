"use client"

import { useState, useEffect, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { ChatMarkdown } from "@/components/chat/chat-markdown"
import {
  FileText,
  Sparkles,
  ArrowLeft,
  Clock,
  Download,
  Trash2,
  BookOpen,
  Lightbulb,
  Star,
  List,
  GraduationCap,
  ChevronRight,
  ChevronDown,
  Search,
  Highlighter,
  BookMarked,
  Type,
  Upload,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { toast } from "sonner"
import { PDFUpload } from "@/components/flashcards/pdf-upload"

interface RevisionNotesContent {
  title: string
  summary: string
  sections: Array<{
    heading: string
    content: string
    keyPoints: string[]
    tips?: string
  }>
  highlights: string[]
  definitions: Array<{ term: string; definition: string }>
  examTips: string[]
  quickReview: string[]
}

interface RevisionNote {
  id: string
  title: string
  subject: string
  content: RevisionNotesContent
  format: string
  source_type: string
  created_at: string
}

interface HistoryItem {
  id: string
  title: string
  subject: string
  format: string
  source_type: string
  created_at: string
}

interface RevisionNotesGeneratorProps {
  onBack?: () => void
}

export function RevisionNotesGenerator({ onBack }: RevisionNotesGeneratorProps) {
  const [inputMode, setInputMode] = useState<"pdf" | "text">("pdf")
  const [extractedText, setExtractedText] = useState("")
  const [textInput, setTextInput] = useState("")
  const [topic, setTopic] = useState("")
  const [loading, setLoading] = useState(false)
  const [revisionNotes, setRevisionNotes] = useState<RevisionNotesContent | null>(null)
  const [notesId, setNotesId] = useState<string | null>(null)
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [selectedNote, setSelectedNote] = useState<RevisionNote | null>(null)
  const [expandedSections, setExpandedSections] = useState<Set<number>>(new Set([0]))
  const [searchTerm, setSearchTerm] = useState("")
  const [activeTab, setActiveTab] = useState("sections")
  const printRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetchHistory()
  }, [])

  const fetchHistory = async () => {
    setLoadingHistory(true)
    try {
      const response = await fetch("/api/revision-notes")
      if (response.ok) {
        const data = await response.json()
        setHistory(data)
      }
    } catch (error) {
      console.error("Error fetching history:", error)
    } finally {
      setLoadingHistory(false)
    }
  }

  const handleGenerate = async () => {
    const documentText = inputMode === "pdf" ? extractedText : textInput

    if (!documentText.trim()) {
      toast.error(inputMode === "pdf" ? "Please upload a PDF first" : "Please enter some text")
      return
    }
    if (!topic.trim()) {
      toast.error("Please enter a topic")
      return
    }

    setLoading(true)
    try {
      const response = await fetch("/api/revision-notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentText,
          topic,
          format: "structured",
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Unknown error" }))
        throw new Error(errorData.error || "Failed to generate revision notes")
      }

      const data = await response.json()
      setRevisionNotes(data.ai_notes)
      setNotesId(data.id)
      setExpandedSections(new Set([0]))
      toast.success("Revision notes generated!")
      fetchHistory()
    } catch (error) {
      console.error("Error generating revision notes:", error)
      toast.error(error instanceof Error ? error.message : "Failed to generate revision notes")
    } finally {
      setLoading(false)
    }
  }

  const handleLoadNote = async (id: string) => {
    setLoadingHistory(true)
    try {
      const response = await fetch(`/api/revision-notes?id=${id}`)
      if (response.ok) {
        const data = await response.json()
        setSelectedNote(data)
        setRevisionNotes(data.ai_notes)
        setNotesId(data.id)
        setExpandedSections(new Set([0]))
      }
    } catch (error) {
      console.error("Error loading note:", error)
      toast.error("Failed to load revision notes")
    } finally {
      setLoadingHistory(false)
    }
  }

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm("Delete these revision notes?")) return

    try {
      const response = await fetch(`/api/revision-notes?id=${id}`, { method: "DELETE" })
      if (response.ok) {
        toast.success("Revision notes deleted")
        fetchHistory()
        if (notesId === id) {
          setRevisionNotes(null)
          setNotesId(null)
          setSelectedNote(null)
        }
      }
    } catch (error) {
      console.error("Error deleting:", error)
      toast.error("Failed to delete")
    }
  }

  const handleExportPDF = () => {
    if (printRef.current) {
      const printContent = printRef.current.innerHTML
      const printWindow = window.open("", "_blank")
      if (printWindow) {
        printWindow.document.write(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>${revisionNotes?.title || "Revision Notes"}</title>
            <style>
              body { font-family: system-ui, -apple-system, sans-serif; padding: 40px; max-width: 800px; margin: 0 auto; }
              h1 { color: #1a1a1a; border-bottom: 2px solid #6366f1; padding-bottom: 10px; }
              h2 { color: #4f46e5; margin-top: 30px; }
              h3 { color: #6366f1; }
              .summary { background: #f0f9ff; padding: 15px; border-radius: 8px; margin: 20px 0; }
              .section { margin: 25px 0; padding: 20px; background: #fafafa; border-radius: 8px; }
              .key-points { margin: 15px 0; }
              .key-points li { margin: 8px 0; }
              .tip { background: #fef3c7; padding: 10px; border-radius: 6px; margin: 10px 0; }
              .highlights { background: #fef9c3; padding: 20px; border-radius: 8px; margin: 25px 0; }
              .highlights li { margin: 8px 0; font-weight: 500; }
              .definitions { margin: 25px 0; }
              .definition { background: #f0fdf4; padding: 12px; border-radius: 6px; margin: 10px 0; }
              .definition strong { color: #166534; }
              .exam-tips { background: #fdf2f8; padding: 20px; border-radius: 8px; margin: 25px 0; }
              .exam-tips li { margin: 8px 0; }
              .quick-review { background: #eff6ff; padding: 20px; border-radius: 8px; }
              .quick-review li { margin: 8px 0; }
            </style>
          </head>
          <body>${printContent}</body>
          </html>
        `)
        printWindow.document.close()
        printWindow.print()
      }
    }
  }

  const toggleSection = (index: number) => {
    setExpandedSections((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(index)) {
        newSet.delete(index)
      } else {
        newSet.add(index)
      }
      return newSet
    })
  }

  const handleCreateNew = () => {
    setRevisionNotes(null)
    setNotesId(null)
    setSelectedNote(null)
    setExtractedText("")
    setTextInput("")
    setTopic("")
  }

  // Filter sections by search term
  const filteredSections = revisionNotes?.sections.filter(
    (section) =>
      section.heading.toLowerCase().includes(searchTerm.toLowerCase()) ||
      section.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
      section.keyPoints.some((kp) => kp.toLowerCase().includes(searchTerm.toLowerCase()))
  )

  // If viewing revision notes
  if (revisionNotes) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <Button variant="outline" size="sm" onClick={handleCreateNew} className="gap-2 bg-transparent">
            <ArrowLeft className="h-4 w-4" />
            Create New
          </Button>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search notes..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 w-48"
              />
            </div>
            <Button variant="outline" size="sm" onClick={handleExportPDF} className="gap-2 bg-transparent">
              <Download className="h-4 w-4" />
              Export PDF
            </Button>
          </div>
        </div>

        {/* Header Card */}
        <Card className="border-2 border-primary/30 bg-gradient-to-br from-primary/5 to-transparent">
          <CardContent className="pt-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold">{revisionNotes.title}</h2>
                <ChatMarkdown content={revisionNotes.summary} className="text-muted-foreground" />
              </div>
              <Badge variant="secondary" className="shrink-0">
                {revisionNotes.sections.length} Sections
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Tabs Navigation */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid grid-cols-5 w-full">
            <TabsTrigger value="sections" className="gap-2">
              <BookOpen className="h-4 w-4" />
              <span className="hidden sm:inline">Sections</span>
            </TabsTrigger>
            <TabsTrigger value="highlights" className="gap-2">
              <Highlighter className="h-4 w-4" />
              <span className="hidden sm:inline">Highlights</span>
            </TabsTrigger>
            <TabsTrigger value="definitions" className="gap-2">
              <BookMarked className="h-4 w-4" />
              <span className="hidden sm:inline">Definitions</span>
            </TabsTrigger>
            <TabsTrigger value="exam" className="gap-2">
              <GraduationCap className="h-4 w-4" />
              <span className="hidden sm:inline">Exam Tips</span>
            </TabsTrigger>
            <TabsTrigger value="review" className="gap-2">
              <List className="h-4 w-4" />
              <span className="hidden sm:inline">Quick Review</span>
            </TabsTrigger>
          </TabsList>

          {/* Sections Tab */}
          <TabsContent value="sections" className="mt-6 space-y-4">
            {(filteredSections || revisionNotes.sections).map((section, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.1 }}
              >
                <Card className="overflow-hidden">
                  <button
                    onClick={() => toggleSection(idx)}
                    className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors text-left"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-sm">
                        {idx + 1}
                      </div>
                      <h3 className="font-semibold">{section.heading}</h3>
                    </div>
                    {expandedSections.has(idx) ? (
                      <ChevronDown className="h-5 w-5 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-5 w-5 text-muted-foreground" />
                    )}
                  </button>
                  <AnimatePresence>
                    {expandedSections.has(idx) && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                      >
                        <CardContent className="pt-0 pb-4 space-y-4">
                          <ChatMarkdown content={section.content} className="text-muted-foreground" />

                          {section.keyPoints.length > 0 && (
                            <div className="bg-primary/5 rounded-lg p-4">
                              <h4 className="text-sm font-semibold text-primary mb-2 flex items-center gap-2">
                                <Star className="h-4 w-4" />
                                Key Points
                              </h4>
                              <ul className="space-y-2">
                                {section.keyPoints.map((point, i) => (
                                  <li key={i} className="flex items-start gap-2 text-sm">
                                    <span className="text-primary mt-1">•</span>
                                    <span>{point}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {section.tips && (
                            <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-4">
                              <h4 className="text-sm font-semibold text-amber-700 dark:text-amber-400 mb-2 flex items-center gap-2">
                                <Lightbulb className="h-4 w-4" />
                                Study Tip
                              </h4>
                              <p className="text-sm text-amber-800 dark:text-amber-300">{section.tips}</p>
                            </div>
                          )}
                        </CardContent>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </Card>
              </motion.div>
            ))}
          </TabsContent>

          {/* Highlights Tab */}
          <TabsContent value="highlights" className="mt-6">
            <Card className="border-yellow-200 dark:border-yellow-800 bg-yellow-50/50 dark:bg-yellow-900/10">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-yellow-700 dark:text-yellow-400">
                  <Highlighter className="h-5 w-5" />
                  Key Highlights
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  {revisionNotes.highlights.map((highlight, idx) => (
                    <motion.li
                      key={idx}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.1 }}
                      className="flex items-start gap-3 p-3 bg-white dark:bg-background rounded-lg border border-yellow-200 dark:border-yellow-800"
                    >
                      <span className="flex-shrink-0 w-6 h-6 rounded-full bg-yellow-400 dark:bg-yellow-600 text-white flex items-center justify-center text-xs font-bold">
                        {idx + 1}
                      </span>
                      <span className="font-medium">{highlight}</span>
                    </motion.li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Definitions Tab */}
          <TabsContent value="definitions" className="mt-6">
            <Card className="border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-900/10">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-green-700 dark:text-green-400">
                  <BookMarked className="h-5 w-5" />
                  Key Definitions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3">
                  {revisionNotes.definitions.map((def, idx) => (
                    <motion.div
                      key={idx}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.1 }}
                      className="p-4 bg-white dark:bg-background rounded-lg border border-green-200 dark:border-green-800"
                    >
                      <h4 className="font-bold text-green-700 dark:text-green-400">{def.term}</h4>
                      <p className="text-sm text-muted-foreground mt-1">{def.definition}</p>
                    </motion.div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Exam Tips Tab */}
          <TabsContent value="exam" className="mt-6">
            <Card className="border-purple-200 dark:border-purple-800 bg-purple-50/50 dark:bg-purple-900/10">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-purple-700 dark:text-purple-400">
                  <GraduationCap className="h-5 w-5" />
                  Exam Tips
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  {revisionNotes.examTips.map((tip, idx) => (
                    <motion.li
                      key={idx}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.1 }}
                      className="flex items-start gap-3 p-3 bg-white dark:bg-background rounded-lg border border-purple-200 dark:border-purple-800"
                    >
                      <Lightbulb className="h-5 w-5 text-purple-500 flex-shrink-0 mt-0.5" />
                      <span>{tip}</span>
                    </motion.li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Quick Review Tab */}
          <TabsContent value="review" className="mt-6">
            <Card className="border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-900/10">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-blue-700 dark:text-blue-400">
                  <List className="h-5 w-5" />
                  Quick Review Checklist
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {revisionNotes.quickReview.map((item, idx) => (
                    <motion.li
                      key={idx}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: idx * 0.05 }}
                      className="flex items-center gap-3 p-2"
                    >
                      <input type="checkbox" className="h-4 w-4 rounded border-blue-300" />
                      <span className="text-sm">{item}</span>
                    </motion.li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Hidden print content */}
        <div ref={printRef} className="hidden">
          <h1>{revisionNotes.title}</h1>
          <div className="summary">
            <p>{revisionNotes.summary}</p>
          </div>

          {revisionNotes.sections.map((section, idx) => (
            <div key={idx} className="section">
              <h2>{section.heading}</h2>
              <p>{section.content}</p>
              {section.keyPoints.length > 0 && (
                <div className="key-points">
                  <h3>Key Points:</h3>
                  <ul>
                    {section.keyPoints.map((point, i) => (
                      <li key={i}>{point}</li>
                    ))}
                  </ul>
                </div>
              )}
              {section.tips && <div className="tip"><strong>Study Tip:</strong> {section.tips}</div>}
            </div>
          ))}

          <div className="highlights">
            <h2>Key Highlights</h2>
            <ul>
              {revisionNotes.highlights.map((h, i) => (
                <li key={i}>{h}</li>
              ))}
            </ul>
          </div>

          <div className="definitions">
            <h2>Definitions</h2>
            {revisionNotes.definitions.map((d, i) => (
              <div key={i} className="definition">
                <strong>{d.term}:</strong> {d.definition}
              </div>
            ))}
          </div>

          <div className="exam-tips">
            <h2>Exam Tips</h2>
            <ul>
              {revisionNotes.examTips.map((t, i) => (
                <li key={i}>{t}</li>
              ))}
            </ul>
          </div>

          <div className="quick-review">
            <h2>Quick Review</h2>
            <ul>
              {revisionNotes.quickReview.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    )
  }

  // Configuration / Generator UI
  return (
    <div className="space-y-6">
      {onBack && (
        <Button variant="outline" size="sm" onClick={onBack} className="gap-2 bg-transparent">
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Generator Panel */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                Generate Revision Notes
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Input Mode Tabs */}
              <Tabs value={inputMode} onValueChange={(v) => setInputMode(v as "pdf" | "text")}>
                <TabsList className="grid grid-cols-2 w-full">
                  <TabsTrigger value="pdf" className="gap-2">
                    <Upload className="h-4 w-4" />
                    Upload PDF
                  </TabsTrigger>
                  <TabsTrigger value="text" className="gap-2">
                    <Type className="h-4 w-4" />
                    Paste Text
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="pdf" className="mt-4">
                  <PDFUpload
                    onTextExtracted={(text, filename) => {
                      setExtractedText(text)
                      if (!topic && filename) {
                        setTopic(filename.replace(".pdf", ""))
                      }
                    }}
                    disabled={loading}
                  />
                  {extractedText && (
                    <p className="text-sm text-muted-foreground mt-2">
                      PDF loaded: {extractedText.length.toLocaleString()} characters
                    </p>
                  )}
                </TabsContent>

                <TabsContent value="text" className="mt-4">
                  <Textarea
                    placeholder="Paste your study material, lecture notes, or any text you want to create revision notes from..."
                    value={textInput}
                    onChange={(e) => setTextInput(e.target.value)}
                    className="min-h-[200px] resize-y"
                    disabled={loading}
                  />
                  {textInput && (
                    <p className="text-sm text-muted-foreground mt-2">
                      {textInput.length.toLocaleString()} characters
                    </p>
                  )}
                </TabsContent>
              </Tabs>

              <div>
                <label className="text-sm font-medium mb-2 block">Topic / Title</label>
                <Input
                  placeholder="e.g., Cellular Biology, World War II, Calculus Derivatives"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  disabled={loading}
                />
              </div>

              <Button
                onClick={handleGenerate}
                disabled={loading || (inputMode === "pdf" ? !extractedText : !textInput) || !topic}
                className="w-full gap-2"
              >
                {loading ? (
                  <>
                    <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Generating Notes...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    Generate Revision Notes
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* History Panel */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Clock className="h-4 w-4" />
                Recent Notes
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingHistory ? (
                <div className="text-center py-8 text-muted-foreground">Loading...</div>
              ) : history.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No revision notes yet</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                  {history.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => handleLoadNote(item.id)}
                      className="w-full flex items-center justify-between p-3 rounded-lg border hover:border-primary/40 hover:bg-primary/5 transition-all text-left group"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{item.title}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline" className="text-xs">
                            {item.source_type === "document" ? "PDF" : "Text"}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {new Date(item.created_at).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={(e) => handleDelete(item.id, e)}
                          className="p-1 hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

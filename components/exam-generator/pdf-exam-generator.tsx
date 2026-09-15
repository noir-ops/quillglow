"use client"

import { useState, useEffect } from "react"
import { ChatMarkdown } from "@/components/chat/chat-markdown"
import { motion, AnimatePresence } from "framer-motion"
import {
  FileQuestion,
  Loader2,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  BookOpen,
  ListChecks,
  Lightbulb,
  Copy,
  Check,
  History,
  Trash2,
  Crown,
  AlertCircle,
  FileText,
  Settings,
  RefreshCw,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select" // Added
import { Switch } from "@/components/ui/switch" // Added
import { toast } from "sonner"
import { PDFUpload } from "@/components/flashcards/pdf-upload"
import { cn } from "@/lib/utils"
import Link from "next/link"
import { EssayWriter } from "./essay-writer"

interface MultipleChoiceQuestion {
  question: string
  options: string[]
  correctAnswer: string
  explanation: string
  difficulty?: string // Added
}

interface ShortAnswerQuestion {
  question: string
  sampleAnswer: string
  keyPoints: string[]
  difficulty?: string // Added
}

interface LongAnswerQuestion {
  question: string
  answer_outline: string[]
  key_points: string[]
  marking_guide: string
  difficulty?: string
}

interface ExamResult {
  summary: string
  multipleChoice: MultipleChoiceQuestion[]
  shortAnswer: ShortAnswerQuestion[]
  longAnswer: LongAnswerQuestion[]
  keyExamPoints: string[]
  examId?: string
}

interface SavedExam {
  id: string
  subject: string
  pdf_filename: string | null
  summary: string
  created_at: string
}

interface UsageInfo {
  current: number
  limit: number | null
  isGenius: boolean
}

interface QuestionSettings {
  mcqCount: number
  shortCount: number
  longCount: number
  difficulty: "easy" | "medium" | "hard" | "mixed"
  avoidRepeats: boolean
  shuffleOrder: boolean
}

export function PDFExamGenerator() {
  const [mode, setMode] = useState<"practice" | "essay">("practice")
  const [extractedText, setExtractedText] = useState("")
  const [pdfFileName, setPdfFileName] = useState<string | null>(null)
  const [subject, setSubject] = useState("")
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ExamResult | null>(null)
  const [expandedMC, setExpandedMC] = useState<number[]>([])
  const [expandedSA, setExpandedSA] = useState<number[]>([])
  const [expandedLA, setExpandedLA] = useState<number[]>([])
  const [copied, setCopied] = useState(false)
  const [savedExams, setSavedExams] = useState<SavedExam[]>([])
  const [usage, setUsage] = useState<UsageInfo | null>(null)
  const [showHistory, setShowHistory] = useState(false)
  const [loadingExams, setLoadingExams] = useState(true)
  const [settings, setSettings] = useState<QuestionSettings>({
    mcqCount: 8,
    shortCount: 5,
    longCount: 2,
    difficulty: "mixed",
    avoidRepeats: true,
    shuffleOrder: true,
  })
  const [showSettings, setShowSettings] = useState(false)
  const [previousQuestions, setPreviousQuestions] = useState<string[]>([])

  useEffect(() => {
    fetchExamsAndUsage()
  }, [])

  const fetchExamsAndUsage = async () => {
    try {
      const response = await fetch("/api/pdf/exam-questions")
      if (response.ok) {
        const data = await response.json()
        setSavedExams(data.exams || [])
        setUsage(data.usage)
      }
    } catch (error) {
      console.error("Failed to fetch exams:", error)
    } finally {
      setLoadingExams(false)
    }
  }

  const handlePDFTextExtracted = (text: string, fileName: string) => {
    setExtractedText(text)
    setPdfFileName(fileName)
    setResult(null)
  }

  const handleGenerate = async (isRegenerate = false) => {
    if (!extractedText.trim()) {
      toast.error("Please upload a PDF first")
      return
    }

    if (settings.mcqCount === 0 && settings.shortCount === 0 && settings.longCount === 0) {
      toast.error("Please select at least one question type")
      return
    }

    if (usage && !usage.isGenius && usage.limit && usage.current >= usage.limit) {
      toast.error("You've reached your monthly limit. Upgrade to Genius for unlimited access!")
      return
    }

    setLoading(true)

    try {
      const generationId = crypto.randomUUID()
      const seed = Date.now()

      const prevQuestionsToAvoid =
        settings.avoidRepeats && result
          ? [
              ...(result.multipleChoice?.map((q) => q.question) || []),
              ...(result.shortAnswer?.map((q) => q.question) || []),
              ...(result.longAnswer?.map((q) => q.question) || []),
            ]
          : []

      const response = await fetch("/api/pdf/exam-questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: extractedText,
          subject,
          pdfFileName,
          settings,
          generationId,
          seed,
          previousQuestions: prevQuestionsToAvoid,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        if (data.error === "limit_reached") {
          toast.error(data.message)
          return
        }
        if (data.error === "invalid_json" && !isRegenerate) {
          toast.info("Retrying generation...")
          await new Promise((resolve) => setTimeout(resolve, 1000))
          return handleGenerate(true)
        }
        throw new Error(data.error || "Failed to generate exam questions")
      }

      if (data.multipleChoice || data.shortAnswer || data.longAnswer) {
        const allQuestions = [
          ...(data.multipleChoice?.map((q: MultipleChoiceQuestion) => q.question) || []),
          ...(data.shortAnswer?.map((q: ShortAnswerQuestion) => q.question) || []),
          ...(data.longAnswer?.map((q: LongAnswerQuestion) => q.question) || []),
        ]
        setPreviousQuestions(allQuestions)
      }

      setResult(data)
      toast.success(isRegenerate ? "Questions regenerated!" : "Exam questions generated and saved!")
      // Refresh exams list and usage
      fetchExamsAndUsage()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to generate exam questions")
    } finally {
      setLoading(false)
    }
  }

  const loadSavedExam = async (examId: string) => {
    try {
      const response = await fetch(`/api/pdf/exam-questions?id=${examId}`)
      if (response.ok) {
        const exam = await response.json()
        setResult({
          summary: exam.summary,
          multipleChoice: exam.multiple_choice,
          shortAnswer: exam.short_answer,
          longAnswer: exam.long_answer, // Added
          keyExamPoints: exam.key_exam_points,
          examId: exam.id,
        })
        setShowHistory(false)
        toast.success("Exam loaded!")
      }
    } catch (error) {
      toast.error("Failed to load exam")
    }
  }

  const deleteExam = async (examId: string) => {
    try {
      const response = await fetch(`/api/pdf/exam-questions?id=${examId}`, {
        method: "DELETE",
      })
      if (response.ok) {
        setSavedExams((prev) => prev.filter((e) => e.id !== examId))
        if (result?.examId === examId) {
          setResult(null)
        }
        toast.success("Exam deleted!")
      }
    } catch (error) {
      toast.error("Failed to delete exam")
    }
  }

  const toggleMC = (index: number) => {
    setExpandedMC((prev) => (prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index]))
  }

  const toggleSA = (index: number) => {
    setExpandedSA((prev) => (prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index]))
  }

  const toggleLA = (index: number) => {
    setExpandedLA((prev) => (prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index]))
  }

  const copyAllQuestions = () => {
    if (!result) return

    let text = "EXAM QUESTIONS\n\n"

    if (result.multipleChoice?.length > 0) {
      text += "=== MULTIPLE CHOICE ===\n\n"
      result.multipleChoice.forEach((q, i) => {
        text += `${i + 1}. ${q.question}\n`
        q.options.forEach((opt) => (text += `   ${opt}\n`))
        text += `   Answer: ${q.correctAnswer}\n\n`
      })
    }

    if (result.shortAnswer?.length > 0) {
      text += "\n=== SHORT ANSWER ===\n\n"
      result.shortAnswer.forEach((q, i) => {
        text += `${i + 1}. ${q.question}\n`
        text += `   Sample Answer: ${q.sampleAnswer}\n\n`
      })
    }

    if (result.longAnswer?.length > 0) {
      text += "\n=== LONG ANSWER / ESSAY ===\n\n"
      result.longAnswer.forEach((q, i) => {
        text += `${i + 1}. ${q.question}\n\n`
      })
    }

    navigator.clipboard.writeText(text)
    setCopied(true)
    toast.success("Questions copied to clipboard!")
    setTimeout(() => setCopied(false), 2000)
  }

  const totalQuestions = settings.mcqCount + settings.shortCount + settings.longCount

  // If essay mode is selected, show essay writer
  if (mode === "essay") {
    return <EssayWriter onBack={() => setMode("practice")} />
  }

  return (
    <div className="space-y-6">
      {/* Mode Selector */}
      <Card className="border-2 border-primary/20">
        <CardContent className="p-4">
          {/* Mock MCQ Exam moved out to its own page (/mock-exam) — it builds
              from syllabus + subject, not an uploaded document, so it didn't
              belong behind this switcher. */}
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant={mode === "practice" ? "default" : "outline"}
              onClick={() => setMode("practice")}
              className="flex-1"
            >
              Practice Mode
            </Button>
            <Button
              variant={mode === "essay" ? "default" : "outline"}
              onClick={() => setMode("essay")}
              className="flex-1 bg-transparent"
            >
              Essay Writing
            </Button>
          </div>
          <p className="text-xs text-muted-foreground text-center mt-3">
            {mode === "practice"
              ? "Generate practice questions with detailed answers and explanations"
              : "Practice essay writing with AI-powered evaluation and detailed feedback"}
          </p>
        </CardContent>
      </Card>

      {usage && (
        <Card
          className={cn(
            "border-2",
            usage.isGenius ? "border-amber-500/30 bg-gradient-to-r from-amber-500/5 to-orange-500/5" : "",
          )}
        >
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                {usage.isGenius ? (
                  <>
                    <div className="h-10 w-10 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 flex items-center justify-center">
                      <Crown className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <p className="font-semibold text-amber-600 dark:text-amber-400">Genius Plan</p>
                      <p className="text-sm text-muted-foreground">Unlimited exam generations</p>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <FileQuestion className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <p className="font-medium text-sm">Monthly Usage</p>
                        <p className="text-sm text-muted-foreground">
                          {usage.current} / {usage.limit}
                        </p>
                      </div>
                      <Progress value={(usage.current / (usage.limit || 10)) * 100} className="h-2" />
                    </div>
                  </>
                )}
              </div>
              {!usage.isGenius && (
                <Button
                  asChild
                  size="sm"
                  className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600"
                >
                  <Link href="/upgrade">
                    <Crown className="h-4 w-4 mr-2" />
                    Upgrade
                  </Link>
                </Button>
              )}
            </div>
            {!usage.isGenius && usage.current >= (usage.limit || 10) && (
              <div className="mt-3 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-red-600 dark:text-red-400">
                  You've reached your monthly limit. Upgrade to Genius for unlimited exam generations!
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <div className="flex items-center justify-between">
        <Button variant="outline" size="sm" onClick={() => setShowHistory(!showHistory)} className="gap-2">
          <History className="h-4 w-4" />
          {showHistory ? "Hide History" : "View History"}
          {savedExams.length > 0 && (
            <Badge variant="secondary" className="ml-1">
              {savedExams.length}
            </Badge>
          )}
        </Button>
      </div>

      <AnimatePresence>
        {showHistory && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
          >
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <History className="h-5 w-5" />
                  Saved Exams
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loadingExams ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : savedExams.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">No saved exams yet</p>
                ) : (
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {savedExams.map((exam) => (
                      <div
                        key={exam.id}
                        className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                      >
                        <button onClick={() => loadSavedExam(exam.id)} className="flex-1 text-left">
                          <p className="font-medium text-sm">{exam.subject || "General"}</p>
                          <p className="text-xs text-muted-foreground line-clamp-1">
                            {exam.pdf_filename || exam.summary?.substring(0, 50) + "..."}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {new Date(exam.created_at).toLocaleDateString()}
                          </p>
                        </button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                          onClick={() => deleteExam(exam.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Upload Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileQuestion className="h-5 w-5 text-primary" />
            AI Exam Generator (PDF)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <PDFUpload onTextExtracted={handlePDFTextExtracted} disabled={loading} />

          {pdfFileName && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
                <CheckCircle className="h-4 w-4" />
                PDF loaded: {pdfFileName}
              </div>

              <div className="space-y-2">
                <Label htmlFor="subject">Subject (optional)</Label>
                <Input
                  id="subject"
                  placeholder="e.g., Biology, History, Physics..."
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  disabled={loading}
                />
              </div>

              <Collapsible open={showSettings} onOpenChange={setShowSettings}>
                <Card className="border-2 border-dashed">
                  <CollapsibleTrigger className="w-full">
                    <CardHeader className="pb-3 cursor-pointer hover:bg-muted/50 transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Settings className="h-4 w-4 text-primary" />
                          <span className="text-sm font-medium">Question Settings</span>
                          <Badge variant="secondary" className="text-xs">
                            {totalQuestions} questions
                          </Badge>
                        </div>
                        {showSettings ? (
                          <ChevronUp className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                    </CardHeader>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <CardContent className="pt-0 space-y-4">
                      {/* Question Count Controls */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="mcq-count" className="text-sm">
                            Multiple Choice
                          </Label>
                          <div className="flex items-center gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              className="h-8 w-8 bg-transparent"
                              onClick={() => setSettings((s) => ({ ...s, mcqCount: Math.max(0, s.mcqCount - 1) }))}
                              disabled={settings.mcqCount === 0}
                            >
                              -
                            </Button>
                            <Input
                              id="mcq-count"
                              type="number"
                              min="0"
                              max="50"
                              value={settings.mcqCount}
                              onChange={(e) =>
                                setSettings((s) => ({
                                  ...s,
                                  mcqCount: Math.max(0, Math.min(50, Number.parseInt(e.target.value) || 0)),
                                }))
                              }
                              className="h-8 text-center"
                            />
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              className="h-8 w-8 bg-transparent"
                              onClick={() => setSettings((s) => ({ ...s, mcqCount: Math.min(50, s.mcqCount + 1) }))}
                              disabled={settings.mcqCount >= 50}
                            >
                              +
                            </Button>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="short-count" className="text-sm">
                            Short Answer
                          </Label>
                          <div className="flex items-center gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              className="h-8 w-8 bg-transparent"
                              onClick={() => setSettings((s) => ({ ...s, shortCount: Math.max(0, s.shortCount - 1) }))}
                              disabled={settings.shortCount === 0}
                            >
                              -
                            </Button>
                            <Input
                              id="short-count"
                              type="number"
                              min="0"
                              max="50"
                              value={settings.shortCount}
                              onChange={(e) =>
                                setSettings((s) => ({
                                  ...s,
                                  shortCount: Math.max(0, Math.min(50, Number.parseInt(e.target.value) || 0)),
                                }))
                              }
                              className="h-8 text-center"
                            />
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              className="h-8 w-8 bg-transparent"
                              onClick={() => setSettings((s) => ({ ...s, shortCount: Math.min(50, s.shortCount + 1) }))}
                              disabled={settings.shortCount >= 50}
                            >
                              +
                            </Button>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="long-count" className="text-sm">
                            Long Answer / Essay
                          </Label>
                          <div className="flex items-center gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              className="h-8 w-8 bg-transparent"
                              onClick={() => setSettings((s) => ({ ...s, longCount: Math.max(0, s.longCount - 1) }))}
                              disabled={settings.longCount === 0}
                            >
                              -
                            </Button>
                            <Input
                              id="long-count"
                              type="number"
                              min="0"
                              max="20"
                              value={settings.longCount}
                              onChange={(e) =>
                                setSettings((s) => ({
                                  ...s,
                                  longCount: Math.max(0, Math.min(20, Number.parseInt(e.target.value) || 0)),
                                }))
                              }
                              className="h-8 text-center"
                            />
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              className="h-8 w-8 bg-transparent"
                              onClick={() => setSettings((s) => ({ ...s, longCount: Math.min(20, s.longCount + 1) }))}
                              disabled={settings.longCount >= 20}
                            >
                              +
                            </Button>
                          </div>
                        </div>
                      </div>

                      {/* Difficulty Selection */}
                      <div className="space-y-2">
                        <Label htmlFor="difficulty" className="text-sm">
                          Difficulty Level
                        </Label>
                        <Select
                          value={settings.difficulty}
                          onValueChange={(value: any) => setSettings((s) => ({ ...s, difficulty: value }))}
                        >
                          <SelectTrigger id="difficulty">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="easy">Easy - Recall & Basic</SelectItem>
                            <SelectItem value="medium">Medium - Applied Understanding</SelectItem>
                            <SelectItem value="hard">Hard - Multi-step Reasoning</SelectItem>
                            <SelectItem value="mixed">Mixed - Balanced Distribution</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Toggle Options */}
                      <div className="space-y-3 pt-2">
                        <div className="flex items-center justify-between">
                          <div className="space-y-0.5">
                            <Label htmlFor="avoid-repeats" className="text-sm font-medium cursor-pointer">
                              Avoid repeats from previous generations
                            </Label>
                            <p className="text-xs text-muted-foreground">Generate new question ideas on regenerate</p>
                          </div>
                          <Switch
                            id="avoid-repeats"
                            checked={settings.avoidRepeats}
                            onCheckedChange={(checked) => setSettings((s) => ({ ...s, avoidRepeats: checked }))}
                          />
                        </div>

                        <div className="flex items-center justify-between">
                          <div className="space-y-0.5">
                            <Label htmlFor="shuffle-order" className="text-sm font-medium cursor-pointer">
                              Shuffle question order
                            </Label>
                            <p className="text-xs text-muted-foreground">Randomize the sequence of questions</p>
                          </div>
                          <Switch
                            id="shuffle-order"
                            checked={settings.shuffleOrder}
                            onCheckedChange={(checked) => setSettings((s) => ({ ...s, shuffleOrder: checked }))}
                          />
                        </div>
                      </div>

                      {/* Validation hint */}
                      {totalQuestions === 0 && (
                        <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
                          <AlertCircle className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
                          <p className="text-sm text-amber-600 dark:text-amber-400">
                            Select at least one question type to generate
                          </p>
                        </div>
                      )}
                    </CardContent>
                  </CollapsibleContent>
                </Card>
              </Collapsible>

              {/* Generate / Regenerate Buttons */}
              <div className="flex gap-2">
                <Button
                  className="flex-1"
                  onClick={() => handleGenerate(false)}
                  disabled={
                    loading ||
                    !extractedText.trim() ||
                    totalQuestions === 0 ||
                    (usage && !usage.isGenius && usage.limit !== null && usage.current >= usage.limit)
                  }
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Generating...
                    </>
                  ) : result ? (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Regenerate
                    </>
                  ) : (
                    <>
                      <FileQuestion className="mr-2 h-4 w-4" />
                      Generate
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Results Section */}
      <AnimatePresence>
        {result && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-6"
          >
            {/* Summary Card */}
            <Card className="border-primary/20 bg-primary/5">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Lightbulb className="h-5 w-5 text-primary" />
                  Key Exam Summary
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ChatMarkdown content={result.summary} className="text-muted-foreground" />

                {result.keyExamPoints && result.keyExamPoints.length > 0 && (
                  <div className="mt-4">
                    <p className="text-sm font-medium mb-2">Key Points to Study:</p>
                    <ul className="space-y-1">
                      {result.keyExamPoints.map((point, index) => (
                        <li key={index} className="text-sm text-muted-foreground flex items-start gap-2">
                          <span className="text-primary mt-1">•</span>
                          {point}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Copy All Button */}
            <div className="flex justify-end">
              <Button variant="outline" size="sm" onClick={copyAllQuestions}>
                {copied ? (
                  <>
                    <Check className="mr-2 h-4 w-4" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="mr-2 h-4 w-4" />
                    Copy All Questions
                  </>
                )}
              </Button>
            </div>

            {/* Multiple Choice Questions */}
            {result.multipleChoice && result.multipleChoice.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <ListChecks className="h-5 w-5 text-blue-500" />
                    Multiple Choice Questions
                    <Badge variant="secondary" className="ml-auto">
                      {result.multipleChoice.length}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {result.multipleChoice.map((q, index) => (
                    <Collapsible key={index} open={expandedMC.includes(index)} onOpenChange={() => toggleMC(index)}>
                      <div className="border rounded-lg overflow-hidden">
                        <CollapsibleTrigger className="w-full p-4 text-left hover:bg-muted/50 transition-colors">
                          <div className="flex items-start gap-3">
                            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400 flex items-center justify-center text-sm font-medium">
                              {index + 1}
                            </span>
                            <p className="text-sm font-medium flex-1 text-left">{q.question}</p>
                            {expandedMC.includes(index) ? (
                              <ChevronUp className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                            ) : (
                              <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                            )}
                          </div>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <div className="px-4 pb-4 pt-0 space-y-3">
                            <div className="space-y-2 ml-9">
                              {q.options.map((option, optIndex) => (
                                <div
                                  key={optIndex}
                                  className={cn(
                                    "p-2 rounded text-sm",
                                    option.startsWith(q.correctAnswer)
                                      ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 font-medium"
                                      : "bg-muted/50",
                                  )}
                                >
                                  {option}
                                </div>
                              ))}
                            </div>
                            <div className="ml-9 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                              <p className="text-xs font-medium text-blue-600 dark:text-blue-400 mb-1">Explanation:</p>
                              <ChatMarkdown content={q.explanation} className="text-muted-foreground" />
                            </div>
                          </div>
                        </CollapsibleContent>
                      </div>
                    </Collapsible>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Short Answer Questions */}
            {result.shortAnswer && result.shortAnswer.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <BookOpen className="h-5 w-5 text-purple-500" />
                    Short Answer Questions
                    <Badge variant="secondary" className="ml-auto">
                      {result.shortAnswer.length}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {result.shortAnswer.map((q, index) => (
                    <Collapsible key={index} open={expandedSA.includes(index)} onOpenChange={() => toggleSA(index)}>
                      <div className="border rounded-lg overflow-hidden">
                        <CollapsibleTrigger className="w-full p-4 text-left hover:bg-muted/50 transition-colors">
                          <div className="flex items-start gap-3">
                            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-purple-100 dark:bg-purple-900 text-purple-600 dark:text-purple-400 flex items-center justify-center text-sm font-medium">
                              {index + 1}
                            </span>
                            <p className="text-sm font-medium flex-1 text-left">{q.question}</p>
                            {expandedSA.includes(index) ? (
                              <ChevronUp className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                            ) : (
                              <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                            )}
                          </div>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <div className="px-4 pb-4 pt-0 space-y-3 ml-9">
                            <div className="p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                              <p className="text-xs font-medium text-purple-600 dark:text-purple-400 mb-1">
                                Sample Answer:
                              </p>
                              <p className="text-sm text-muted-foreground">{q.sampleAnswer}</p>
                            </div>
                            {q.keyPoints && q.keyPoints.length > 0 && (
                              <div>
                                <p className="text-xs font-medium text-muted-foreground mb-2">Key Points to Include:</p>
                                <ul className="space-y-1">
                                  {q.keyPoints.map((point, pointIndex) => (
                                    <li
                                      key={pointIndex}
                                      className="text-sm text-muted-foreground flex items-start gap-2"
                                    >
                                      <CheckCircle className="h-3 w-3 text-green-500 mt-1 flex-shrink-0" />
                                      {point}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        </CollapsibleContent>
                      </div>
                    </Collapsible>
                  ))}
                </CardContent>
              </Card>
            )}

            {result.longAnswer && result.longAnswer.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <FileText className="h-5 w-5 text-emerald-500" />
                    Long Answer / Essay Questions
                    <Badge variant="secondary" className="ml-auto">
                      {result.longAnswer.length}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {result.longAnswer.map((q, index) => (
                    <Collapsible key={index} open={expandedLA.includes(index)} onOpenChange={() => toggleLA(index)}>
                      <div className="border rounded-lg overflow-hidden">
                        <CollapsibleTrigger className="w-full p-4 text-left hover:bg-muted/50 transition-colors">
                          <div className="flex items-start gap-3">
                            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-emerald-100 dark:bg-emerald-900 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-sm font-medium">
                              {index + 1}
                            </span>
                            <p className="text-sm font-medium flex-1 text-left">{q.question}</p>
                            {expandedLA.includes(index) ? (
                              <ChevronUp className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                            ) : (
                              <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                            )}
                          </div>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <div className="px-4 pb-4 pt-0 space-y-3 ml-9">
                            {q.answer_outline && q.answer_outline.length > 0 && (
                              <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg">
                                <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400 mb-2">
                                  Answer Outline:
                                </p>
                                <ol className="space-y-1.5 list-decimal list-inside">
                                  {q.answer_outline.map((point, pointIndex) => (
                                    <li key={pointIndex} className="text-sm text-muted-foreground">
                                      {point}
                                    </li>
                                  ))}
                                </ol>
                              </div>
                            )}
                            {q.key_points && q.key_points.length > 0 && (
                              <div>
                                <p className="text-xs font-medium text-muted-foreground mb-2">Key Points to Cover:</p>
                                <ul className="space-y-1">
                                  {q.key_points.map((point, pointIndex) => (
                                    <li
                                      key={pointIndex}
                                      className="text-sm text-muted-foreground flex items-start gap-2"
                                    >
                                      <CheckCircle className="h-3 w-3 text-green-500 mt-1 flex-shrink-0" />
                                      {point}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            {q.marking_guide && (
                              <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
                                <p className="text-xs font-medium text-amber-600 dark:text-amber-400 mb-1">
                                  Marking Guide:
                                </p>
                                <p className="text-sm text-muted-foreground">{q.marking_guide}</p>
                              </div>
                            )}
                          </div>
                        </CollapsibleContent>
                      </div>
                    </Collapsible>
                  ))}
                </CardContent>
              </Card>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

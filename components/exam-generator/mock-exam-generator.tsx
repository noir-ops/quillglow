"use client"

import { useState, useEffect } from "react"
import { ChatMarkdown } from "@/components/chat/chat-markdown"
import { motion } from "framer-motion"
import { Clock, Target, FileQuestion, Loader2, History, ChevronRight, CheckCircle, XCircle, ArrowLeft, RotateCcw, Trophy, Eye, TrendingUp, TrendingDown, Minus, Trash2 } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { PDFUpload } from "@/components/flashcards/pdf-upload"
import { MockExamInterface } from "./mock-exam-interface"

interface MockExamGeneratorProps {
  /** Only supplied when embedded elsewhere; omitted on the standalone page. */
  onBack?: () => void
}

interface MockExamData {
  attemptId: string
  questions: Array<{
    id: number
    question: string
    options: string[]
    difficulty?: string
  }>
  totalQuestions: number
  timeLimit?: number
}

interface ExamAttempt {
  id: string
  total_questions: number
  difficulty: string
  score_percentage: number
  correct_answers: number
  time_taken_seconds: number
  created_at: string
  status: string
}

interface AttemptDetail {
  id: string
  questions: Array<{
    question: string
    options: string[]
    correctAnswer: string
    explanation: string
    difficulty?: string
  }>
  user_answers: string[]
  total_questions: number
  correct_answers: number
  score_percentage: number
  difficulty: string
  time_taken_seconds: number
  time_limit_minutes: number | null
  created_at: string
}

export function MockExamGenerator({ onBack }: MockExamGeneratorProps) {
  const [extractedText, setExtractedText] = useState("")
  const [pdfFileName, setPdfFileName] = useState<string | null>(null)
  const [questionCount, setQuestionCount] = useState(20)
  const [difficulty, setDifficulty] = useState<"easy" | "medium" | "hard" | "mixed">("mixed")
  const [timeLimit, setTimeLimit] = useState(30) // minutes
  const [loading, setLoading] = useState(false)
  const [mockExamData, setMockExamData] = useState<MockExamData | null>(null)
  const [attempts, setAttempts] = useState<ExamAttempt[]>([])
  const [deletingAttemptId, setDeletingAttemptId] = useState<string | null>(null)
  // Removed: showHistory / setShowHistory. History is always visible now, no
  // toggle needed.
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [selectedAttempt, setSelectedAttempt] = useState<AttemptDetail | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [retakeOriginalQuestions, setRetakeOriginalQuestions] = useState<AttemptDetail["questions"] | null>(null)

  // Source of the questions. "syllabus" generates straight from the learner's
  // selected curriculum; "document" is the original upload-a-PDF flow.
  const [source, setSource] = useState<"syllabus" | "document">("document")
  const [mySubjects, setMySubjects] = useState<{ syllabus: string; subject: string }[]>([])
  const [selectedSubject, setSelectedSubject] = useState("")
  const [topicFocus, setTopicFocus] = useState("")

  // History is always visible now (previously fetched only when the Show
  // History toggle was first opened) — needs to load on mount instead.
  useEffect(() => {
    fetchHistory()
  }, [])

  useEffect(() => {
    fetch("/api/syllabus/subjects")
      .then((r) => r.json())
      .then((d) => {
        const chosen = (d.subjects ?? []).filter((x: any) => x.selected)
        setMySubjects(chosen.map((x: any) => ({ syllabus: x.syllabus, subject: x.subject })))
        // Default to syllabus generation when the learner has subjects set —
        // that's the faster path and needs no upload.
        if (chosen.length > 0) {
          setSource("syllabus")
          setSelectedSubject(chosen[0].subject)
        }
      })
      .catch(() => {})
  }, [])

  const handlePDFTextExtracted = (text: string, fileName: string) => {
    setExtractedText(text)
    setPdfFileName(fileName)
  }

  const fetchHistory = async () => {
    setLoadingHistory(true)
    try {
      const response = await fetch("/api/mock-exam")
      if (response.ok) {
        const data = await response.json()
        setAttempts(data.attempts || [])
      }
    } catch (error) {
      console.error("Failed to fetch history:", error)
    } finally {
      setLoadingHistory(false)
    }
  }

  const deleteAttempt = async (attemptId: string) => {
    if (!confirm("Delete this attempt? This can't be undone.")) return
    setDeletingAttemptId(attemptId)
    try {
      // Same table as the untimed-review list on Practice Exams — this
      // endpoint's DELETE isn't tied to how the row was originally listed.
      const res = await fetch(`/api/mock-exam/saved?id=${attemptId}`, { method: "DELETE" })
      if (!res.ok) throw new Error()
      setAttempts((prev) => prev.filter((a) => a.id !== attemptId))
      if (selectedAttempt?.id === attemptId) setSelectedAttempt(null)
    } catch {
      toast.error("Could not delete that attempt.")
    } finally {
      setDeletingAttemptId(null)
    }
  }

  const fetchAttemptDetail = async (attemptId: string) => {
    setLoadingDetail(true)
    try {
      const response = await fetch(`/api/mock-exam?id=${attemptId}`)
      if (response.ok) {
        const data = await response.json()
        setSelectedAttempt(data)
      } else {
        toast.error("Failed to load exam details")
      }
    } catch (error) {
      console.error("Failed to fetch attempt detail:", error)
      toast.error("Failed to load exam details")
    } finally {
      setLoadingDetail(false)
    }
  }

  const handleRetakeExam = (attempt: AttemptDetail) => {
    // Store the original questions (with answers) for local grading
    setRetakeOriginalQuestions(attempt.questions)
    // Reuse the same questions but create a fresh exam interface
    setMockExamData({
      attemptId: `retake-${Date.now()}`,
      questions: attempt.questions.map((q, idx) => ({
        id: idx,
        question: q.question,
        options: q.options,
        difficulty: q.difficulty,
      })),
      totalQuestions: attempt.total_questions,
      timeLimit: attempt.time_limit_minutes || undefined,
    })
    setSelectedAttempt(null)
    toast.success("Retaking exam with the same questions. Good luck!")
  }

  const handleGenerateExam = async () => {
    if (source === "document" && !extractedText.trim()) {
      toast.error("Please upload a document first")
      return
    }
    if (source === "syllabus" && !selectedSubject) {
      toast.error("Please choose a subject")
      return
    }

    if (questionCount < 5 || questionCount > 50) {
      toast.error("Question count must be between 5 and 50")
      return
    }

    setLoading(true)

    try {
      const response = await fetch("/api/mock-exam", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          // Only one source is sent; the route decides what to ground on.
          documentText: source === "document" ? extractedText : undefined,
          documentIds: source === "document" && pdfFileName ? [pdfFileName] : [],
          fromSyllabus: source === "syllabus",
          subject: source === "syllabus" ? selectedSubject : undefined,
          syllabus:
            source === "syllabus"
              ? mySubjects.find((m) => m.subject === selectedSubject)?.syllabus
              : undefined,
          topicFocus: source === "syllabus" ? topicFocus.trim() || undefined : undefined,
          questionCount,
          difficulty,
          timeLimit,
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to generate mock exam")
      }

      const data = await response.json()
      setMockExamData(data)
      toast.success("Mock exam generated! Good luck!")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to generate exam")
    } finally {
      setLoading(false)
    }
  }

  const handleExitExam = () => {
    setMockExamData(null)
    setExtractedText("")
    setPdfFileName(null)
    setRetakeOriginalQuestions(null)
    // Refresh history after completing an exam
    fetchHistory()
  }

  const formatTime = (seconds: number) => {
    // Same guard as the exam interface: attempts saved before timeTaken was
    // returned have null/0 here, which otherwise rendered as "NaN:NaN".
    const total = Number(seconds)
    if (!Number.isFinite(total) || total < 0) return "—"

    const hrs = Math.floor(total / 3600)
    const mins = Math.floor((total % 3600) / 60)
    const secs = Math.floor(total % 60)

    return hrs > 0
      ? `${hrs}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
      : `${mins}:${secs.toString().padStart(2, "0")}`
  }

  // If exam is active, show exam interface
  if (mockExamData) {
    return (
      <MockExamInterface
        {...mockExamData}
        onExit={handleExitExam}
        originalQuestions={mockExamData.attemptId.startsWith("retake-") ? retakeOriginalQuestions ?? undefined : undefined}
      />
    )
  }

  // If viewing attempt detail, show the full review
  if (selectedAttempt) {
    const scoreColor =
      selectedAttempt.score_percentage >= 70
        ? "text-green-600 dark:text-green-400"
        : selectedAttempt.score_percentage >= 50
          ? "text-orange-600 dark:text-orange-400"
          : "text-red-600 dark:text-red-400"

    // Find previous attempts of similar difficulty for comparison
    const similarAttempts = attempts.filter(
      (a) => a.difficulty === selectedAttempt.difficulty && a.total_questions === selectedAttempt.total_questions
    )
    const currentIndex = similarAttempts.findIndex((a) => a.id === selectedAttempt.id)
    const previousAttempt = currentIndex < similarAttempts.length - 1 ? similarAttempts[currentIndex + 1] : null

    return (
      <div className="space-y-6">
        {/* Back button and header */}
        <div className="flex items-center justify-between">
          <Button variant="outline" size="sm" onClick={() => setSelectedAttempt(null)} className="gap-2 bg-transparent">
            <ArrowLeft className="h-4 w-4" />
            Back to History
          </Button>
          <Button
            size="sm"
            onClick={() => handleRetakeExam(selectedAttempt)}
            className="gap-2"
          >
            <RotateCcw className="h-4 w-4" />
            Retake This Exam
          </Button>
        </div>

        {/* Score Summary */}
        <Card className="border-2 border-primary/30">
          <CardContent className="pt-6 pb-6">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
              <div className="flex items-center gap-4">
                <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                  <Trophy className="h-8 w-8 text-primary" />
                </div>
                <div>
                  <h3 className="text-xl font-bold">Exam Review</h3>
                  <p className="text-sm text-muted-foreground">
                    {new Date(selectedAttempt.created_at).toLocaleString()}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="outline" className="capitalize">{selectedAttempt.difficulty}</Badge>
                    <span className="text-xs text-muted-foreground">
                      {selectedAttempt.total_questions} Questions
                    </span>
                  </div>
                </div>
              </div>
              <div className="text-center sm:text-right">
                <p className={`text-5xl font-black ${scoreColor}`}>
                  {selectedAttempt.score_percentage.toFixed(0)}%
                </p>
                <p className="text-sm text-muted-foreground">
                  {selectedAttempt.correct_answers}/{selectedAttempt.total_questions} correct
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Time: {formatTime(selectedAttempt.time_taken_seconds)}
                </p>
              </div>
            </div>

            {/* Score Comparison with previous attempt */}
            {previousAttempt && (
              <div className="mt-6 p-4 bg-muted rounded-xl">
                <p className="text-sm font-medium mb-3 flex items-center gap-2">
                  Compared to Previous Attempt
                </p>
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center">
                    <div className="flex items-center justify-center gap-1 mb-1">
                      {selectedAttempt.score_percentage > previousAttempt.score_percentage ? (
                        <TrendingUp className="h-4 w-4 text-green-500" />
                      ) : selectedAttempt.score_percentage < previousAttempt.score_percentage ? (
                        <TrendingDown className="h-4 w-4 text-red-500" />
                      ) : (
                        <Minus className="h-4 w-4 text-muted-foreground" />
                      )}
                      <span className={`text-lg font-bold ${
                        selectedAttempt.score_percentage > previousAttempt.score_percentage
                          ? "text-green-600 dark:text-green-400"
                          : selectedAttempt.score_percentage < previousAttempt.score_percentage
                            ? "text-red-600 dark:text-red-400"
                            : "text-muted-foreground"
                      }`}>
                        {selectedAttempt.score_percentage > previousAttempt.score_percentage ? "+" : ""}
                        {(selectedAttempt.score_percentage - previousAttempt.score_percentage).toFixed(0)}%
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">Score Change</p>
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-bold">
                      {previousAttempt.score_percentage.toFixed(0)}%
                    </p>
                    <p className="text-xs text-muted-foreground">Previous Score</p>
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-bold">
                      {selectedAttempt.score_percentage.toFixed(0)}%
                    </p>
                    <p className="text-xs text-muted-foreground">This Score</p>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Questions and Answers */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              Questions & Answers
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {selectedAttempt.questions.map((q, idx) => {
              const userAnswer = selectedAttempt.user_answers[idx] || ""
              const isCorrect = userAnswer === q.correctAnswer
              const correctOptionFull = q.options.find((o) => o.startsWith(q.correctAnswer + ")")) || q.correctAnswer
              const userOptionFull = q.options.find((o) => o.startsWith(userAnswer + ")")) || userAnswer || "Not answered"

              return (
                <div
                  key={idx}
                  className={`p-4 rounded-xl border-2 ${
                    isCorrect ? "border-green-200 bg-green-50 dark:border-green-800/50 dark:bg-green-950/20" : "border-red-200 bg-red-50 dark:border-red-800/50 dark:bg-red-950/20"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-start gap-3">
                      <span className="flex-shrink-0 h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold bg-background border-2">
                        {idx + 1}
                      </span>
                      <p className="font-medium text-sm leading-relaxed">{q.question}</p>
                    </div>
                    {isCorrect ? (
                      <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                    ) : (
                      <XCircle className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                    )}
                  </div>

                  {/* Answer options display */}
                  <div className="ml-10 space-y-1.5 mb-3">
                    {q.options.map((option, optIdx) => {
                      // Index-derived, for the same reason as the exam
                      // interface: bare options like "16 g mol-1" all return
                      // "1" from charAt(0), which mislabels which answer the
                      // learner picked and which one was correct.
                      const optionLetter = String.fromCharCode(65 + optIdx)
                      const isUserChoice = optionLetter === userAnswer
                      const isCorrectOption = optionLetter === q.correctAnswer
                      return (
                        <div
                          key={optIdx}
                          className={`px-3 py-2 rounded-lg text-sm ${
                            isCorrectOption
                              ? "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 font-medium"
                              : isUserChoice && !isCorrect
                                ? "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 line-through"
                                : "bg-background/60 text-muted-foreground"
                          }`}
                        >
                          <span className="flex items-center gap-2">
                            {isCorrectOption && <CheckCircle className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />}
                            {isUserChoice && !isCorrect && <XCircle className="h-3.5 w-3.5 text-red-600 dark:text-red-400" />}
                            {option}
                          </span>
                        </div>
                      )
                    })}
                  </div>

                  {/* Your answer vs correct */}
                  <div className="ml-10 flex flex-wrap gap-4 text-xs mb-2">
                    <span className={isCorrect ? "text-green-700 dark:text-green-400" : "text-red-700 dark:text-red-400"}>
                      Your answer: <span className="font-semibold">{userOptionFull}</span>
                    </span>
                    {!isCorrect && (
                      <span className="text-green-700 dark:text-green-400">
                        Correct: <span className="font-semibold">{correctOptionFull}</span>
                      </span>
                    )}
                  </div>

                  {/* Explanation */}
                  {q.explanation && (
                    <div className="ml-10 mt-2 p-3 bg-background/80 rounded-lg border">
                      <p className="text-xs text-muted-foreground mb-0.5 font-medium">Explanation</p>
                      <ChatMarkdown content={q.explanation} />
                    </div>
                  )}
                </div>
              )
            })}
          </CardContent>
        </Card>

        {/* Bottom actions */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center pb-6">
          <Button
            onClick={() => handleRetakeExam(selectedAttempt)}
            className="gap-2"
          >
            <RotateCcw className="h-4 w-4" />
            Retake This Exam
          </Button>
          <Button variant="outline" onClick={() => setSelectedAttempt(null)} className="gap-2 bg-transparent">
            <ArrowLeft className="h-4 w-4" />
            Back to History
          </Button>
        </div>
      </div>
    )
  }

  // Show configuration screen
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Mock MCQ Exam Mode</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Generate a timed exam from your documents with instant grading
          </p>
        </div>
        <div className="flex gap-2">
          {onBack && (
            <Button variant="outline" size="sm" onClick={onBack} className="bg-transparent">
              Back to Practice Mode
            </Button>
          )}
        </div>
      </div>

      {/* Configuration Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileQuestion className="h-5 w-5 text-primary" />
            Configure Your Mock Exam
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Source selector — only shown when the learner has subjects set,
              otherwise the document upload is the only real option. */}
          {mySubjects.length > 0 && (
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant={source === "syllabus" ? "default" : "outline"}
                onClick={() => setSource("syllabus")}
                className={source === "syllabus" ? "" : "bg-transparent"}
              >
                From my syllabus
              </Button>
              <Button
                type="button"
                variant={source === "document" ? "default" : "outline"}
                onClick={() => setSource("document")}
                className={source === "document" ? "" : "bg-transparent"}
              >
                From a document
              </Button>
            </div>
          )}

          {/* Syllabus-based generation */}
          {source === "syllabus" && mySubjects.length > 0 && (
            <div className="space-y-4">
              <div>
                <Label className="mb-2 block">Subject</Label>
                <Select value={selectedSubject} onValueChange={setSelectedSubject}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a subject" />
                  </SelectTrigger>
                  <SelectContent>
                    {mySubjects.map((m) => (
                      <SelectItem key={`${m.syllabus}::${m.subject}`} value={m.subject}>
                        {m.subject} ({m.syllabus})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1.5">
                  Questions follow this syllabus's style and marking conventions.
                </p>
              </div>

              <div>
                <Label className="mb-2 block">
                  Topic focus <span className="text-muted-foreground font-normal">(optional)</span>
                </Label>
                <Input
                  value={topicFocus}
                  onChange={(e) => setTopicFocus(e.target.value)}
                  placeholder="e.g. Photosynthesis, Organic Chemistry"
                  disabled={loading}
                />
                <p className="text-xs text-muted-foreground mt-1.5">
                  Leave blank to cover the whole subject.
                </p>
              </div>
            </div>
          )}

          {/* PDF Upload */}
          <div className={source === "syllabus" && mySubjects.length > 0 ? "hidden" : undefined}>
            <Label className="mb-2 block">Upload Study Document</Label>
            <PDFUpload onTextExtracted={handlePDFTextExtracted} disabled={loading} />
            {pdfFileName && (
              <p className="text-sm text-green-600 dark:text-green-400 mt-2 flex items-center gap-2">
                <FileQuestion className="h-4 w-4" />
                Document loaded: {pdfFileName}
              </p>
            )}
          </div>

          {/* Config + generate. Previously gated on pdfFileName, which meant the
              syllabus path had no visible settings and no Generate button —
              there's no upload in that flow. */}
          {(pdfFileName || (source === "syllabus" && mySubjects.length > 0)) && (
            <>
              {/* Settings Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Question Count */}
                <div className="space-y-2">
                  <Label htmlFor="question-count" className="flex items-center gap-2">
                    <Target className="h-4 w-4" />
                    Number of Questions
                  </Label>
                  <Select value={questionCount.toString()} onValueChange={(v) => setQuestionCount(Number.parseInt(v))}>
                    <SelectTrigger id="question-count">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="10">10 Questions</SelectItem>
                      <SelectItem value="20">20 Questions</SelectItem>
                      <SelectItem value="30">30 Questions</SelectItem>
                      <SelectItem value="40">40 Questions</SelectItem>
                      <SelectItem value="50">50 Questions</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Difficulty */}
                <div className="space-y-2">
                  <Label htmlFor="difficulty">Difficulty Level</Label>
                  <Select value={difficulty} onValueChange={(v: any) => setDifficulty(v)}>
                    <SelectTrigger id="difficulty">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="easy">Easy - Recall</SelectItem>
                      <SelectItem value="medium">Medium - Application</SelectItem>
                      <SelectItem value="hard">Hard - Analysis</SelectItem>
                      <SelectItem value="mixed">Mixed - Balanced</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Time Limit */}
                <div className="space-y-2">
                  <Label htmlFor="time-limit" className="flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    Time Limit (minutes)
                  </Label>
                  <Input
                    id="time-limit"
                    type="number"
                    min={5}
                    max={120}
                    value={timeLimit}
                    onChange={(e) => setTimeLimit(Number.parseInt(e.target.value) || 30)}
                  />
                </div>
              </div>

              {/* Info Box */}
              <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg space-y-2">
                <p className="text-sm font-medium">Exam Overview:</p>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• {questionCount} multiple-choice questions</li>
                  <li>• {timeLimit} minute time limit</li>
                  <li>• Auto-graded with instant results</li>
                  <li>• Detailed explanations provided</li>
                  <li>• Progress saved to history</li>
                </ul>
              </div>

              {/* Generate Button */}
              <Button onClick={handleGenerateExam} disabled={loading || (source === "document" ? !extractedText : !selectedSubject)} className="w-full" size="lg">
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Generating Exam...
                  </>
                ) : (
                  <>
                    <FileQuestion className="mr-2 h-5 w-5" />
                    Start Mock Exam
                  </>
                )}
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      {/* History Section — always visible, moved below Configure. */}
      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <History className="h-5 w-5" />
                Mock Exam History
              </CardTitle>
              <p className="text-xs text-muted-foreground">Click any attempt to review questions, answers, and retake</p>
            </CardHeader>
            <CardContent>
              {loadingHistory ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : attempts.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No exam attempts yet</p>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                  {attempts.map((attempt, idx) => {
                    // Find previous similar attempt for comparison
                    const prevSimilar = attempts.find(
                      (a, i) => i > idx && a.difficulty === attempt.difficulty && a.total_questions === attempt.total_questions
                    )
                    const scoreDiff = prevSimilar
                      ? attempt.score_percentage - prevSimilar.score_percentage
                      : null

                    return (
                      // A nested delete button means this can no longer be a
                      // <button> itself (buttons can't contain buttons) — a
                      // clickable div with the same role/keyboard handling
                      // takes over the row-open behaviour instead.
                      <div
                        key={attempt.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => fetchAttemptDetail(attempt.id)}
                        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && fetchAttemptDetail(attempt.id)}
                        aria-disabled={loadingDetail}
                        className="w-full flex items-center justify-between p-4 rounded-xl border-2 hover:border-primary/40 hover:bg-primary/5 transition-all text-left group cursor-pointer"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1.5">
                            <Badge variant="outline" className="capitalize text-xs">
                              {attempt.difficulty}
                            </Badge>
                            <span className="text-sm font-medium">
                              {attempt.total_questions} Questions
                            </span>
                            {scoreDiff !== null && (
                              <Badge
                                variant="secondary"
                                className={`text-xs ${
                                  scoreDiff > 0
                                    ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                                    : scoreDiff < 0
                                      ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                                      : "bg-muted text-muted-foreground"
                                }`}
                              >
                                {scoreDiff > 0 ? (
                                  <TrendingUp className="h-3 w-3 mr-1" />
                                ) : scoreDiff < 0 ? (
                                  <TrendingDown className="h-3 w-3 mr-1" />
                                ) : (
                                  <Minus className="h-3 w-3 mr-1" />
                                )}
                                {scoreDiff > 0 ? "+" : ""}{scoreDiff.toFixed(0)}%
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {new Date(attempt.created_at).toLocaleString()} | Time: {formatTime(attempt.time_taken_seconds)}
                          </p>
                        </div>
                        <div className="flex items-center gap-3 ml-4">
                          <div className="text-right">
                            <p
                              className={`text-2xl font-bold ${
                                attempt.score_percentage >= 70
                                  ? "text-green-600 dark:text-green-400"
                                  : attempt.score_percentage >= 50
                                    ? "text-orange-600 dark:text-orange-400"
                                    : "text-red-600 dark:text-red-400"
                              }`}
                            >
                              {attempt.score_percentage.toFixed(0)}%
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {attempt.correct_answers}/{attempt.total_questions}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              deleteAttempt(attempt.id)
                            }}
                            disabled={deletingAttemptId === attempt.id}
                            aria-label="Delete this attempt"
                            className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50"
                          >
                            {deletingAttemptId === attempt.id
                              ? <Loader2 className="h-4 w-4 animate-spin" />
                              : <Trash2 className="h-4 w-4" />}
                          </button>
                          <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

    </div>
  )
}

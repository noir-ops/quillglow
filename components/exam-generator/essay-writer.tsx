"use client"

import { useState, useEffect } from "react"
import { ChatMarkdown } from "@/components/chat/chat-markdown"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { PDFUpload } from "@/components/flashcards/pdf-upload"
import {
  FileText,
  Loader2,
  Send,
  CheckCircle,
  TrendingUp,
  BookOpen,
  Eye,
  ArrowLeft,
  History,
  ChevronRight,
  ChevronLeft,
  Hash,
} from "lucide-react"
import { motion } from "framer-motion"

interface EssayAttempt {
  id: string
  question_text: string
  user_answer: string | null
  word_count: number | null
  ai_score: number | null
  feedback_json: {
    topic?: string
    wordLimit?: number
    referenceText?: string
    evaluation?: FeedbackData
  } | null
  created_at: string
  updated_at: string | null
}

interface EssayWriterProps {
  onBack: () => void
}

interface EssayQuestion {
  attemptId: string
  question: string
}

interface EssaySessionData {
  questions: EssayQuestion[]
  topic: string
  wordLimit: number
}

interface FeedbackData {
  score: number
  strengths: string[]
  improvements: string[]
  contentFeedback: string
  structureFeedback: string
  evidenceFeedback: string
  clarityFeedback: string
  suggestions: string
}

interface QuestionResult {
  attemptId: string
  question: string
  essayText: string
  feedback: FeedbackData | null
  wordCount: number
}

export function EssayWriter({ onBack }: EssayWriterProps) {
  const [extractedText, setExtractedText] = useState("")
  const [pdfFileName, setPdfFileName] = useState<string | null>(null)
  const [topic, setTopic] = useState("")
  const [wordLimit, setWordLimit] = useState(500)
  const [questionCount, setQuestionCount] = useState(3)
  const [loading, setLoading] = useState(false)

  // Session state
  const [sessionData, setSessionData] = useState<EssaySessionData | null>(null)
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [essayText, setEssayText] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [wordCount, setWordCount] = useState(0)
  const [results, setResults] = useState<QuestionResult[]>([])
  const [showResults, setShowResults] = useState(false)

  // History state
  const [attempts, setAttempts] = useState<EssayAttempt[]>([])
  const [showHistory, setShowHistory] = useState(false)
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [selectedAttempt, setSelectedAttempt] = useState<any>(null)

  useEffect(() => {
    const words = essayText
      .trim()
      .split(/\s+/)
      .filter((w) => w.length > 0).length
    setWordCount(words)
  }, [essayText])

  const fetchHistory = async () => {
    setLoadingHistory(true)
    try {
      const response = await fetch("/api/essay")
      if (response.ok) {
        const data = await response.json()
        setAttempts(data)
      }
    } catch (error) {
      console.error("Failed to fetch essay history:", error)
    } finally {
      setLoadingHistory(false)
    }
  }

  const fetchAttemptDetail = async (attemptId: string) => {
    try {
      const response = await fetch(`/api/essay?id=${attemptId}`)
      if (response.ok) {
        const data = await response.json()
        setSelectedAttempt(data)
      } else {
        toast.error("Failed to load essay details")
      }
    } catch (error) {
      console.error("Failed to fetch attempt detail:", error)
      toast.error("Failed to load essay details")
    }
  }

  const handleGenerateQuestions = async () => {
    if (!extractedText || !topic) {
      toast.error("Please upload a document and enter a topic")
      return
    }

    setLoading(true)
    try {
      const response = await fetch("/api/essay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentText: extractedText,
          topic,
          wordLimit,
          questionCount,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Unknown error" }))
        throw new Error(errorData.error || "Failed to generate essay questions")
      }

      const data = await response.json()
      setSessionData({
        questions: data.questions,
        topic: data.topic,
        wordLimit: data.wordLimit,
      })
      setCurrentQuestionIndex(0)
      setEssayText("")
      setResults([])
      setShowResults(false)
      toast.success(`${data.questions.length} essay question${data.questions.length > 1 ? "s" : ""} generated!`)
    } catch (error) {
      console.error("Error generating questions:", error)
      toast.error(error instanceof Error ? error.message : "Failed to generate essay questions")
    } finally {
      setLoading(false)
    }
  }

  const handleSubmitEssay = async () => {
    if (!essayText.trim() || !sessionData) {
      toast.error("Please write your essay before submitting")
      return
    }

    const currentQuestion = sessionData.questions[currentQuestionIndex]

    setSubmitting(true)
    try {
      const response = await fetch("/api/essay", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          attemptId: currentQuestion.attemptId,
          essayAnswer: essayText,
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to submit essay")
      }

      const data = await response.json()

      // Store result for this question
      const newResult: QuestionResult = {
        attemptId: currentQuestion.attemptId,
        question: currentQuestion.question,
        essayText: essayText,
        feedback: data.feedback,
        wordCount: data.wordCount,
      }
      setResults((prev) => [...prev, newResult])

      const isLastQuestion = currentQuestionIndex >= sessionData.questions.length - 1

      if (isLastQuestion) {
        setShowResults(true)
        toast.success("All essays evaluated! View your results below.")
      } else {
        toast.success(`Essay ${currentQuestionIndex + 1}/${sessionData.questions.length} evaluated! Moving to next question.`)
        setCurrentQuestionIndex((prev) => prev + 1)
        setEssayText("")
      }

      fetchHistory()
    } catch (error) {
      console.error("Error submitting essay:", error)
      toast.error("Failed to submit essay")
    } finally {
      setSubmitting(false)
    }
  }

  const handleReset = () => {
    setSessionData(null)
    setEssayText("")
    setResults([])
    setShowResults(false)
    setCurrentQuestionIndex(0)
    setExtractedText("")
    setPdfFileName(null)
    setTopic("")
  }

  const averageScore = results.length > 0
    ? Math.round(results.reduce((acc, r) => acc + (r.feedback?.score || 0), 0) / results.length)
    : 0

  // --- DETAIL VIEW ---
  if (selectedAttempt) {
    const meta = selectedAttempt.feedback_json || {}
    const evalData: FeedbackData | null = meta.evaluation || null
    const detailTopic = meta.topic || "Essay"
    const detailWordLimit = meta.wordLimit || 500
    const scoreColor =
      (selectedAttempt.ai_score || 0) >= 80
        ? "text-green-600 dark:text-green-400"
        : (selectedAttempt.ai_score || 0) >= 60
          ? "text-blue-600 dark:text-blue-400"
          : "text-orange-600 dark:text-orange-400"

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Button variant="outline" size="sm" onClick={() => setSelectedAttempt(null)} className="gap-2 bg-transparent">
            <ArrowLeft className="h-4 w-4" />
            Back to History
          </Button>
        </div>

        <Card className="border-2 border-primary/30">
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
              <div>
                <h3 className="text-xl font-bold mb-2">Essay Evaluation</h3>
                <Badge variant="outline" className="mb-2">{detailTopic}</Badge>
                <p className="text-sm text-muted-foreground">
                  {new Date(selectedAttempt.created_at).toLocaleString()}
                </p>
                {selectedAttempt.word_count && (
                  <p className="text-sm text-muted-foreground">
                    Word Count: {selectedAttempt.word_count} / {detailWordLimit}
                  </p>
                )}
              </div>
              {selectedAttempt.ai_score !== null && (
                <div className="text-center">
                  <p className={`text-5xl font-black ${scoreColor}`}>{selectedAttempt.ai_score}</p>
                  <p className="text-sm text-muted-foreground">out of 100</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <BookOpen className="h-5 w-5" />
              Essay Question
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-relaxed">{selectedAttempt.question_text}</p>
          </CardContent>
        </Card>

        {selectedAttempt.user_answer ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Eye className="h-5 w-5" />
                Your Essay
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <p className="whitespace-pre-wrap text-sm leading-relaxed">{selectedAttempt.user_answer}</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-dashed border-2">
            <CardContent className="py-8 text-center text-muted-foreground">
              <p>You haven{"'"}t written an essay for this question yet.</p>
            </CardContent>
          </Card>
        )}

        {evalData && (
          <div className="space-y-4">
            <Card className="border-green-200 dark:border-green-800">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg text-green-700 dark:text-green-400 flex items-center gap-2">
                  <CheckCircle className="h-5 w-5" />
                  Strengths
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {evalData.strengths?.map((strength: string, idx: number) => (
                    <li key={idx} className="flex items-start gap-2 text-sm">
                      <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
                      <span>{strength}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            <Card className="border-orange-200 dark:border-orange-800">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg text-orange-700 dark:text-orange-400 flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Areas for Improvement
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {evalData.improvements?.map((improvement: string, idx: number) => (
                    <li key={idx} className="flex items-start gap-2 text-sm">
                      <TrendingUp className="h-4 w-4 text-orange-600 dark:text-orange-400 mt-0.5 flex-shrink-0" />
                      <span>{improvement}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                { title: "Content & Analysis", content: evalData.contentFeedback },
                { title: "Structure & Organization", content: evalData.structureFeedback },
                { title: "Use of Evidence", content: evalData.evidenceFeedback },
                { title: "Clarity & Grammar", content: evalData.clarityFeedback },
              ].map((section, idx) =>
                section.content ? (
                  <Card key={idx}>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm">{section.title}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ChatMarkdown content={section.content} className="text-muted-foreground" />
                    </CardContent>
                  </Card>
                ) : null,
              )}
            </div>

            {evalData.suggestions && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Suggestions for Next Time</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm leading-relaxed">{evalData.suggestions}</p>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    )
  }

  // --- ALL RESULTS VIEW ---
  if (showResults && results.length > 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold">Essay Results</h2>
          <Button onClick={handleReset} size="sm">
            Write New Essays
          </Button>
        </div>

        {/* Summary Card */}
        <Card className="border-2 border-primary/30">
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
              <div>
                <h3 className="text-xl font-bold mb-1">Session Summary</h3>
                <p className="text-sm text-muted-foreground">{results.length} essay{results.length > 1 ? "s" : ""} evaluated</p>
                <Badge variant="outline" className="mt-2">{sessionData?.topic}</Badge>
              </div>
              <div className="text-center">
                <p
                  className={`text-5xl font-black ${
                    averageScore >= 80
                      ? "text-green-600 dark:text-green-400"
                      : averageScore >= 60
                        ? "text-blue-600 dark:text-blue-400"
                        : "text-orange-600 dark:text-orange-400"
                  }`}
                >
                  {averageScore}
                </p>
                <p className="text-sm text-muted-foreground">average score</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Per-question results */}
        {results.map((result, idx) => {
          const fb = result.feedback
          if (!fb) return null
          const scoreColor =
            fb.score >= 80
              ? "text-green-600 dark:text-green-400"
              : fb.score >= 60
                ? "text-blue-600 dark:text-blue-400"
                : "text-orange-600 dark:text-orange-400"

          return (
            <Card key={result.attemptId} className="overflow-hidden">
              <CardHeader className="bg-muted/30">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center text-sm font-bold bg-primary text-primary-foreground">
                      {idx + 1}
                    </span>
                    <CardTitle className="text-base">Question {idx + 1}</CardTitle>
                  </div>
                  <div className="text-right">
                    <p className={`text-2xl font-bold ${scoreColor}`}>{fb.score}</p>
                    <p className="text-xs text-muted-foreground">{result.wordCount} words</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-4 space-y-4">
                {/* Question */}
                <div className="p-3 bg-muted/50 rounded-lg">
                  <p className="text-xs font-medium text-muted-foreground mb-1">Question</p>
                  <p className="text-sm leading-relaxed">{result.question}</p>
                </div>

                {/* Your Essay (collapsible) */}
                <details className="group">
                  <summary className="cursor-pointer text-sm font-medium flex items-center gap-2 hover:text-primary transition-colors">
                    <Eye className="h-4 w-4" />
                    View Your Essay
                    <ChevronRight className="h-4 w-4 group-open:rotate-90 transition-transform" />
                  </summary>
                  <div className="mt-2 p-3 bg-muted/30 rounded-lg">
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">{result.essayText}</p>
                  </div>
                </details>

                {/* Strengths */}
                <div>
                  <p className="text-sm font-medium text-green-700 dark:text-green-400 mb-2 flex items-center gap-1.5">
                    <CheckCircle className="h-4 w-4" /> Strengths
                  </p>
                  <ul className="space-y-1">
                    {fb.strengths.map((s, sIdx) => (
                      <li key={sIdx} className="flex items-start gap-2 text-sm">
                        <CheckCircle className="h-3.5 w-3.5 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
                        <span>{s}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Improvements */}
                <div>
                  <p className="text-sm font-medium text-orange-700 dark:text-orange-400 mb-2 flex items-center gap-1.5">
                    <TrendingUp className="h-4 w-4" /> Areas for Improvement
                  </p>
                  <ul className="space-y-1">
                    {fb.improvements.map((imp, iIdx) => (
                      <li key={iIdx} className="flex items-start gap-2 text-sm">
                        <TrendingUp className="h-3.5 w-3.5 text-orange-600 dark:text-orange-400 mt-0.5 flex-shrink-0" />
                        <span>{imp}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Suggestions */}
                {fb.suggestions && (
                  <div className="p-3 bg-primary/5 rounded-lg">
                    <p className="text-xs font-medium text-muted-foreground mb-1">Suggestions</p>
                    <p className="text-sm leading-relaxed">{fb.suggestions}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Essay Writing & Evaluation</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Practice essay writing with AI-powered feedback and evaluation
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setShowHistory(!showHistory)
              if (!showHistory && attempts.length === 0) fetchHistory()
            }}
            className="gap-2 bg-transparent"
          >
            <History className="h-4 w-4" />
            {showHistory ? "Hide" : "Show"} History
          </Button>
          <Button variant="outline" size="sm" onClick={onBack} className="bg-transparent">
            Back
          </Button>
        </div>
      </div>

      {/* History Section */}
      {showHistory && (
        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <History className="h-5 w-5" />
                Essay History
              </CardTitle>
              <p className="text-xs text-muted-foreground">Click any essay to review your work and feedback</p>
            </CardHeader>
            <CardContent>
              {loadingHistory ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : attempts.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No essays yet</p>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                  {attempts.map((attempt) => {
                    const isCompleted = !!attempt.user_answer && !!attempt.ai_score
                    const attemptTopic = attempt.feedback_json?.topic || "Essay"
                    return (
                      <button
                        key={attempt.id}
                        onClick={() => fetchAttemptDetail(attempt.id)}
                        className="w-full flex items-center justify-between p-4 rounded-xl border-2 hover:border-primary/40 hover:bg-primary/5 transition-all text-left group cursor-pointer"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1.5">
                            <Badge variant="outline" className="text-xs">
                              {attemptTopic}
                            </Badge>
                            <Badge
                              variant="secondary"
                              className={`text-xs ${
                                isCompleted
                                  ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                                  : "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
                              }`}
                            >
                              {isCompleted ? "Evaluated" : "In Progress"}
                            </Badge>
                          </div>
                          <p className="text-sm font-medium line-clamp-2">{attempt.question_text}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {new Date(attempt.created_at).toLocaleString()}
                            {attempt.word_count ? ` | ${attempt.word_count} words` : ""}
                          </p>
                        </div>
                        <div className="flex items-center gap-3 ml-4">
                          {attempt.ai_score !== null && (
                            <div className="text-right">
                              <p
                                className={`text-2xl font-bold ${
                                  attempt.ai_score >= 80
                                    ? "text-green-600 dark:text-green-400"
                                    : attempt.ai_score >= 60
                                      ? "text-blue-600 dark:text-blue-400"
                                      : "text-orange-600 dark:text-orange-400"
                                }`}
                              >
                                {attempt.ai_score}
                              </p>
                              <p className="text-xs text-muted-foreground">Score</p>
                            </div>
                          )}
                          <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Essay Writing Interface - Active Session */}
      {sessionData && !showResults ? (
        <div className="space-y-4">
          {/* Progress Bar */}
          <Card>
            <CardContent className="py-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-medium">
                  Question {currentQuestionIndex + 1} of {sessionData.questions.length}
                </p>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{sessionData.topic}</Badge>
                  <Badge variant="secondary">{sessionData.wordLimit} words target</Badge>
                </div>
              </div>
              <div className="flex gap-1.5">
                {sessionData.questions.map((_, idx) => (
                  <div
                    key={idx}
                    className={`h-2 flex-1 rounded-full transition-colors ${
                      idx < results.length
                        ? "bg-green-500 dark:bg-green-400"
                        : idx === currentQuestionIndex
                          ? "bg-primary"
                          : "bg-muted"
                    }`}
                  />
                ))}
              </div>
              {results.length > 0 && (
                <p className="text-xs text-muted-foreground mt-2">
                  {results.length} completed | Average score: {Math.round(results.reduce((acc, r) => acc + (r.feedback?.score || 0), 0) / results.length)}
                </p>
              )}
            </CardContent>
          </Card>

          {/* Question Card */}
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="flex-shrink-0 h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold bg-primary text-primary-foreground">
                      {currentQuestionIndex + 1}
                    </span>
                    <Badge variant="outline">{sessionData.topic}</Badge>
                  </div>
                  <h3 className="text-lg font-semibold leading-relaxed">
                    {sessionData.questions[currentQuestionIndex].question}
                  </h3>
                </div>
              </div>
            </CardHeader>
          </Card>

          {/* Essay Textarea */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Write Your Essay</CardTitle>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span className={wordCount > sessionData.wordLimit ? "text-red-600 dark:text-red-400 font-medium" : ""}>
                    {wordCount} / {sessionData.wordLimit} words
                  </span>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Textarea
                value={essayText}
                onChange={(e) => setEssayText(e.target.value)}
                placeholder="Start writing your essay here..."
                className="min-h-[400px] text-base leading-relaxed font-serif"
              />
              <div className="flex justify-between items-center mt-4">
                <Button variant="outline" onClick={handleReset} className="bg-transparent">
                  Cancel Session
                </Button>
                <Button onClick={handleSubmitEssay} disabled={submitting || !essayText.trim()} className="gap-2">
                  {submitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Evaluating...
                    </>
                  ) : currentQuestionIndex < sessionData.questions.length - 1 ? (
                    <>
                      <Send className="h-4 w-4" />
                      Submit & Next Question
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4" />
                      Submit & View Results
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : !showResults ? (
        // Configuration Screen
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Upload Study Material</CardTitle>
              <p className="text-sm text-muted-foreground">Upload a PDF document to generate essay questions from</p>
            </CardHeader>
            <CardContent>
              <PDFUpload
                onTextExtracted={(text, filename) => {
                  setExtractedText(text)
                  setPdfFileName(filename)
                }}
                disabled={loading}
              />
              {pdfFileName && (
                <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
                  <FileText className="h-4 w-4" />
                  <span>{pdfFileName}</span>
                  <Badge variant="secondary" className="ml-auto">
                    {extractedText.length} chars
                  </Badge>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Essay Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="topic">Essay Topic</Label>
                <Input
                  id="topic"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="e.g., Climate Change, World War II, Cell Biology"
                  className="mt-1.5"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="questionCount" className="flex items-center gap-1.5">
                    <Hash className="h-3.5 w-3.5" />
                    Number of Questions
                  </Label>
                  <Input
                    id="questionCount"
                    type="number"
                    value={questionCount}
                    onChange={(e) => setQuestionCount(Math.max(1, Math.min(10, Number(e.target.value))))}
                    min={1}
                    max={10}
                    className="mt-1.5"
                  />
                  <p className="text-xs text-muted-foreground mt-1">1 to 10 questions per session</p>
                </div>

                <div>
                  <Label htmlFor="wordLimit">Target Word Count</Label>
                  <Input
                    id="wordLimit"
                    type="number"
                    value={wordLimit}
                    onChange={(e) => setWordLimit(Number(e.target.value))}
                    min={200}
                    max={2000}
                    step={50}
                    className="mt-1.5"
                  />
                  <p className="text-xs text-muted-foreground mt-1">Per essay (200-2000)</p>
                </div>
              </div>

              <Button
                onClick={handleGenerateQuestions}
                disabled={loading || !extractedText || !topic}
                className="w-full gap-2"
                size="lg"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Generating {questionCount} Essay Question{questionCount > 1 ? "s" : ""}...
                  </>
                ) : (
                  <>
                    <BookOpen className="h-5 w-5" />
                    Generate {questionCount} Essay Question{questionCount > 1 ? "s" : ""}
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>
      ) : null}
    </div>
  )
}

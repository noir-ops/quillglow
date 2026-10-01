"use client"

import { useState, useCallback, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ClipboardCopy,
  Loader2,
  Lock,
  RefreshCw,
  Repeat,
  ShieldCheck,
  Sparkles,
  SpellCheck,
  Wand2,
  X,
} from "lucide-react"
import Link from "next/link"
import { cn } from "@/lib/utils"

// ── Types ────────────────────────────────────────────────────────────────────

interface Signal {
  name: string
  value: string
  flag: "ok" | "warn" | "bad"
}

interface DetectorResult {
  ai_score: number
  verdict: string
  explanation: string
  signals: Signal[]
  red_flags: string[]
}

interface HumanizerResult {
  humanized: string
  changes_made: string[]
  estimated_ai_score_before: number
  estimated_ai_score_after: number
}

interface GrammarIssue {
  type: string
  original: string
  fix: string
  explanation: string
}

interface GrammarResult {
  corrected: string
  issues: GrammarIssue[]
  issue_count: number
  clarity_notes: string[]
}

interface ParaphraseResult {
  paraphrased: string
  similarity_estimate: number
  changes_made: string[]
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length
}

function scoreColor(score: number): string {
  if (score < 40) return "text-green-600 dark:text-green-400"
  if (score < 70) return "text-amber-500 dark:text-amber-400"
  return "text-red-500 dark:text-red-400"
}

function scoreBg(score: number): string {
  if (score < 40) return "bg-green-500"
  if (score < 70) return "bg-amber-500"
  return "bg-red-500"
}

function flagBg(flag: Signal["flag"]): string {
  if (flag === "ok") return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
  if (flag === "warn") return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
  return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
}

// ── Main Component ────────────────────────────────────────────────────────────

export function WriteRealTool() {
  const [activeTab, setActiveTab] = useState<"grammar" | "detect" | "humanize" | "paraphrase">("grammar")

  // Shared state
  const [detectText, setDetectText] = useState("")
  const [humanizeText, setHumanizeText] = useState("")
  const [humanizedOutput, setHumanizedOutput] = useState("")
  const [grammarText, setGrammarText] = useState("")
  const [grammarOutput, setGrammarOutput] = useState("")
  const [paraphraseText, setParaphraseText] = useState("")
  const [paraphraseOutput, setParaphraseOutput] = useState("")

  // Detector options
  const [sensitivity, setSensitivity] = useState("standard")

  // Humanizer options
  const [tone, setTone] = useState("natural")
  const [strength, setStrength] = useState("medium")
  const [preserveArgs, setPreserveArgs] = useState(true)

  // Paraphraser options
  const [paraphraseStyle, setParaphraseStyle] = useState("standard")

  // Results
  const [detectorResult, setDetectorResult] = useState<DetectorResult | null>(null)
  const [humanizerResult, setHumanizerResult] = useState<HumanizerResult | null>(null)
  const [grammarResult, setGrammarResult] = useState<GrammarResult | null>(null)
  const [paraphraseResult, setParaphraseResult] = useState<ParaphraseResult | null>(null)

  // UI state
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  // Usage / limit state
  const [usage, setUsage] = useState<{
    isGenius: boolean
    unlimited: boolean
    used: number
    remaining: number | null
    limit: number | null
  } | null>(null)

  useEffect(() => {
    fetch(`/api/writereal/usage?mode=${activeTab}`)
      .then((r) => r.json())
      .then((u) => { if (!u.error) setUsage(u) })
      .catch(() => {})
  }, [activeTab])

  const refreshUsage = useCallback(() => {
    fetch(`/api/writereal/usage?mode=${activeTab}`)
      .then((r) => r.json())
      .then((u) => { if (!u.error) setUsage(u) })
      .catch(() => {})
  }, [activeTab])

  // ── API calls ──────────────────────────────────────────────────────────────

  const runDetect = useCallback(async (text: string) => {
    if (wordCount(text) < 30) {
      setError("Add at least 30 words for accurate results.")
      return
    }
    setError(null)
    setIsLoading(true)
    setDetectorResult(null)
    try {
      const res = await fetch("/api/writereal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "detect", text, options: { sensitivity } }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Detection failed")
      setDetectorResult(data as DetectorResult)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong — please try again")
    } finally {
      setIsLoading(false)
    }
  }, [sensitivity])

  const runHumanize = useCallback(async (text: string) => {
    if (wordCount(text) < 30) {
      setError("Add at least 30 words for accurate results.")
      return
    }
    setError(null)
    setIsLoading(true)
    setHumanizerResult(null)
    setHumanizedOutput("")
    try {
      const res = await fetch("/api/writereal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "humanize", text, options: { tone, strength, preserveArgs } }),
      })
      const data = await res.json()
      if (res.status === 429 || data.error === "monthly_limit_reached") {
        setError("monthly_limit_reached")
        refreshUsage()
        return
      }
      if (!res.ok) throw new Error(data.error || "Humanization failed")
      const typed = data as HumanizerResult
      setHumanizerResult(typed)
      setHumanizedOutput(typed.humanized || "")
      refreshUsage()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong — please try again")
    } finally {
      setIsLoading(false)
    }
  }, [tone, strength, preserveArgs, refreshUsage])

  const runGrammar = useCallback(async (text: string) => {
    if (wordCount(text) < 30) {
      setError("Add at least 30 words for accurate results.")
      return
    }
    setError(null)
    setIsLoading(true)
    setGrammarResult(null)
    setGrammarOutput("")
    try {
      const res = await fetch("/api/writereal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "grammar", text, options: {} }),
      })
      const data = await res.json()
      if (res.status === 429 || data.error === "monthly_limit_reached") {
        setError("monthly_limit_reached")
        refreshUsage()
        return
      }
      if (!res.ok) throw new Error(data.error || "Grammar check failed")
      const typed = data as GrammarResult
      setGrammarResult(typed)
      setGrammarOutput(typed.corrected || "")
      refreshUsage()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong — please try again")
    } finally {
      setIsLoading(false)
    }
  }, [refreshUsage])

  const runParaphrase = useCallback(async (text: string) => {
    if (wordCount(text) < 30) {
      setError("Add at least 30 words for accurate results.")
      return
    }
    setError(null)
    setIsLoading(true)
    setParaphraseResult(null)
    setParaphraseOutput("")
    try {
      const res = await fetch("/api/writereal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "paraphrase", text, options: { style: paraphraseStyle } }),
      })
      const data = await res.json()
      if (res.status === 429 || data.error === "monthly_limit_reached") {
        setError("monthly_limit_reached")
        refreshUsage()
        return
      }
      if (!res.ok) throw new Error(data.error || "Paraphrasing failed")
      const typed = data as ParaphraseResult
      setParaphraseResult(typed)
      setParaphraseOutput(typed.paraphrased || "")
      refreshUsage()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong — please try again")
    } finally {
      setIsLoading(false)
    }
  }, [paraphraseStyle, refreshUsage])

  const handleCopy = async () => {
    const output =
      activeTab === "humanize" ? humanizedOutput :
      activeTab === "grammar" ? grammarOutput :
      activeTab === "paraphrase" ? paraphraseOutput : ""
    if (!output) return
    await navigator.clipboard.writeText(output)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const sendToHumanizer = () => {
    setHumanizeText(detectText)
    setActiveTab("humanize")
  }

  const sendToDetector = () => {
    setDetectText(humanizedOutput || humanizeText)
    setActiveTab("detect")
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  // usage is refetched per-tab (see the effect above), so this is already
  // correctly scoped to whichever generative mode is currently active.
  const generativeBlocked = !usage?.unlimited && usage !== null && (usage.remaining ?? 0) <= 0

  return (
    <div className="space-y-6">
      {/* Usage banner — hidden on Detect, which stays free/unlimited */}
      {activeTab !== "detect" && usage && !usage.unlimited && (
        <div className={cn(
          "flex items-center justify-between gap-3 rounded-xl border px-4 py-3",
          (usage.remaining ?? 0) <= 0
            ? "border-destructive/30 bg-destructive/5"
            : "border-[#7C3AED]/20 bg-[#EDE9FF]/60"
        )}>
          <div className="flex items-center gap-2.5 min-w-0">
            {(usage.remaining ?? 0) <= 0
              ? <Lock className="h-4 w-4 text-destructive shrink-0" />
              : <Wand2 className="h-4 w-4 text-[#7C3AED] shrink-0" />
            }
            <div className="min-w-0">
              {(usage.remaining ?? 0) <= 0 ? (
                <>
                  <p className="text-sm font-semibold text-destructive">You&apos;ve used all {usage.limit} {activeTab}s this month</p>
                  <p className="text-xs text-muted-foreground">Resets on the 1st. Upgrade to Genius for unlimited access.</p>
                </>
              ) : (
                <>
                  <p className="text-sm font-semibold text-[#1C1917]">
                    {usage.remaining} of {usage.limit} {activeTab}s remaining this month
                  </p>
                  <p className="text-xs text-muted-foreground">Scholar plan — resets on the 1st of each month</p>
                </>
              )}
            </div>
          </div>
          {(usage.remaining ?? 0) <= 0 && (
            <Link href="/upgrade">
              <button className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-[#7C3AED] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#6D28D9] transition-colors">
                <Sparkles className="h-3.5 w-3.5" /> Upgrade
              </button>
            </Link>
          )}
        </div>
      )}

      {/* Tab switcher */}
      <div className="flex gap-1 p-1 bg-muted rounded-xl w-full sm:w-fit overflow-x-auto">
        {(["grammar", "detect", "humanize", "paraphrase"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => { setActiveTab(tab); setError(null) }}
            className={cn(
              "flex-1 sm:flex-none px-4 py-2 rounded-lg text-sm font-semibold transition-all whitespace-nowrap",
              activeTab === tab
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {tab === "grammar" && (
              <span className="flex items-center gap-2"><SpellCheck className="h-4 w-4" />Grammar Checker</span>
            )}
            {tab === "detect" && (
              <span className="flex items-center gap-2"><ShieldCheck className="h-4 w-4" />AI Detector</span>
            )}
            {tab === "humanize" && (
              <span className="flex items-center gap-2"><Wand2 className="h-4 w-4" />AI Humanizer</span>
            )}
            {tab === "paraphrase" && (
              <span className="flex items-center gap-2"><Repeat className="h-4 w-4" />Paraphraser</span>
            )}
          </button>
        ))}
      </div>

      {/* Global error */}
      {error && (
        <Alert variant="destructive" className="flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          <AlertDescription className="flex-1">{error}</AlertDescription>
          <button onClick={() => setError(null)} className="ml-auto shrink-0">
            <X className="h-4 w-4" />
          </button>
        </Alert>
      )}

      {/* ── GRAMMAR PANEL ────────────────────────────────────────────────── */}
      {activeTab === "grammar" && (
        <div className="space-y-5">
          <Textarea
            value={grammarText}
            onChange={(e) => setGrammarText(e.target.value)}
            placeholder="Paste your essay or text here..."
            className="min-h-[180px] resize-y text-sm leading-relaxed"
          />
          <div className="flex items-center justify-between flex-wrap gap-3">
            <span className="text-xs text-muted-foreground">
              {wordCount(grammarText)} word{wordCount(grammarText) !== 1 ? "s" : ""}
              {wordCount(grammarText) > 0 && wordCount(grammarText) < 30 && (
                <span className="text-amber-500 ml-2">— add at least 30 words</span>
              )}
            </span>
            {generativeBlocked ? (
              <div className="flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2">
                <Lock className="h-4 w-4 text-destructive shrink-0" />
                <Link href="/upgrade" className="text-xs font-bold text-[#7C3AED] whitespace-nowrap">
                  Limit reached — Unlock Genius
                </Link>
              </div>
            ) : (
              <Button
                onClick={() => runGrammar(grammarText)}
                disabled={isLoading || wordCount(grammarText) < 1}
                className="gap-2"
              >
                {isLoading ? (
                  <><Loader2 className="h-4 w-4 animate-spin" />Checking<span className="animate-pulse">...</span></>
                ) : (
                  <><SpellCheck className="h-4 w-4" />Check Grammar</>
                )}
              </Button>
            )}
          </div>

          {/* Grammar results */}
          {grammarResult && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Original */}
                <div className="rounded-xl border border-border bg-muted/40 p-4 space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Original</p>
                  <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap line-clamp-[12]">
                    {grammarText.slice(0, 300)}{grammarText.length > 300 ? "…" : ""}
                  </p>
                </div>
                {/* Corrected — editable */}
                <div className="rounded-xl border border-primary/30 bg-card p-4 space-y-2">
                  <p className="text-xs font-semibold text-primary uppercase tracking-widest flex items-center gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5" />Corrected
                  </p>
                  <Textarea
                    value={grammarOutput}
                    onChange={(e) => setGrammarOutput(e.target.value)}
                    className="min-h-[200px] resize-y text-sm leading-relaxed border-0 bg-transparent p-0 focus-visible:ring-0 shadow-none"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold">
                  {grammarResult.issue_count} issue{grammarResult.issue_count !== 1 ? "s" : ""} found
                </span>
              </div>

              {/* Issue list */}
              {grammarResult.issues.length > 0 && (
                <div className="space-y-2">
                  {grammarResult.issues.map((issue, i) => (
                    <div key={i} className="rounded-xl border border-border bg-card p-3 text-sm">
                      <span className="inline-block text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 mb-1.5">
                        {issue.type}
                      </span>
                      <p>
                        <span className="line-through text-muted-foreground">{issue.original}</span>
                        {" → "}
                        <span className="text-green-600 dark:text-green-400 font-medium">{issue.fix}</span>
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">{issue.explanation}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Clarity notes */}
              {grammarResult.clarity_notes.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {grammarResult.clarity_notes.map((note) => (
                    <span key={note} className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                      {note}
                    </span>
                  ))}
                </div>
              )}

              <Button variant="outline" className="gap-2" onClick={handleCopy}>
                <ClipboardCopy className="h-4 w-4" />
                {copied ? "Copied!" : "Copy corrected text"}
              </Button>
            </div>
          )}
        </div>
      )}

      {/* ── DETECT PANEL ─────────────────────────────────────────────────── */}
      {activeTab === "detect" && (
        <div className="space-y-5">
          <Textarea
            value={detectText}
            onChange={(e) => setDetectText(e.target.value)}
            placeholder="Paste your essay or text here..."
            className="min-h-[180px] resize-y text-sm leading-relaxed"
          />
          <div className="flex items-center justify-between flex-wrap gap-3">
            <span className="text-xs text-muted-foreground">
              {wordCount(detectText)} word{wordCount(detectText) !== 1 ? "s" : ""}
              {wordCount(detectText) > 0 && wordCount(detectText) < 30 && (
                <span className="text-amber-500 ml-2">— add at least 30 words</span>
              )}
            </span>
            <div className="flex items-center gap-3 flex-wrap">
              <Select value={sensitivity} onValueChange={setSensitivity}>
                <SelectTrigger className="h-9 w-52 text-sm">
                  <SelectValue placeholder="Sensitivity" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="standard">Standard</SelectItem>
                  <SelectItem value="strict">Strict (Academic)</SelectItem>
                  <SelectItem value="lenient">Lenient</SelectItem>
                </SelectContent>
              </Select>
              <Button
                onClick={() => runDetect(detectText)}
                disabled={isLoading || wordCount(detectText) < 1}
                className="gap-2"
              >
                {isLoading ? (
                  <><Loader2 className="h-4 w-4 animate-spin" />Analysing<span className="animate-pulse">...</span></>
                ) : (
                  <><ShieldCheck className="h-4 w-4" />Analyse Text</>
                )}
              </Button>
            </div>
          </div>

          {/* Detector results */}
          {detectorResult && (
            <div className="space-y-5">
              {/* Score card */}
              <div className="rounded-xl border border-border bg-card p-6">
                <div className="flex flex-col sm:flex-row sm:items-center gap-6">
                  <div className="flex flex-col items-center gap-1 shrink-0">
                    <span className={cn("text-6xl font-black tabular-nums", scoreColor(detectorResult.ai_score))}>
                      {detectorResult.ai_score}%
                    </span>
                    <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">AI Score</span>
                  </div>
                  <div className="flex-1 space-y-3">
                    <div>
                      <p className={cn("text-lg font-bold", scoreColor(detectorResult.ai_score))}>
                        {detectorResult.verdict}
                      </p>
                      <p className="text-sm text-muted-foreground mt-0.5">{detectorResult.explanation}</p>
                    </div>
                    <div className="h-3 rounded-full bg-muted overflow-hidden">
                      <div
                        className={cn("h-full rounded-full transition-all duration-700", scoreBg(detectorResult.ai_score))}
                        style={{ width: `${detectorResult.ai_score}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Signal cards 2x2 */}
              <div className="grid grid-cols-2 gap-3">
                {detectorResult.signals.map((signal) => (
                  <div key={signal.name} className="rounded-xl border border-border bg-card p-4">
                    <p className="text-xs text-muted-foreground font-medium mb-1">{signal.name}</p>
                    <span className={cn("inline-block text-xs font-semibold px-2.5 py-1 rounded-full", flagBg(signal.flag))}>
                      {signal.value}
                    </span>
                  </div>
                ))}
              </div>

              {/* Red flags */}
              {detectorResult.red_flags.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-2">Red Flags Detected</p>
                  <div className="flex flex-wrap gap-2">
                    {detectorResult.red_flags.map((flag) => (
                      <span key={flag} className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                        <AlertTriangle className="h-3 w-3 shrink-0" />
                        {flag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Humanize CTA */}
              <Button variant="outline" className="gap-2 w-full sm:w-auto" onClick={sendToHumanizer}>
                Humanize this text <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      )}

      {/* ── HUMANIZE PANEL ───────────────────────────────────────────────── */}
      {activeTab === "humanize" && (
        <div className="space-y-5">
          <Textarea
            value={humanizeText}
            onChange={(e) => setHumanizeText(e.target.value)}
            placeholder="Paste AI-generated text here..."
            className="min-h-[180px] resize-y text-sm leading-relaxed"
          />
          <div className="flex items-center justify-between flex-wrap gap-3">
            <span className="text-xs text-muted-foreground">
              {wordCount(humanizeText)} word{wordCount(humanizeText) !== 1 ? "s" : ""}
              {wordCount(humanizeText) > 0 && wordCount(humanizeText) < 30 && (
                <span className="text-amber-500 ml-2">— add at least 30 words</span>
              )}
            </span>
          </div>

          {/* Options row */}
          <div className="flex flex-wrap gap-3 items-center">
            <Select value={tone} onValueChange={setTone}>
              <SelectTrigger className="h-9 w-52 text-sm">
                <SelectValue placeholder="Tone" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="casual">Casual Student</SelectItem>
                <SelectItem value="academic">Academic (Formal)</SelectItem>
                <SelectItem value="gcse">GCSE / A-Level Style</SelectItem>
                <SelectItem value="natural">Natural &amp; Conversational</SelectItem>
                <SelectItem value="university">University Essay</SelectItem>
              </SelectContent>
            </Select>
            <Select value={strength} onValueChange={setStrength}>
              <SelectTrigger className="h-9 w-56 text-sm">
                <SelectValue placeholder="Rewrite Strength" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="light">Light Edit</SelectItem>
                <SelectItem value="medium">Medium Rewrite</SelectItem>
                <SelectItem value="heavy">Heavy Rewrite (Recommended)</SelectItem>
              </SelectContent>
            </Select>
            <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer select-none">
              <input
                type="checkbox"
                checked={preserveArgs}
                onChange={(e) => setPreserveArgs(e.target.checked)}
                className="rounded border-border accent-primary h-4 w-4"
              />
              Preserve all core arguments and facts
            </label>
          </div>

          {generativeBlocked ? (
            <div className="flex items-center justify-between gap-3 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3">
              <div className="flex items-center gap-2.5">
                <Lock className="h-4 w-4 text-destructive shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-destructive">Monthly limit reached</p>
                  <p className="text-xs text-muted-foreground">Upgrade to Genius for unlimited humanizations.</p>
                </div>
              </div>
              <Link href="/upgrade">
                <button className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-[#7C3AED] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#6D28D9] transition-colors">
                  <Sparkles className="h-3.5 w-3.5" /> Unlock Genius
                </button>
              </Link>
            </div>
          ) : (
            <Button
              onClick={() => runHumanize(humanizeText)}
              disabled={isLoading || wordCount(humanizeText) < 1}
              className="gap-2"
            >
              {isLoading ? (
                <><Loader2 className="h-4 w-4 animate-spin" />Rewriting in your chosen tone<span className="animate-pulse">...</span></>
              ) : (
                <><Wand2 className="h-4 w-4" />Humanize It</>
              )}
            </Button>
          )}

          {/* Humanizer results */}
          {humanizerResult && (
            <div className="space-y-5">
              {/* Side-by-side columns */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Original */}
                <div className="rounded-xl border border-border bg-muted/40 p-4 space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Original (AI)</p>
                  <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap line-clamp-[12]">
                    {humanizeText.slice(0, 300)}{humanizeText.length > 300 ? "…" : ""}
                  </p>
                </div>
                {/* Humanized — editable */}
                <div className="rounded-xl border border-primary/30 bg-card p-4 space-y-2">
                  <p className="text-xs font-semibold text-primary uppercase tracking-widest flex items-center gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5" />Humanized
                  </p>
                  <Textarea
                    value={humanizedOutput}
                    onChange={(e) => setHumanizedOutput(e.target.value)}
                    className="min-h-[200px] resize-y text-sm leading-relaxed border-0 bg-transparent p-0 focus-visible:ring-0 shadow-none"
                  />
                </div>
              </div>

              {/* Changes made + score drop */}
              <div className="flex flex-wrap gap-2">
                {humanizerResult.changes_made.map((change) => (
                  <span key={change} className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                    <CheckCircle2 className="h-3 w-3 shrink-0" />
                    {change}
                  </span>
                ))}
                <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                  <AlertTriangle className="h-3 w-3 shrink-0" />
                  Was ~{humanizerResult.estimated_ai_score_before}% AI &rarr; now ~{humanizerResult.estimated_ai_score_after}% AI
                </span>
              </div>

              {/* Action row */}
              <div className="flex flex-wrap gap-3">
                <Button variant="outline" className="gap-2" onClick={handleCopy}>
                  <ClipboardCopy className="h-4 w-4" />
                  {copied ? "Copied!" : "Copy humanized text"}
                </Button>
                <Button variant="outline" className="gap-2" onClick={sendToDetector}>
                  Check with Detector <ArrowRight className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  className="gap-2"
                  onClick={() => runHumanize(humanizeText)}
                  disabled={isLoading}
                >
                  <RefreshCw className="h-4 w-4" />
                  Regenerate
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── PARAPHRASE PANEL ─────────────────────────────────────────────── */}
      {activeTab === "paraphrase" && (
        <div className="space-y-5">
          <Textarea
            value={paraphraseText}
            onChange={(e) => setParaphraseText(e.target.value)}
            placeholder="Paste the text you want paraphrased..."
            className="min-h-[180px] resize-y text-sm leading-relaxed"
          />
          <div className="flex items-center justify-between flex-wrap gap-3">
            <span className="text-xs text-muted-foreground">
              {wordCount(paraphraseText)} word{wordCount(paraphraseText) !== 1 ? "s" : ""}
              {wordCount(paraphraseText) > 0 && wordCount(paraphraseText) < 30 && (
                <span className="text-amber-500 ml-2">— add at least 30 words</span>
              )}
            </span>
            <div className="flex items-center gap-3 flex-wrap">
              <Select value={paraphraseStyle} onValueChange={setParaphraseStyle}>
                <SelectTrigger className="h-9 w-48 text-sm">
                  <SelectValue placeholder="Style" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="standard">Standard</SelectItem>
                  <SelectItem value="fluent">Fluent</SelectItem>
                  <SelectItem value="academic">Academic</SelectItem>
                  <SelectItem value="simple">Simple</SelectItem>
                </SelectContent>
              </Select>
              {generativeBlocked ? (
                <div className="flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2">
                  <Lock className="h-4 w-4 text-destructive shrink-0" />
                  <Link href="/upgrade" className="text-xs font-bold text-[#7C3AED] whitespace-nowrap">
                    Limit reached — Unlock Genius
                  </Link>
                </div>
              ) : (
                <Button
                  onClick={() => runParaphrase(paraphraseText)}
                  disabled={isLoading || wordCount(paraphraseText) < 1}
                  className="gap-2"
                >
                  {isLoading ? (
                    <><Loader2 className="h-4 w-4 animate-spin" />Paraphrasing<span className="animate-pulse">...</span></>
                  ) : (
                    <><Repeat className="h-4 w-4" />Paraphrase</>
                  )}
                </Button>
              )}
            </div>
          </div>

          {/* Paraphrase results */}
          {paraphraseResult && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Original */}
                <div className="rounded-xl border border-border bg-muted/40 p-4 space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Original</p>
                  <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap line-clamp-[12]">
                    {paraphraseText.slice(0, 300)}{paraphraseText.length > 300 ? "…" : ""}
                  </p>
                </div>
                {/* Paraphrased — editable */}
                <div className="rounded-xl border border-primary/30 bg-card p-4 space-y-2">
                  <p className="text-xs font-semibold text-primary uppercase tracking-widest flex items-center gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5" />Paraphrased
                  </p>
                  <Textarea
                    value={paraphraseOutput}
                    onChange={(e) => setParaphraseOutput(e.target.value)}
                    className="min-h-[200px] resize-y text-sm leading-relaxed border-0 bg-transparent p-0 focus-visible:ring-0 shadow-none"
                  />
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {paraphraseResult.changes_made.map((change) => (
                  <span key={change} className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                    <CheckCircle2 className="h-3 w-3 shrink-0" />
                    {change}
                  </span>
                ))}
                <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                  ~{paraphraseResult.similarity_estimate}% wording similarity to original
                </span>
              </div>

              <div className="flex flex-wrap gap-3">
                <Button variant="outline" className="gap-2" onClick={handleCopy}>
                  <ClipboardCopy className="h-4 w-4" />
                  {copied ? "Copied!" : "Copy paraphrased text"}
                </Button>
                <Button
                  variant="outline"
                  className="gap-2"
                  onClick={() => runParaphrase(paraphraseText)}
                  disabled={isLoading}
                >
                  <RefreshCw className="h-4 w-4" />
                  Regenerate
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { AlertCircle, BookOpen, CheckCircle2, Loader2 } from "lucide-react"

interface SyllabusOption {
  syllabus: string
  conceptCount: number
  subjectCount: number
  subjects: string[]
}

const NONE = "__none__"

/**
 * Lets a learner pick the curriculum their study material should follow.
 * The list comes from what's actually been seeded into the learning graph,
 * so newly-indexed curricula appear here without a code change.
 */
export function SyllabusPicker() {
  const [available, setAvailable] = useState<SyllabusOption[]>([])
  const [primary, setPrimary] = useState<string>(NONE)
  const [secondary, setSecondary] = useState<string>(NONE)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)

  useEffect(() => {
    ;(async () => {
      try {
        const res = await fetch("/api/syllabus", { cache: "no-store" })
        const data = await res.json()
        setAvailable(data.available ?? [])
        setPrimary(data.selection?.primary ?? NONE)
        setSecondary(data.selection?.secondary ?? NONE)
      } catch {
        setMessage({ ok: false, text: "Could not load syllabus options." })
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  // Clearing primary must clear secondary too — a secondary with no primary
  // isn't a valid state (the API rejects it).
  const onPrimaryChange = (value: string) => {
    setPrimary(value)
    if (value === NONE) setSecondary(NONE)
    else if (value === secondary) setSecondary(NONE)
    setMessage(null)
  }

  const save = async () => {
    setSaving(true)
    setMessage(null)
    try {
      const res = await fetch("/api/syllabus", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          primary: primary === NONE ? null : primary,
          secondary: secondary === NONE ? null : secondary,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Could not save")
      setMessage({ ok: true, text: "Saved — your study tools will follow this curriculum." })
    } catch (err) {
      setMessage({ ok: false, text: err instanceof Error ? err.message : "Something went wrong" })
    } finally {
      setSaving(false)
    }
  }

  const describe = (o: SyllabusOption) =>
    `${o.subjectCount} subject${o.subjectCount === 1 ? "" : "s"} · ${o.conceptCount} concepts`

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading syllabus options…
        </CardContent>
      </Card>
    )
  }

  if (available.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" /> Your syllabus
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-start gap-2 text-sm text-muted-foreground">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>No curriculum has been indexed yet. Options appear here as curricula are added.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BookOpen className="h-5 w-5" /> Your syllabus
        </CardTitle>
        <CardDescription>
          Sprout AI, the Study Agent, EchoMind, your planner and readiness scores all follow what you pick here.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="primary-syllabus">
            Primary syllabus <span className="text-muted-foreground">— what you&apos;re mainly studying for</span>
          </Label>
          <Select value={primary} onValueChange={onPrimaryChange}>
            <SelectTrigger id="primary-syllabus">
              <SelectValue placeholder="Choose a syllabus" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>Not set</SelectItem>
              {available.map((o) => (
                <SelectItem key={o.syllabus} value={o.syllabus}>
                  <span className="flex flex-col items-start">
                    <span>{o.syllabus}</span>
                    <span className="text-xs text-muted-foreground">{describe(o)}</span>
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Your Exam Readiness score and study plan are built against this one.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="secondary-syllabus">
            Secondary syllabus <span className="text-muted-foreground">— optional</span>
          </Label>
          <Select value={secondary} onValueChange={(v) => (setSecondary(v), setMessage(null))} disabled={primary === NONE}>
            <SelectTrigger id="secondary-syllabus">
              <SelectValue placeholder={primary === NONE ? "Pick a primary first" : "None"} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>None</SelectItem>
              {available
                .filter((o) => o.syllabus !== primary)
                .map((o) => (
                  <SelectItem key={o.syllabus} value={o.syllabus}>
                    <span className="flex flex-col items-start">
                      <span>{o.syllabus}</span>
                      <span className="text-xs text-muted-foreground">{describe(o)}</span>
                    </span>
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Sitting two exams? Material from both is used in answers, but your readiness score stays scored against
            your primary.
          </p>
        </div>

        {primary !== NONE && (
          <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/40 p-3 text-sm">
            <span className="text-muted-foreground">Study tools will follow:</span>
            <Badge>{primary}</Badge>
            {secondary !== NONE && <Badge variant="secondary">{secondary}</Badge>}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save syllabus
          </Button>
          {message && (
            <span
              className={`flex items-center gap-1.5 text-sm ${message.ok ? "text-green-600 dark:text-green-500" : "text-destructive"}`}
            >
              {message.ok ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
              {message.text}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

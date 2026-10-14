"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { BookOpen, Check, Loader2, Pencil, Sparkles } from "lucide-react"
import { SubjectPicker } from "@/components/dashboard/subject-picker"

interface SyllabusOption {
  syllabus: string
  conceptCount: number
  subjectCount: number
  subjects: string[]
}

const NONE = "__none__"

/**
 * Dashboard syllabus card.
 *
 * Deliberately not the Settings picker — that's a full form, which would be
 * noise at the top of a dashboard. This is a summary that expands to edit:
 *   - nothing chosen  → an invitation, open by default (this is the state
 *                       that actually matters; until they pick, every AI
 *                       feature runs without curriculum grounding)
 *   - chosen          → one compact row of badges + a Change button
 *
 * Renders nothing at all if no curriculum has been imported yet, rather
 * than showing an empty picker a learner can't act on.
 */
export function SyllabusCard() {
  const [available, setAvailable] = useState<SyllabusOption[]>([])
  const [primary, setPrimary] = useState<string>(NONE)
  const [secondary, setSecondary] = useState<string>(NONE)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [justSaved, setJustSaved] = useState(false)

  useEffect(() => {
    ;(async () => {
      try {
        const res = await fetch("/api/syllabus", { cache: "no-store" })
        if (!res.ok) throw new Error()
        const data = await res.json()
        setAvailable(data.available ?? [])
        const p = data.selection?.primary ?? NONE
        setPrimary(p)
        setSecondary(data.selection?.secondary ?? NONE)
        // Open straight into edit mode when nothing is set — otherwise the
        // card is a prompt with no obvious next step.
        if (p === NONE) setEditing(true)
      } catch {
        setError("Couldn't load syllabus options.")
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const onPrimaryChange = (value: string) => {
    setPrimary(value)
    if (value === NONE || value === secondary) setSecondary(NONE)
    setError(null)
  }

  const save = async () => {
    setSaving(true)
    setError(null)
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
      if (!res.ok) throw new Error(data.error ?? "Couldn't save")
      setEditing(false)
      setJustSaved(true)
      setTimeout(() => setJustSaved(false), 2500)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong")
    } finally {
      setSaving(false)
    }
  }

  // Nothing imported yet — a picker with no options is worse than no card.
  if (!loading && available.length === 0) return null

  if (loading) {
    return (
      <div className="rounded-2xl border border-violet-200 bg-violet-50/60 p-4 dark:border-violet-900/60 dark:bg-violet-950/30">
        <div className="flex items-center gap-2 text-sm text-violet-900/70 dark:text-violet-200/70">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading your syllabus…
        </div>
      </div>
    )
  }

  const hasSelection = primary !== NONE

  return (
    <div className="overflow-hidden rounded-2xl border-2 border-violet-300 bg-gradient-to-br from-violet-50 via-fuchsia-50 to-indigo-50 shadow-md dark:border-violet-800/70 dark:from-violet-950/60 dark:via-fuchsia-950/40 dark:to-indigo-950/60">
      <div className="p-4 sm:p-5">
        {/* Header — stacks on mobile, single row from sm up */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 to-fuchsia-500 shadow-sm">
              <BookOpen className="h-5 w-5 text-white" />
            </div>

            <div className="min-w-0">
              <p className="font-bold text-violet-950 dark:text-violet-100">
                {hasSelection ? "Your syllabus" : "Pick your syllabus"}
              </p>

              {hasSelection && !editing ? (
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  <span className="rounded-full bg-violet-600 px-2.5 py-0.5 text-xs font-semibold text-white">
                    {primary}
                  </span>
                  {secondary !== NONE && (
                    <span className="rounded-full bg-fuchsia-100 px-2.5 py-0.5 text-xs font-semibold text-fuchsia-800 dark:bg-fuchsia-900/60 dark:text-fuchsia-200">
                      {secondary}
                    </span>
                  )}
                  {justSaved && (
                    <span className="flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                      <Check className="h-3.5 w-3.5" /> Saved
                    </span>
                  )}
                </div>
              ) : (
                <p className="mt-0.5 text-sm text-violet-900/80 dark:text-violet-200/80">
                  Your AI tools, planner and readiness score all follow this.
                </p>
              )}
            </div>
          </div>

          {hasSelection && !editing && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setEditing(true)}
              className="w-full shrink-0 border-violet-300 bg-white/70 text-violet-800 hover:bg-white sm:w-auto dark:border-violet-700 dark:bg-violet-950/50 dark:text-violet-200"
            >
              <Pencil className="mr-1.5 h-3.5 w-3.5" /> Change
            </Button>
          )}
        </div>

        {/* Subjects — only meaningful once a syllabus is chosen. Keyed on the
            selection so it refetches when the learner switches syllabus. */}
        {hasSelection && !editing && (
          <div className="mt-4 border-t border-violet-200/70 pt-4 dark:border-violet-800/70">
            <SubjectPicker key={`${primary}::${secondary}`} />
          </div>
        )}

        {/* Editor */}
        {editing && (
          <div className="mt-4 space-y-3">
            {/* One column on mobile, two from sm up */}
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wide text-violet-900/70 dark:text-violet-200/70">
                  Main syllabus
                </label>
                <Select value={primary} onValueChange={onPrimaryChange}>
                  <SelectTrigger className="h-11 border-violet-200 bg-white dark:border-violet-800 dark:bg-violet-950/60">
                    <SelectValue placeholder="Choose one" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>Not set</SelectItem>
                    {available.map((o) => (
                      <SelectItem key={o.syllabus} value={o.syllabus}>
                        {o.syllabus}
                        <span className="ml-2 text-xs text-muted-foreground">{o.subjectCount} subjects</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wide text-violet-900/70 dark:text-violet-200/70">
                  Second syllabus <span className="normal-case opacity-70">(optional)</span>
                </label>
                <Select value={secondary} onValueChange={setSecondary} disabled={primary === NONE}>
                  <SelectTrigger className="h-11 border-violet-200 bg-white disabled:opacity-60 dark:border-violet-800 dark:bg-violet-950/60">
                    <SelectValue placeholder={primary === NONE ? "Pick a main one first" : "None"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>None</SelectItem>
                    {available
                      .filter((o) => o.syllabus !== primary)
                      .map((o) => (
                        <SelectItem key={o.syllabus} value={o.syllabus}>
                          {o.syllabus}
                          <span className="ml-2 text-xs text-muted-foreground">{o.subjectCount} subjects</span>
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {error && <p className="text-sm font-medium text-rose-600 dark:text-rose-400">{error}</p>}

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Button
                onClick={save}
                disabled={saving}
                className="w-full bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white hover:from-violet-700 hover:to-fuchsia-700 sm:w-auto"
              >
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                Save syllabus
              </Button>

              {hasSelection && (
                <Button
                  variant="ghost"
                  onClick={() => setEditing(false)}
                  disabled={saving}
                  className="w-full text-violet-800 hover:bg-white/60 sm:w-auto dark:text-violet-200"
                >
                  Cancel
                </Button>
              )}

              <p className="text-xs text-violet-900/70 sm:ml-auto dark:text-violet-200/70">
                Readiness is scored against your main syllabus.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

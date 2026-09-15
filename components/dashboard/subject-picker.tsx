"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Check, Loader2 } from "lucide-react"

interface SubjectOption {
  syllabus: string
  subject: string
  conceptCount: number
  topicCount: number
  selected: boolean
}

/**
 * Lets a learner pick which subjects they actually study, from those offered
 * by their selected syllabi. Without this the Study Agent either offers every
 * subject in a syllabus (WAEC has 9; almost nobody sits all of them) or falls
 * back to free text and guesses.
 *
 * Renders nothing when no syllabus is chosen — the subject list would be
 * empty and the prompt to choose belongs on the syllabus card, not here.
 */
export function SubjectPicker({ onSaved }: { onSaved?: () => void }) {
  const [options, setOptions] = useState<SubjectOption[]>([])
  const [chosen, setChosen] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [justSaved, setJustSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const key = (s: { syllabus: string; subject: string }) => `${s.syllabus}::${s.subject}`

  const load = async () => {
    try {
      const res = await fetch("/api/syllabus/subjects", { cache: "no-store" })
      const data = await res.json()
      const opts: SubjectOption[] = data.subjects ?? []
      setOptions(opts)
      setChosen(new Set(opts.filter((o) => o.selected).map(key)))
    } catch {
      setError("Couldn't load subjects.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const toggle = (o: SubjectOption) => {
    setChosen((prev) => {
      const next = new Set(prev)
      const k = key(o)
      next.has(k) ? next.delete(k) : next.add(k)
      return next
    })
    setError(null)
  }

  const save = async () => {
    setSaving(true)
    setError(null)
    try {
      const subjects = options.filter((o) => chosen.has(key(o))).map((o) => ({ syllabus: o.syllabus, subject: o.subject }))
      const res = await fetch("/api/syllabus/subjects", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subjects }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Couldn't save")
      setJustSaved(true)
      setTimeout(() => setJustSaved(false), 2500)
      onSaved?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong")
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-violet-900/70 dark:text-violet-200/70">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading subjects…
      </div>
    )
  }

  // No syllabus chosen yet, or no curriculum imported.
  if (options.length === 0) return null

  // Group by syllabus so the same subject name under two syllabi stays
  // distinguishable (IGCSE Biology and WAEC Biology are not the same course).
  const grouped = options.reduce<Record<string, SubjectOption[]>>((acc, o) => {
    ;(acc[o.syllabus] ??= []).push(o)
    return acc
  }, {})

  return (
    <div className="space-y-3">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-violet-900/70 dark:text-violet-200/70">
          My subjects
        </p>
        <p className="mt-0.5 text-xs text-violet-900/70 dark:text-violet-200/70">
          Tap the ones you study. Your Study Agent and planner stick to these.
        </p>
      </div>

      {Object.entries(grouped).map(([syllabus, subs]) => (
        <div key={syllabus} className="space-y-1.5">
          <p className="text-[11px] font-bold uppercase tracking-wide text-violet-700/80 dark:text-violet-300/80">
            {syllabus}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {subs.map((o) => {
              const active = chosen.has(key(o))
              return (
                <button
                  key={key(o)}
                  type="button"
                  onClick={() => toggle(o)}
                  aria-pressed={active}
                  className={
                    active
                      ? "flex items-center gap-1 rounded-full bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-colors"
                      : "rounded-full border border-violet-300 bg-white/70 px-3 py-1.5 text-xs font-medium text-violet-900 transition-colors hover:bg-white dark:border-violet-700 dark:bg-violet-950/50 dark:text-violet-200"
                  }
                >
                  {active && <Check className="h-3 w-3" />}
                  {o.subject}
                </button>
              )
            })}
          </div>
        </div>
      ))}

      {error && <p className="text-sm font-medium text-rose-600 dark:text-rose-400">{error}</p>}

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Button
          onClick={save}
          disabled={saving}
          size="sm"
          className="w-full bg-violet-600 text-white hover:bg-violet-700 sm:w-auto"
        >
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save subjects
        </Button>
        {justSaved && (
          <span className="flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
            <Check className="h-3.5 w-3.5" /> Saved
          </span>
        )}
        <span className="text-xs text-violet-900/60 sm:ml-auto dark:text-violet-200/60">
          {chosen.size} selected
        </span>
      </div>
    </div>
  )
}

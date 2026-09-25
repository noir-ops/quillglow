"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  FileText,
  Loader2,
  Lock,
  Save,
  Send,
  Trash2,
  Upload,
} from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"
import {
  EDUCATION_LEVELS,
  INCOME_BRACKETS,
  SECTIONS,
  STATEMENT_WORD_LIMIT,
  UPLOAD_SLOTS,
  normaliseForm,
  validateApplication,
  wordCount,
  type ApplicationFormData,
  type SectionKey,
} from "@/lib/applications/form"
import { ApplicationTracker } from "@/components/applications/application-tracker"

interface Opportunity {
  id: string
  title: string
  provider: string | null
  opportunity_type: string | null
  description: string | null
  award_amount: number | null
  award_currency: string | null
  deadline: string | null
  is_rolling: boolean | null
  requires_essay: boolean | null
  requires_recommendation: boolean | null
}

interface Doc {
  id: string
  document_type: string
  original_filename: string | null
}

interface AppRow {
  id: string
  status: string
  form_data: ApplicationFormData
  created_at: string
  submitted_at: string | null
  screened_at: string | null
  decided_at: string | null
}

const DRAFT_STATUSES = ["saved", "in_progress"]

export function ApplicationForm({ applicationId }: { applicationId: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [app, setApp] = useState<AppRow | null>(null)
  const [opp, setOpp] = useState<Opportunity | null>(null)
  const [docs, setDocs] = useState<Doc[]>([])
  const [form, setForm] = useState<ApplicationFormData>(normaliseForm({}))
  const [open, setOpen] = useState<Set<SectionKey>>(new Set(["personal"]))
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle")
  const [showErrors, setShowErrors] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const dirtyRef = useRef(false)

  const readOnly = !!app && !DRAFT_STATUSES.includes(app.status)

  // ── Load ────────────────────────────────────────────────────────────────
  useEffect(() => {
    fetch(`/api/opportunities/applications/${applicationId}`, { cache: "no-store" })
      .then(async (r) => {
        const d = await r.json()
        if (!r.ok) throw new Error(d.error || "Could not load application")
        setApp(d.application)
        setOpp(d.opportunity)
        setDocs(d.documents ?? [])
        setForm(normaliseForm(d.application.form_data))
      })
      .catch((e) => setLoadError(e.message))
      .finally(() => setLoading(false))
  }, [applicationId])

  // ── Save progress ───────────────────────────────────────────────────────
  const save = useCallback(
    async (data: ApplicationFormData, quiet = false) => {
      setSaveState("saving")
      try {
        const r = await fetch(`/api/opportunities/applications/${applicationId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ form_data: data }),
        })
        if (!r.ok) throw new Error((await r.json()).error || "Save failed")
        dirtyRef.current = false
        setSaveState("saved")
        if (!quiet) toast.success("Progress saved — you can come back any time")
        return true
      } catch (e) {
        setSaveState("error")
        if (!quiet) toast.error(e instanceof Error ? e.message : "Could not save")
        return false
      }
    },
    [applicationId],
  )

  // Autosave 1.5s after the learner stops typing.
  useEffect(() => {
    if (readOnly || !dirtyRef.current) return
    const t = setTimeout(() => save(form, true), 1500)
    return () => clearTimeout(t)
  }, [form, readOnly, save])

  // Warn before leaving with unsaved changes.
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (dirtyRef.current) e.preventDefault()
    }
    window.addEventListener("beforeunload", handler)
    return () => window.removeEventListener("beforeunload", handler)
  }, [])

  const update = <K extends keyof ApplicationFormData>(section: K, patch: Partial<ApplicationFormData[K]>) => {
    if (readOnly) return
    dirtyRef.current = true
    setSaveState("idle")
    setForm((f) => ({ ...f, [section]: { ...f[section], ...patch } }))
  }

  // ── Validation ──────────────────────────────────────────────────────────
  const validation = useMemo(
    () =>
      validateApplication(form, {
        uploadedTypes: docs.map((d) => d.document_type),
        requiresRecommendation: !!opp?.requires_recommendation,
      }),
    [form, docs, opp],
  )
  const completeCount = SECTIONS.filter((s) => validation.errors[s.key].length === 0).length

  const toggle = (key: SectionKey) =>
    setOpen((prev) => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })

  const handleSubmit = async () => {
    setShowErrors(true)
    if (!validation.valid) {
      const firstBad = SECTIONS.filter((s) => validation.errors[s.key].length > 0).map((s) => s.key)
      setOpen(new Set(firstBad))
      toast.error("Some required fields are missing — they're highlighted below")
      return
    }
    setSubmitting(true)
    try {
      if (!(await save(form, true))) throw new Error("Could not save before submitting")
      const r = await fetch(`/api/opportunities/applications/${applicationId}/submit`, { method: "POST" })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || "Submission failed")
      toast.success("Application submitted! Track its progress on your dashboard.")
      router.push("/my-applications")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Submission failed")
    } finally {
      setSubmitting(false)
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading application…
      </div>
    )
  }
  if (loadError || !app || !opp) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center space-y-4">
        <p className="text-muted-foreground">{loadError ?? "Application not found"}</p>
        <Button asChild variant="outline">
          <Link href="/my-applications">Back to My Applications</Link>
        </Button>
      </div>
    )
  }

  const sectionProps = (key: SectionKey) => ({
    title: SECTIONS.find((s) => s.key === key)!.title,
    index: SECTIONS.findIndex((s) => s.key === key) + 1,
    open: open.has(key),
    onToggle: () => toggle(key),
    complete: validation.errors[key].length === 0,
    errors: showErrors && !readOnly ? validation.errors[key] : [],
  })

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:py-8 space-y-5">
      <Link href="/my-applications" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Application Dashboard
      </Link>

      {/* Header */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Scholarship Application</p>
            <h1 className="text-xl sm:text-2xl font-bold">{opp.title}</h1>
            {opp.provider && <p className="text-sm text-muted-foreground">{opp.provider}</p>}
          </div>
          {!readOnly && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {saveState === "saving" && (
                <span className="flex items-center gap-1">
                  <Loader2 className="h-3 w-3 animate-spin" /> Saving…
                </span>
              )}
              {saveState === "saved" && (
                <span className="flex items-center gap-1 text-green-600">
                  <CheckCircle2 className="h-3 w-3" /> All changes saved
                </span>
              )}
              {saveState === "error" && <span className="text-destructive">Not saved</span>}
              <Button size="sm" variant="outline" onClick={() => save(form)} className="gap-1.5">
                <Save className="h-3.5 w-3.5" /> Save progress
              </Button>
            </div>
          )}
        </div>

        {readOnly ? (
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center gap-2 text-sm">
                <Lock className="h-4 w-4 text-muted-foreground" />
                This application has been submitted and can no longer be edited.
              </div>
              <ApplicationTracker application={app} />
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>
                {completeCount} of {SECTIONS.length} sections complete
              </span>
              <span>{Math.round((completeCount / SECTIONS.length) * 100)}%</span>
            </div>
            <Progress value={(completeCount / SECTIONS.length) * 100} className="h-2" />
          </div>
        )}
      </div>

      {/* SECTION 1 — Personal */}
      <Section {...sectionProps("personal")}>
        <Grid>
          <Field label="Full name" required>
            <Input value={form.personal.fullName} disabled={readOnly} onChange={(e) => update("personal", { fullName: e.target.value })} />
          </Field>
          <Field label="Date of birth" required>
            <Input type="date" value={form.personal.dateOfBirth} disabled={readOnly} onChange={(e) => update("personal", { dateOfBirth: e.target.value })} />
          </Field>
          <Field label="Gender" required>
            <Choice
              value={form.personal.gender}
              disabled={readOnly}
              options={[
                { value: "male", label: "Male" },
                { value: "female", label: "Female" },
              ]}
              onChange={(v) => update("personal", { gender: v as "male" | "female" })}
            />
          </Field>
          <Field label="Nationality" required>
            <Input value={form.personal.nationality} disabled={readOnly} onChange={(e) => update("personal", { nationality: e.target.value })} />
          </Field>
          <Field label="Email address" required>
            <Input type="email" value={form.personal.email} disabled={readOnly} onChange={(e) => update("personal", { email: e.target.value })} />
          </Field>
          <Field label="Phone number" required>
            <Input type="tel" value={form.personal.phone} disabled={readOnly} onChange={(e) => update("personal", { phone: e.target.value })} />
          </Field>
          <Field label="Home address" required wide>
            <Input value={form.personal.address} disabled={readOnly} onChange={(e) => update("personal", { address: e.target.value })} />
          </Field>
          <Field label="Country of residence" required>
            <Input value={form.personal.countryOfResidence} disabled={readOnly} onChange={(e) => update("personal", { countryOfResidence: e.target.value })} />
          </Field>
        </Grid>
        <UploadSlot slot="governmentId" required docs={docs} setDocs={setDocs} applicationId={applicationId} readOnly={readOnly} />
      </Section>

      {/* SECTION 2 — Academic */}
      <Section {...sectionProps("academic")}>
        <Field label="Current education level" required>
          <Choice
            value={form.academic.educationLevel}
            disabled={readOnly}
            options={EDUCATION_LEVELS.map((l) => ({ value: l.value, label: l.label }))}
            onChange={(v) => update("academic", { educationLevel: v as ApplicationFormData["academic"]["educationLevel"] })}
          />
        </Field>
        <Grid>
          <Field label="Institution name" required>
            <Input value={form.academic.institution} disabled={readOnly} onChange={(e) => update("academic", { institution: e.target.value })} />
          </Field>
          <Field label="Country of institution" required>
            <Input value={form.academic.institutionCountry} disabled={readOnly} onChange={(e) => update("academic", { institutionCountry: e.target.value })} />
          </Field>
          <Field label="Field of study" required>
            <Input value={form.academic.fieldOfStudy} disabled={readOnly} onChange={(e) => update("academic", { fieldOfStudy: e.target.value })} />
          </Field>
          <Field label="Current GPA / academic performance" required>
            <Input value={form.academic.gpa} disabled={readOnly} placeholder="e.g. 3.6 / 4.0, or 5 A's" onChange={(e) => update("academic", { gpa: e.target.value })} />
          </Field>
          <Field label="Expected graduation year" required>
            <Input inputMode="numeric" maxLength={4} value={form.academic.graduationYear} disabled={readOnly} placeholder="e.g. 2027" onChange={(e) => update("academic", { graduationYear: e.target.value.replace(/\D/g, "") })} />
          </Field>
        </Grid>
        <UploadSlot slot="transcript" required docs={docs} setDocs={setDocs} applicationId={applicationId} readOnly={readOnly} />
      </Section>

      {/* SECTION 3 — Scholarship details (auto-loaded) + statement */}
      <Section {...sectionProps("scholarship")}>
        <div className="grid gap-3 rounded-lg bg-muted/40 p-4 text-sm sm:grid-cols-2">
          <Info label="Scholarship" value={opp.title} />
          <Info label="Awarding institution" value={opp.provider ?? "—"} />
          <Info
            label="Amount"
            value={opp.award_amount ? `${opp.award_currency ?? "USD"} ${Number(opp.award_amount).toLocaleString()}` : "—"}
          />
          <Info
            label="Deadline"
            value={opp.is_rolling ? "Rolling" : opp.deadline ? new Date(opp.deadline).toLocaleDateString() : "—"}
          />
        </div>
        <Field
          label="Reason for applying (personal statement)"
          required
          hint={`${wordCount(form.statement.text)} / ${STATEMENT_WORD_LIMIT} words`}
          hintWarn={wordCount(form.statement.text) > STATEMENT_WORD_LIMIT}
        >
          <Textarea
            value={form.statement.text}
            disabled={readOnly}
            rows={9}
            placeholder="Why are you applying for this scholarship, and what will it help you achieve?"
            onChange={(e) => update("statement", { text: e.target.value })}
          />
        </Field>
        <UploadSlot slot="statement" docs={docs} setDocs={setDocs} applicationId={applicationId} readOnly={readOnly} />
      </Section>

      {/* SECTION 4 — Financial (need-based only) */}
      <Section {...sectionProps("financial")}>
        <label className="flex items-start gap-2.5 text-sm">
          <Checkbox
            checked={form.financial.needBased}
            disabled={readOnly}
            onCheckedChange={(v) => update("financial", { needBased: v === true })}
            className="mt-0.5"
          />
          <span>
            I am applying as a <span className="font-medium">need-based</span> applicant
            <span className="block text-xs text-muted-foreground">Leave unticked to skip this section.</span>
          </span>
        </label>
        {form.financial.needBased && (
          <div className="space-y-4">
            <Field label="Family income bracket (annually)" required>
              <Choice
                value={form.financial.incomeBracket}
                disabled={readOnly}
                options={INCOME_BRACKETS.map((b) => ({ value: b.value, label: b.label }))}
                onChange={(v) => update("financial", { incomeBracket: v as ApplicationFormData["financial"]["incomeBracket"] })}
              />
            </Field>
            <Grid>
              <Field label="Number of dependents in household" required>
                <Input inputMode="numeric" value={form.financial.dependents} disabled={readOnly} onChange={(e) => update("financial", { dependents: e.target.value.replace(/\D/g, "") })} />
              </Field>
              <Field label="Do you have other scholarships or financial aid?" required>
                <YesNoChoice value={form.financial.hasOtherAid} disabled={readOnly} onChange={(v) => update("financial", { hasOtherAid: v })} />
              </Field>
            </Grid>
            {form.financial.hasOtherAid === "yes" && (
              <Field label="List current scholarships and amounts" required>
                <Textarea rows={3} value={form.financial.otherAid} disabled={readOnly} onChange={(e) => update("financial", { otherAid: e.target.value })} />
              </Field>
            )}
            <UploadSlot slot="financial" required docs={docs} setDocs={setDocs} applicationId={applicationId} readOnly={readOnly} hint="e.g. tax returns, proof of income" />
          </div>
        )}
      </Section>

      {/* SECTION 5 — Activities */}
      <Section {...sectionProps("activities")}>
        <Field label="Have you received any academic or leadership awards?" required>
          <YesNoChoice value={form.activities.hasAwards} disabled={readOnly} onChange={(v) => update("activities", { hasAwards: v })} />
        </Field>
        {form.activities.hasAwards === "yes" && (
          <Field label="List your awards" required>
            <Textarea rows={3} value={form.activities.awards} disabled={readOnly} onChange={(e) => update("activities", { awards: e.target.value })} />
          </Field>
        )}
        <Field label="Are you involved in any volunteering or social impact projects?" required>
          <YesNoChoice value={form.activities.hasVolunteering} disabled={readOnly} onChange={(v) => update("activities", { hasVolunteering: v })} />
        </Field>
        {form.activities.hasVolunteering === "yes" && (
          <Field label="Provide details" required>
            <Textarea rows={3} value={form.activities.volunteering} disabled={readOnly} onChange={(e) => update("activities", { volunteering: e.target.value })} />
          </Field>
        )}
        <Field label="Extracurricular activities" hint="e.g. sports, clubs, music, research">
          <Textarea rows={3} value={form.activities.extracurriculars} disabled={readOnly} onChange={(e) => update("activities", { extracurriculars: e.target.value })} />
        </Field>
      </Section>

      {/* SECTION 6 — References */}
      <Section {...sectionProps("references")}>
        {(["ref1", "ref2"] as const).map((key, i) => (
          <div key={key} className="space-y-3">
            <p className="text-sm font-semibold">
              Reference {i + 1}
              {i === 1 && <span className="ml-1 font-normal text-muted-foreground">(optional)</span>}
            </p>
            <Grid>
              <Field label="Name" required={i === 0}>
                <Input value={form.references[key].name} disabled={readOnly} onChange={(e) => update("references", { [key]: { ...form.references[key], name: e.target.value } })} />
              </Field>
              <Field label="Relationship to applicant" required={i === 0}>
                <Input value={form.references[key].relationship} disabled={readOnly} onChange={(e) => update("references", { [key]: { ...form.references[key], relationship: e.target.value } })} />
              </Field>
              <Field label="Contact email" required={i === 0}>
                <Input type="email" value={form.references[key].email} disabled={readOnly} onChange={(e) => update("references", { [key]: { ...form.references[key], email: e.target.value } })} />
              </Field>
            </Grid>
          </div>
        ))}
        <UploadSlot
          slot="recommendation"
          required={!!opp.requires_recommendation}
          docs={docs}
          setDocs={setDocs}
          applicationId={applicationId}
          readOnly={readOnly}
        />
      </Section>

      {/* SECTION 7 — Review & submit */}
      <Section {...sectionProps("review")}>
        <div className="space-y-1.5">
          {SECTIONS.filter((s) => s.key !== "review").map((s) => {
            const ok = validation.errors[s.key].length === 0
            return (
              <button
                key={s.key}
                type="button"
                onClick={() => setOpen(new Set([s.key]))}
                className="flex w-full items-center justify-between rounded-md border px-3 py-2 text-left text-sm hover:bg-muted/50"
              >
                <span>{s.title}</span>
                {ok ? (
                  <span className="flex items-center gap-1 text-xs text-green-600">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Complete
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-xs text-amber-600">
                    <AlertCircle className="h-3.5 w-3.5" /> {validation.errors[s.key].length} to finish
                  </span>
                )}
              </button>
            )
          })}
        </div>
        <label className="flex items-start gap-2.5 text-sm">
          <Checkbox checked={form.review.confirmAccurate} disabled={readOnly} onCheckedChange={(v) => update("review", { confirmAccurate: v === true })} className="mt-0.5" />
          I confirm that all information provided is accurate.
        </label>
        <label className="flex items-start gap-2.5 text-sm">
          <Checkbox checked={form.review.agreeTerms} disabled={readOnly} onCheckedChange={(v) => update("review", { agreeTerms: v === true })} className="mt-0.5" />
          I agree to the terms and conditions of the scholarship program.
        </label>
        {!readOnly && (
          <Button onClick={handleSubmit} disabled={submitting} className="w-full gap-2" size="lg">
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Submit Application
          </Button>
        )}
      </Section>
    </div>
  )
}

// ── Building blocks ─────────────────────────────────────────────────────────

function Section({
  title,
  index,
  open,
  onToggle,
  complete,
  errors,
  children,
}: {
  title: string
  index: number
  open: boolean
  onToggle: () => void
  complete: boolean
  errors: string[]
  children: React.ReactNode
}) {
  return (
    <Card className={cn(errors.length > 0 && "border-destructive/50")}>
      <button type="button" onClick={onToggle} aria-expanded={open} className="flex w-full items-center gap-3 p-4 text-left">
        <span
          className={cn(
            "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold",
            complete ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400" : "bg-muted text-muted-foreground",
          )}
        >
          {complete ? <CheckCircle2 className="h-4 w-4" /> : index}
        </span>
        <span className="flex-1 font-semibold">
          <span className="text-xs font-normal uppercase tracking-wide text-muted-foreground">Section {index}</span>
          <span className="block">{title}</span>
        </span>
        {errors.length > 0 && <Badge variant="destructive">{errors.length}</Badge>}
        <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <CardContent className="space-y-4 border-t pt-4">
          {errors.length > 0 && (
            <ul className="space-y-1 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {errors.map((e) => (
                <li key={e} className="flex items-start gap-1.5">
                  <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {e}
                </li>
              ))}
            </ul>
          )}
          {children}
        </CardContent>
      )}
    </Card>
  )
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-4 sm:grid-cols-2">{children}</div>
}

function Field({
  label,
  required,
  wide,
  hint,
  hintWarn,
  children,
}: {
  label: string
  required?: boolean
  wide?: boolean
  hint?: string
  hintWarn?: boolean
  children: React.ReactNode
}) {
  return (
    <div className={cn("space-y-1.5", wide && "sm:col-span-2")}>
      <div className="flex items-baseline justify-between gap-2">
        <Label className="text-sm">
          {label}
          {required && <span className="ml-0.5 text-destructive">*</span>}
        </Label>
        {hint && <span className={cn("text-xs", hintWarn ? "text-destructive" : "text-muted-foreground")}>{hint}</span>}
      </div>
      {children}
    </div>
  )
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  )
}

function Choice({
  value,
  options,
  onChange,
  disabled,
}: {
  value: string
  options: { value: string; label: string }[]
  onChange: (v: string) => void
  disabled?: boolean
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          disabled={disabled}
          onClick={() => onChange(o.value)}
          aria-pressed={value === o.value}
          className={cn(
            "rounded-md border px-3 py-1.5 text-sm transition-colors disabled:cursor-not-allowed",
            value === o.value ? "border-primary bg-primary/10 font-medium text-primary" : "hover:border-primary/50",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

function YesNoChoice({
  value,
  onChange,
  disabled,
}: {
  value: string
  onChange: (v: "yes" | "no") => void
  disabled?: boolean
}) {
  return (
    <Choice
      value={value}
      disabled={disabled}
      options={[
        { value: "yes", label: "Yes" },
        { value: "no", label: "No" },
      ]}
      onChange={(v) => onChange(v as "yes" | "no")}
    />
  )
}

function UploadSlot({
  slot,
  required,
  hint,
  docs,
  setDocs,
  applicationId,
  readOnly,
}: {
  slot: keyof typeof UPLOAD_SLOTS
  required?: boolean
  hint?: string
  docs: Doc[]
  setDocs: React.Dispatch<React.SetStateAction<Doc[]>>
  applicationId: string
  readOnly: boolean
}) {
  const { documentType, label } = UPLOAD_SLOTS[slot]
  const mine = docs.filter((d) => d.document_type === documentType)
  const [busy, setBusy] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const upload = async (file: File) => {
    setBusy(true)
    try {
      const fd = new FormData()
      fd.append("file", file)
      fd.append("documentType", documentType)
      fd.append("resourceType", "opportunity_application")
      fd.append("resourceId", applicationId)
      const r = await fetch("/api/documents", { method: "POST", body: fd })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || "Upload failed")
      setDocs((prev) => [...prev, { id: d.document.id, document_type: documentType, original_filename: file.name }])
      toast.success(`${label} uploaded`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed")
    } finally {
      setBusy(false)
      if (inputRef.current) inputRef.current.value = ""
    }
  }

  const remove = async (id: string) => {
    if (!confirm("Remove this file?")) return
    const r = await fetch(`/api/documents/${id}`, { method: "DELETE" })
    if (r.ok) setDocs((prev) => prev.filter((d) => d.id !== id))
    else toast.error("Could not remove file")
  }

  return (
    <div className="rounded-lg border border-dashed p-3 space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm">
          <span className="font-medium">{label}</span>
          {required && <span className="ml-0.5 text-destructive">*</span>}
          <span className="block text-xs text-muted-foreground">{hint ?? "PDF, DOC, DOCX, JPG or PNG · up to 10MB"}</span>
        </div>
        {!readOnly && (
          <>
            <input
              ref={inputRef}
              type="file"
              className="hidden"
              accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp"
              onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
            />
            <Button size="sm" variant="outline" disabled={busy} onClick={() => inputRef.current?.click()} className="gap-1.5">
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
              Upload
            </Button>
          </>
        )}
      </div>
      {mine.map((d) => (
        <div key={d.id} className="flex items-center gap-2 rounded bg-muted/50 px-2.5 py-1.5 text-sm">
          <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <span className="flex-1 truncate">{d.original_filename ?? "Uploaded file"}</span>
          {!readOnly && (
            <button type="button" onClick={() => remove(d.id)} aria-label="Remove file" className="text-muted-foreground hover:text-destructive">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      ))}
    </div>
  )
}

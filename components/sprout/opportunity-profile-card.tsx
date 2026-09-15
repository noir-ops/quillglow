"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { CheckCircle2, GraduationCap, Loader2, Save } from "lucide-react"

interface OpportunityProfile {
  country: string | null
  date_of_birth: string | null
  education_level: string | null
  gender: string | null
  syllabus: string | null
  target_subjects: string[] | null
  household_income_band: string | null
}

const EDUCATION_LEVELS = [
  { value: "secondary", label: "Secondary school" },
  { value: "undergraduate", label: "Undergraduate" },
  { value: "postgraduate", label: "Postgraduate" },
]

const SYLLABI = ["WAEC", "JAMB", "SAT", "IGCSE", "ACT"]

const INCOME_BANDS = [
  { value: "low", label: "Low income" },
  { value: "middle", label: "Middle income" },
  { value: "high", label: "High income" },
  { value: "prefer_not_to_say", label: "Prefer not to say" },
]

const SUBJECT_OPTIONS = [
  "Mathematics",
  "English",
  "Physics",
  "Chemistry",
  "Biology",
  "Economics",
  "Geography",
  "Computer Science",
  "Literature",
  "Government",
]

/**
 * Scholarship-matching profile.
 *
 * This is DELIBERATELY a separate form from the identity profile above it, not
 * a merge into the same table. `profiles` is display identity (name, bio,
 * avatar); this feeds `student_opportunity_profiles`, which the matching engine
 * uses for hard eligibility filters (age, country, syllabus). Conflating the
 * two would mean a display-name edit accidentally touching scholarship
 * eligibility data, or vice versa.
 */
export function OpportunityProfileCard() {
  const [profile, setProfile] = useState<OpportunityProfile>({
    country: null,
    date_of_birth: null,
    education_level: null,
    gender: null,
    syllabus: null,
    target_subjects: null,
    household_income_band: null,
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch("/api/opportunities/profile")
      .then((r) => r.json())
      .then((d) => {
        if (d.profile) setProfile({ ...profile, ...d.profile })
      })
      .catch(() => {})
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const update = <K extends keyof OpportunityProfile>(key: K, value: OpportunityProfile[K]) => {
    setProfile((p) => ({ ...p, [key]: value }))
    setSaved(false)
  }

  const toggleSubject = (subject: string) => {
    const current = profile.target_subjects ?? []
    update(
      "target_subjects",
      current.includes(subject) ? current.filter((s) => s !== subject) : [...current, subject],
    )
  }

  const save = async () => {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch("/api/opportunities/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          country: profile.country,
          dateOfBirth: profile.date_of_birth,
          educationLevel: profile.education_level,
          gender: profile.gender,
          syllabus: profile.syllabus,
          targetSubjects: profile.target_subjects,
          householdIncomeBand: profile.household_income_band,
        }),
      })
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed to save")
      setSaved(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save")
    } finally {
      setSaving(false)
    }
  }

  const filledFields = [
    profile.country,
    profile.date_of_birth,
    profile.education_level,
    profile.syllabus,
    profile.target_subjects?.length ? "x" : null,
  ].filter(Boolean).length
  const completeness = Math.round((filledFields / 5) * 100)

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading your scholarship profile…
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <GraduationCap className="h-5 w-5" />
              Scholarship matching profile
            </CardTitle>
            <CardDescription>
              Separate from your display profile above — this is what the Opportunities page uses to
              find scholarships you&apos;re actually eligible for.
            </CardDescription>
          </div>
          <Badge variant={completeness === 100 ? "default" : "secondary"}>{completeness}% complete</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="country">Country</Label>
            <Input
              id="country"
              placeholder="e.g. NG, US, GB (ISO code)"
              value={profile.country ?? ""}
              onChange={(e) => update("country", e.target.value.toUpperCase().slice(0, 2) || null)}
              maxLength={2}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="dob">Date of birth</Label>
            <Input
              id="dob"
              type="date"
              value={profile.date_of_birth ?? ""}
              onChange={(e) => update("date_of_birth", e.target.value || null)}
            />
          </div>

          <div className="space-y-2">
            <Label>Education level</Label>
            <Select
              value={profile.education_level ?? undefined}
              onValueChange={(v) => update("education_level", v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select level" />
              </SelectTrigger>
              <SelectContent>
                {EDUCATION_LEVELS.map((l) => (
                  <SelectItem key={l.value} value={l.value}>
                    {l.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Exam syllabus</Label>
            <Select value={profile.syllabus ?? undefined} onValueChange={(v) => update("syllabus", v)}>
              <SelectTrigger>
                <SelectValue placeholder="Select syllabus" />
              </SelectTrigger>
              <SelectContent>
                {SYLLABI.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Gender (optional)</Label>
            <Select value={profile.gender ?? undefined} onValueChange={(v) => update("gender", v)}>
              <SelectTrigger>
                <SelectValue placeholder="Prefer not to say" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="female">Female</SelectItem>
                <SelectItem value="male">Male</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Household income band (optional)</Label>
            <Select
              value={profile.household_income_band ?? undefined}
              onValueChange={(v) => update("household_income_band", v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select band" />
              </SelectTrigger>
              <SelectContent>
                {INCOME_BANDS.map((b) => (
                  <SelectItem key={b.value} value={b.value}>
                    {b.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Target subjects</Label>
          <div className="flex flex-wrap gap-2">
            {SUBJECT_OPTIONS.map((subject) => {
              const active = profile.target_subjects?.includes(subject)
              return (
                <button
                  key={subject}
                  type="button"
                  onClick={() => toggleSubject(subject)}
                  className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                    active
                      ? "border-primary bg-primary text-primary-foreground"
                      : "hover:bg-accent/40"
                  }`}
                >
                  {subject}
                </button>
              )
            })}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 pt-2">
          <Button onClick={save} disabled={saving}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Save scholarship profile
          </Button>
          {saved && (
            <span className="flex items-center gap-1.5 text-sm text-green-600 dark:text-green-500">
              <CheckCircle2 className="h-4 w-4" />
              Saved. Check the Opportunities page for matches.
            </span>
          )}
          {error && <span className="text-sm text-destructive">{error}</span>}
        </div>
      </CardContent>
    </Card>
  )
}

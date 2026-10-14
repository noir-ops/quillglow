"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeft, ArrowRight, Bookmark, CalendarDays, FileText, GraduationCap, Loader2, Target, UserRound, Users } from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { AwardHighlight, SponsorLogo } from "@/components/sprout/opportunity-card"
import { applicationActionLabel, applicationStatusLabel, formatDeadline, opportunityTypeLabel,
  type OpportunityApplication, type OpportunityDisplay } from "@/lib/opportunities/presentation"

interface Details extends OpportunityDisplay {
  countries: string[] | null
  education_level: string | null
  subjects: string[] | null
}

export function OpportunityDetails({ opportunityId }: { opportunityId: string }) {
  const router = useRouter()
  const [opportunity, setOpportunity] = useState<Details | null>(null)
  const [application, setApplication] = useState<OpportunityApplication | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async (signal?: AbortSignal) => {
    const res = await fetch(`/api/opportunities/detail/${opportunityId}`, { cache: "no-store", signal })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || "Could not load scholarship")
    if (signal?.aborted) return
    setOpportunity(data.opportunity)
    setApplication(data.application)
    setError(null)
  }, [opportunityId])

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    load(controller.signal).catch(e => { if (!controller.signal.aborted) setError(e.message) })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    const refresh = () => { if (document.visibilityState === "visible") load(controller.signal).catch(() => {}) }
    window.addEventListener("focus", refresh)
    document.addEventListener("visibilitychange", refresh)
    return () => {
      controller.abort()
      window.removeEventListener("focus", refresh)
      document.removeEventListener("visibilitychange", refresh)
    }
  }, [load])

  const apply = async () => {
    if (application && application.status !== "saved") {
      router.push(`/applications/${application.id}`)
      return
    }
    setBusy(true)
    try {
      const res = await fetch("/api/opportunities/applications/start", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ opportunityId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Could not start application")
      setApplication({ id: data.applicationId, status: "in_progress" })
      router.push(`/applications/${data.applicationId}`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not start application")
    } finally { setBusy(false) }
  }

  const save = async () => {
    setBusy(true)
    try {
      const res = await fetch("/api/opportunities/applications", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ opportunityId, status: "saved" }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Could not save scholarship")
      setApplication(data.application)
      toast.success("Saved for later")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save scholarship")
    } finally { setBusy(false) }
  }

  const cancel = async () => {
    if (!application) return
    const draft = application.status === "in_progress"
    if (!window.confirm(draft ? "Cancel this draft? Its saved answers will be deleted. This cannot be undone." : "Withdraw this application? Reviewers will no longer consider it.")) return
    setBusy(true)
    try {
      const res = await fetch(`/api/opportunities/applications/${application.id}${draft ? "" : "/withdraw"}`, { method: draft ? "DELETE" : "POST" })
      if (!res.ok) throw new Error((await res.json()).error || "Could not cancel application")
      await load()
      toast.success(draft ? "Draft application cancelled" : "Application withdrawn")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not cancel application")
    } finally { setBusy(false) }
  }

  if (loading) return <div className="flex items-center justify-center gap-3 py-20 text-base text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /> Loading scholarship details…</div>
  if (error || !opportunity) return (
    <Card><CardContent className="space-y-4 py-6"><h1 className="text-xl font-bold">Scholarship details unavailable</h1>
      <p className="text-base text-muted-foreground">{error || "This listing could not be found."}</p>
      <Button asChild variant="outline"><Link href="/opportunities?type=scholarship">Back to scholarships</Link></Button>
    </CardContent></Card>
  )

  const o = opportunity
  const isSaved = application?.status === "saved"
  const canCancel = application && ["in_progress", "submitted", "shortlisted"].includes(application.status)
  const purpose = o.purpose || (o.covers?.length ? `Supporting ${o.covers.map(c => c.replaceAll("_", " ")).join(", ")}.` : null)
  return (
    <div className="space-y-6 pb-6">
      <Link href={`/opportunities?type=${o.opportunity_type === "program" ? "program" : "scholarship"}`} className="inline-flex min-h-11 items-center gap-2 text-base font-semibold text-muted-foreground hover:text-primary">
        <ArrowLeft className="h-4 w-4" /> Back to {o.opportunity_type === "program" ? "programs" : "scholarships"}
      </Link>
      <Card className="gap-0 overflow-hidden rounded-3xl py-0">
        <div className="border-b border-primary/10 bg-gradient-to-br from-primary/10 via-secondary/60 to-card p-6 sm:p-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-4"><SponsorLogo opportunity={o} /><div>
              <p className="text-lg font-bold">{o.provider || "Sponsor not listed"}</p>
              <p className="mt-1 text-sm text-muted-foreground">Sponsor / Organization</p>
            </div></div>
            <Badge variant="outline" className="rounded-full bg-card px-4 py-2 text-sm">{opportunityTypeLabel(o.opportunity_type)}</Badge>
          </div>
          <div className="mt-8 grid gap-6 lg:grid-cols-[1.3fr_1fr] lg:items-end">
            <div><h1 className="text-2xl font-extrabold leading-tight tracking-tight sm:text-4xl">{o.title}</h1>
              {purpose && <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted-foreground">{purpose}</p>}
            </div>
            <div className="rounded-2xl border border-primary/10 bg-card/75 p-5 sm:p-6"><AwardHighlight opportunity={o} /></div>
          </div>
        </div>
        <div className="grid gap-4 p-6 text-base sm:grid-cols-2 sm:p-8 lg:grid-cols-3">
          <div className="flex items-start gap-3"><CalendarDays className="mt-1 h-5 w-5 shrink-0 text-primary" /><div><p className="text-sm text-muted-foreground">Due date</p><p className="mt-1 font-bold">{formatDeadline(o.deadline, o.is_rolling)}</p></div></div>
          <div className="flex items-start gap-3"><Users className="mt-1 h-5 w-5 shrink-0 text-primary" /><div><p className="text-sm text-muted-foreground">Potential awardees</p><p className="mt-1 font-bold">{o.potential_awardees ?? "Not specified by sponsor"}</p></div></div>
          <div className="flex items-start gap-3"><GraduationCap className="mt-1 h-5 w-5 shrink-0 text-primary" /><div><p className="text-sm text-muted-foreground">Scholarship type</p><p className="mt-1 font-bold">{opportunityTypeLabel(o.opportunity_type)}</p></div></div>
        </div>
      </Card>

      <div className="grid items-start gap-6 lg:grid-cols-[1.5fr_1fr]">
        <div className="space-y-6">
          <Card className="gap-0 rounded-3xl py-0"><CardContent className="p-6 sm:p-8">
            <h2 className="flex items-center gap-2 text-xl font-extrabold"><FileText className="h-5 w-5 text-primary" /> Summary</h2>
            <p className="mt-4 whitespace-pre-line break-words text-base leading-7 text-muted-foreground">{o.description || "The sponsor has not provided a summary yet. Review the listed requirements before applying."}</p>
          </CardContent></Card>
          <Card className="gap-0 rounded-3xl py-0"><CardContent className="space-y-5 p-6 sm:p-8">
            <h2 className="flex items-center gap-2 text-xl font-extrabold"><Target className="h-5 w-5 text-primary" /> At a glance</h2>
            <dl className="space-y-4 text-base">
              {purpose && <div><dt className="font-bold">Purpose</dt><dd className="mt-1 leading-relaxed text-muted-foreground">{purpose}</dd></div>}
              <div><dt className="font-bold">Requirements</dt><dd className="mt-1 leading-relaxed text-muted-foreground">{[o.requires_essay && "Essay", o.requires_recommendation && "Recommendation"].filter(Boolean).join(" · ") || "See the application form for required documents."}</dd></div>
              {o.education_level && <div><dt className="font-bold">Education level</dt><dd className="mt-1 capitalize text-muted-foreground">{o.education_level.replaceAll("_", " ")}</dd></div>}
              {o.countries?.length ? <div><dt className="font-bold">Countries listed</dt><dd className="mt-1 text-muted-foreground">{o.countries.join(", ")}</dd></div> : null}
              {o.subjects?.length ? <div><dt className="font-bold">Subject areas</dt><dd className="mt-1 text-muted-foreground">{o.subjects.join(", ")}</dd></div> : null}
            </dl>
          </CardContent></Card>
        </div>
        <div className="space-y-6 lg:sticky lg:top-6">
          <Card className="gap-0 rounded-3xl border-primary/20 py-0"><CardContent className="space-y-5 p-6">
            <div><h2 className="text-xl font-extrabold">Your application</h2>
              <Badge variant="secondary" className="mt-3 rounded-full px-3 py-1.5 text-sm">{applicationStatusLabel(application?.status)}</Badge>
            </div>
            <p className="text-base leading-relaxed text-muted-foreground">{!application || isSaved ? "Start when you're ready. Your answers are saved as you go." : application.status === "in_progress" ? "Pick up where you left off, or cancel your draft below." : "View your application for its latest progress and decision."}</p>
            <Button className="h-auto min-h-12 w-full gap-2 whitespace-normal rounded-xl px-4 py-3 text-base font-bold" onClick={apply} disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}{applicationActionLabel(application?.status)}
            </Button>
            {(!application || isSaved) && <Button variant="outline" className="h-12 w-full gap-2 rounded-xl text-base" onClick={save} disabled={busy || isSaved}><Bookmark className="h-4 w-4" />{isSaved ? "Saved for later" : "Save for later"}</Button>}
            {canCancel && <Button variant="outline" className="h-12 w-full rounded-xl border-destructive/30 text-base text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={cancel} disabled={busy}>{application.status === "in_progress" ? "Cancel application" : "Withdraw application"}</Button>}
          </CardContent></Card>
          <Card className="gap-0 rounded-3xl py-0"><CardContent className="p-6">
            <h2 className="flex items-center gap-2 text-xl font-extrabold"><UserRound className="h-5 w-5 text-primary" /> Guide</h2>
            {/* Family mentors are not scholarship-review assignments. No such
                assignment exists in the current schema; don't invent one. */}
            <p className="mt-3 text-base leading-relaxed text-muted-foreground">No application Guide assignment is available.</p>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">Guide and Mentor refer to the same role. Your family and mentor connections are separate from scholarship review assignments.</p>
          </CardContent></Card>
        </div>
      </div>
    </div>
  )
}

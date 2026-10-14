"use client"

import { useState } from "react"
import Link from "next/link"
import { ArrowRight, Bookmark, BookmarkCheck, CalendarDays, FileText, GraduationCap, Sparkles, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { applicationActionLabel, applicationStatusLabel, formatAward, formatDeadline, opportunityTypeLabel,
  type OpportunityCardData, type OpportunityDisplay } from "@/lib/opportunities/presentation"

export function SponsorLogo({ opportunity }: { opportunity: Pick<OpportunityDisplay, "provider" | "logo_url"> }) {
  const [failed, setFailed] = useState(false)
  const initials = (opportunity.provider || "Scholarship").split(/\s+/).filter(Boolean).slice(0, 2).map(s => s[0]).join("").toUpperCase()
  return (
    <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-primary/15 bg-card text-lg font-extrabold text-primary shadow-sm">
      {opportunity.logo_url && !failed
        ? <img src={opportunity.logo_url} alt={`${opportunity.provider || "Sponsor"} logo`} className="h-full w-full object-contain p-2" referrerPolicy="no-referrer" onError={() => setFailed(true)} />
        : <span aria-hidden="true">{initials}</span>}
    </div>
  )
}

export function AwardHighlight({ opportunity }: { opportunity: Pick<OpportunityDisplay, "award_amount" | "award_currency"> }) {
  const award = formatAward(opportunity.award_amount, opportunity.award_currency)
  return (
    <div>
      <p className="text-sm font-semibold text-primary">{award ? "Award available" : "Learning opportunity"}</p>
      <p className="mt-1 break-words text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl">{award || "Invest in your future"}</p>
      {award && <p className="mt-1 text-sm text-muted-foreground">{opportunity.award_currency || "USD"} · See scholarship details for terms</p>}
    </div>
  )
}

export function OpportunityCard({ opportunity: o, saving, starting, onSave, onApply }: {
  opportunity: OpportunityCardData
  saving: boolean
  starting: boolean
  onSave: () => void
  onApply: () => void
}) {
  const isSaved = o.application?.status === "saved"
  const hasApplication = !!o.application && !isSaved
  const score = Math.max(0, Math.min(100, Math.round(o.match_score)))
  const urgent = !o.is_rolling && o.reasons.days_left != null && o.reasons.days_left >= 0 && o.reasons.days_left <= 30
  const href = `/opportunities/${o.opportunity_id}`
  return (
    <Card className="group h-full gap-0 overflow-hidden rounded-3xl border-border py-0 shadow-sm transition-shadow hover:shadow-lg">
      <div className="relative space-y-5 border-b border-primary/10 bg-gradient-to-br from-primary/10 via-secondary/60 to-card p-5 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <SponsorLogo opportunity={o} />
            <div className="min-w-0">
              <p className="break-words text-base font-bold">{o.provider || "Sponsor not listed"}</p>
              <p className="mt-0.5 text-sm text-muted-foreground">{opportunityTypeLabel(o.opportunity_type)}</p>
            </div>
          </div>
          <Badge variant="secondary" className="shrink-0 gap-1 rounded-full bg-card px-3 py-1.5 text-sm font-semibold">
            <Sparkles className="h-3.5 w-3.5 text-primary" aria-hidden="true" /> {score}% match
          </Badge>
        </div>
        <AwardHighlight opportunity={o} />
      </div>
      <div className="flex flex-1 flex-col gap-5 p-5 sm:p-6">
        <div>
          {hasApplication && <Badge variant="secondary" className="mb-3 rounded-full px-3 py-1 text-sm">{applicationStatusLabel(o.application?.status)}</Badge>}
          <h2 className="text-xl font-extrabold leading-snug tracking-tight sm:text-2xl">
            <Link href={href} className="rounded-sm transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{o.title}</Link>
          </h2>
          {o.description && <p className="mt-3 line-clamp-3 text-base leading-relaxed text-muted-foreground">{o.description}</p>}
        </div>
        <div className="grid grid-cols-1 gap-3 rounded-2xl bg-muted/50 p-4 text-sm sm:grid-cols-2">
          <div className="flex items-start gap-2.5">
            <CalendarDays className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
            <div><p className="font-semibold">{formatDeadline(o.deadline, o.is_rolling)}</p>
              <p className={urgent ? "mt-0.5 font-medium text-destructive" : "mt-0.5 text-muted-foreground"}>
                {urgent ? (o.reasons.days_left === 0 ? "Closes today" : `${o.reasons.days_left} days left`) : "Application deadline"}
              </p>
            </div>
          </div>
          <div className="flex items-start gap-2.5">
            {o.potential_awardees ? <Users className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" /> : <GraduationCap className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />}
            <div><p className="font-semibold">{o.potential_awardees ? `${o.potential_awardees} potential awardee${o.potential_awardees === 1 ? "" : "s"}` : opportunityTypeLabel(o.opportunity_type)}</p>
              <p className="mt-0.5 text-muted-foreground">{o.potential_awardees ? "Listed by the sponsor" : "Opportunity type"}</p>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {o.requires_essay && <Badge variant="outline" className="gap-1.5 rounded-full px-3 py-1 text-sm"><FileText className="h-3.5 w-3.5" aria-hidden="true" /> Essay required</Badge>}
          {o.reasons.strong_concepts > 0 && <Badge variant="outline" className="rounded-full px-3 py-1 text-sm">{o.reasons.strong_concepts} matching strength{o.reasons.strong_concepts === 1 ? "" : "s"}</Badge>}
          {o.covers?.slice(0, 3).map(cover => <Badge key={cover} variant="outline" className="rounded-full px-3 py-1 text-sm capitalize">{cover.replaceAll("_", " ")}</Badge>)}
        </div>
        <div className="mt-auto space-y-3 border-t pt-5">
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button className="h-12 flex-1 gap-2 rounded-xl text-base font-bold" disabled={starting || saving} onClick={onApply}>
              {starting ? "Opening…" : applicationActionLabel(o.application?.status)} <ArrowRight className="h-4 w-4 shrink-0" aria-hidden="true" />
            </Button>
            {!hasApplication && <Button variant="outline" className="h-12 gap-2 rounded-xl px-4 text-base" disabled={saving || starting || isSaved} onClick={onSave}>
              {isSaved ? <BookmarkCheck className="h-4 w-4" aria-hidden="true" /> : <Bookmark className="h-4 w-4" aria-hidden="true" />}
              {saving ? "Saving…" : isSaved ? "Saved" : "Save"}
            </Button>}
          </div>
          <Link href={href} className="inline-flex min-h-9 items-center gap-1 text-sm font-semibold text-primary underline-offset-4 hover:underline">View full details <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" /></Link>
        </div>
      </div>
    </Card>
  )
}

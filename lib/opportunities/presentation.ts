/** Public display fields only. Never forward the full listing metadata to a student. */
export interface OpportunityDisplay {
  id: string
  title: string
  provider: string | null
  opportunity_type: string
  description: string | null
  award_amount: number | null
  award_currency: string | null
  deadline: string | null
  is_rolling: boolean | null
  covers: string[] | null
  requires_essay: boolean | null
  requires_recommendation: boolean | null
  logo_url: string | null
  purpose: string | null
  potential_awardees: number | null
}

export interface OpportunityApplication {
  id: string
  status: string
}

export interface OpportunityCardData extends OpportunityDisplay {
  opportunity_id: string
  match_score: number
  reasons: { strong_concepts: number; exam_readiness: number; days_left: number | null; subject_match: string[] | null }
  application: OpportunityApplication | null
}

export function publicListingExtras(metadata: unknown) {
  const data = metadata && typeof metadata === "object" && !Array.isArray(metadata)
    ? metadata as Record<string, unknown> : {}
  const rawLogo = typeof data.logo_url === "string" ? data.logo_url.trim() : ""
  let logo_url: string | null = null
  try {
    const url = new URL(rawLogo)
    if (url.protocol === "https:" && !url.username && !url.password) logo_url = url.href
  } catch { /* Missing or invalid logos use the sponsor's initials. */ }
  const count = data.potential_awardees
  return {
    logo_url,
    purpose: typeof data.purpose === "string" && data.purpose.trim() ? data.purpose.trim().slice(0, 500) : null,
    potential_awardees: typeof count === "number" && Number.isSafeInteger(count) && count > 0 ? count : null,
  }
}

export function formatAward(amount: number | null, currency: string | null = "USD") {
  if (amount == null || !Number.isFinite(Number(amount))) return null
  const code = (currency || "USD").toUpperCase()
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency", currency: code,
      maximumFractionDigits: Number.isInteger(Number(amount)) ? 0 : 2,
    }).format(Number(amount))
  } catch {
    return `${Number(amount).toLocaleString("en-US")} ${code}`
  }
}

export function formatDeadline(deadline: string | null, rolling?: boolean | null) {
  if (rolling) return "Rolling applications"
  if (!deadline) return "Deadline not listed"
  // Dates are date-only in Postgres. UTC keeps them from shifting a day by timezone.
  const date = new Date(`${deadline.slice(0, 10)}T00:00:00Z`)
  return Number.isNaN(date.getTime()) ? "Deadline not listed" : date.toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric", timeZone: "UTC",
  })
}

export function opportunityTypeLabel(type: string) {
  return ({ scholarship: "Scholarship", grant: "Grant", program: "STEAM program", competition: "Competition" } as Record<string, string>)[type] || "Opportunity"
}

export function applicationStatusLabel(status?: string | null) {
  return ({ saved: "Saved for later", in_progress: "In progress", submitted: "Submitted", shortlisted: "Under review",
    awarded: "Awarded", rejected: "Not successful", withdrawn: "Withdrawn" } as Record<string, string>)[status || ""] || "Not started"
}

export function applicationActionLabel(status?: string | null) {
  if (!status || status === "saved") return "Apply now"
  if (status === "in_progress") return "Continue application"
  return "View application"
}

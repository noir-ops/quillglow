import { redirect } from "next/navigation"

// Matches the spec's /explore/opportunities route. The real Opportunities
// workflow lives at /opportunities (inside the existing authenticated app
// shell) — this alias just gives it the canonical URL without duplicating
// the page.
export default function ExploreOpportunitiesPage() {
  redirect("/opportunities")
}
import { OpportunityList } from "@/components/sprout/opportunity-list"

export const metadata = { title: "Opportunities" }

/**
 * Two distinct views under Opportunities, each a real filtered list rather
 * than a duplicate of the section landing page:
 *   - Scholarships: opportunity_type in (scholarship, grant)
 *   - STEAM Programs: opportunity_type = program
 */
const VIEWS: Record<string, { heading: string; blurb: string; types: string }> = {
  scholarship: {
    heading: "Scholarships",
    blurb: "Available scholarships and grants matched to what you've actually mastered.",
    types: "scholarship,grant",
  },
  program: {
    heading: "STEAM Programs",
    blurb: "Programs and courses in STEM and AI, matched to what you've actually mastered.",
    types: "program",
  },
}

export default async function OpportunitiesPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>
}) {
  const { type } = await searchParams
  const view = (type && VIEWS[type]) || null

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{view?.heading ?? "Opportunities"}</h1>
        <p className="text-sm text-muted-foreground">
          {view?.blurb ?? "Scholarships and programs matched to what you've actually mastered."}
        </p>
      </div>
      <OpportunityList type={view?.types} />
      <p className="text-xs text-muted-foreground">
        Matches use your <a href="/profile" className="underline">scholarship matching profile</a> — keep it
        up to date to see more relevant results.
      </p>
    </div>
  )
}

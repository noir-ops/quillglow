import { OpportunityDetails } from "@/components/sprout/opportunity-details"

export const metadata = { title: "Scholarship Details | QuillGlow" }

export default async function OpportunityDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <OpportunityDetails opportunityId={id} />
}

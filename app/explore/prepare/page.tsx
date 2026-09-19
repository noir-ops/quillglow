import { redirect } from "next/navigation"

// Matches the spec's /explore/prepare route. The real Prepare workflow
// lives at /prepare (inside the existing authenticated app shell) — this
// alias just gives it the canonical URL without duplicating the page.
export default function ExplorePreparePage() {
  redirect("/prepare")
}
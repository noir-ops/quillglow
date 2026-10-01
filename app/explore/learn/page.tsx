import { redirect } from "next/navigation"

// Matches the spec's /explore/learn route. The real Learn workflow lives
// at /learn (inside the existing authenticated app shell) — this alias
// just gives it the canonical URL without duplicating the page.
export default function ExploreLearnPage() {
  redirect("/learn")
}
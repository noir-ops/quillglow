import { redirect } from "next/navigation"

/**
 * Stress Relief merged into the Focus page. Kept as a redirect so existing
 * links, bookmarks and any in-app references continue to work.
 */
export default function StressReliefPage() {
  redirect("/timer?tab=calm")
}

import { redirect } from "next/navigation"

/**
 * Browse has been merged into Study AI (/tutor).
 *
 * This route stays as a redirect rather than being deleted so old bookmarks
 * and the links inside the (still present) search history page keep working.
 * A `?q=` from those links is passed through and pre-fills the Study AI
 * search bar.
 */
export default async function SearchRedirect({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams
  redirect(q ? `/tutor?q=${encodeURIComponent(q)}` : "/tutor")
}

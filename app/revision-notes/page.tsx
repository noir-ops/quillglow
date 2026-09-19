import { redirect } from "next/navigation"

/**
 * Revision Notes merged into the Revision & Notes page. Kept as a redirect so
 * existing links, bookmarks and any in-app references continue to work.
 */
export default function RevisionNotesPage() {
  redirect("/notes?tab=revision")
}

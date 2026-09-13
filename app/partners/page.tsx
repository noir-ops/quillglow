import { redirect } from "next/navigation"

// The Partners page has been merged into /impact-partners — the community
// & creator partner directory now lives there as its own section, alongside
// the Impact Partner (funder/scholarship-sponsor) content. This alias just
// keeps old /partners links working.
export default function PartnersPage() {
  redirect("/impact-partners")
}
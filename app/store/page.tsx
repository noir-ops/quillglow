import { redirect } from "next/navigation"

// Spec (Section 6) calls for /store as the canonical Store route.
// The existing marketplace implementation lives at /shop — this alias
// keeps that implementation as the single source of truth and just
// forwards /store traffic to it, so nothing in /shop needs to change.
export default function StorePage() {
  redirect("/shop")
}
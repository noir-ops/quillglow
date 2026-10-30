import { Suspense } from "react"
import { redirect } from "next/navigation"
import Storefront from "@/components/store/storefront"
import { STORE_COMING_SOON, STORE_COMING_SOON_PATH } from "@/lib/store-status"

export default function ShopPage() {
  if (STORE_COMING_SOON) redirect(STORE_COMING_SOON_PATH)
  return <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading Store…</div>}><Storefront /></Suspense>
}

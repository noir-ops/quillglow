import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getActiveProvider } from "@/lib/payouts/registry"

export const dynamic = "force-dynamic"
export const revalidate = 3600 // catalogs barely change; cache an hour

/**
 * Provider-agnostic on purpose: Rail 1 now has more than one registered
 * provider (Tremendous, Runa), and which one is active is a runtime lookup
 * (disbursement_providers), not something this route should assume. Each
 * adapter's listProducts() does its own catalog curation internally — see
 * lib/payouts/providers/tremendous.ts for what that looks like.
 */
export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const provider = await getActiveProvider(1)
    if (!provider.listProducts) {
      return NextResponse.json({ error: `Rail 1 provider "${provider.key}" has no product catalog` }, { status: 502 })
    }
    const products = await provider.listProducts()
    return NextResponse.json({ products })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load reward catalog"
    return NextResponse.json({ error: message }, { status: 502 })
  }
}

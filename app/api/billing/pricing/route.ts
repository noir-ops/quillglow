import { NextResponse } from "next/server"
import { readBillingRollout, publicPricing } from "@/lib/billing/pricing"
export const dynamic = "force-dynamic"
export async function GET() {
  try { return NextResponse.json(publicPricing(await readBillingRollout()), { headers: { "Cache-Control": "no-store" } }) }
  catch { return NextResponse.json({ error: "Pricing is temporarily unavailable" }, { status: 503 }) }
}

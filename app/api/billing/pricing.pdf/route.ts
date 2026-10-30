import { createAdminClient } from "@/lib/supabase/admin"
import { readBillingRollout, publicPricing } from "@/lib/billing/pricing"
import { FEATURE_INFO } from "@/lib/billing/usage"
import { pricingPdf } from "@/lib/billing/pricing-pdf"
export const dynamic = "force-dynamic"
export const runtime = "nodejs"
export async function GET() {
  try {
    const admin = createAdminClient(), pricing = publicPricing(await readBillingRollout(admin))
    const { data, error } = await admin.from("plan_limits").select("plan_type,feature,monthly_limit")
    if (error || !data?.length) throw new Error("Allowances unavailable")
    const rows = Object.entries(FEATURE_INFO).map(([feature, info]) => ({ label: info!.label,
      scholar: data.find((r: any) => r.plan_type === "scholar" && r.feature === feature)?.monthly_limit ?? null,
      genius: data.find((r: any) => r.plan_type === "genius" && r.feature === feature)?.monthly_limit ?? null }))
    return new Response(new Uint8Array(pricingPdf(pricing, rows)), { headers: { "Content-Type": "application/pdf", "Content-Disposition": 'attachment; filename="quillglow-plans.pdf"', "Cache-Control": "no-store" } })
  } catch { return Response.json({ error: "Could not generate the current pricing sheet" }, { status: 503 }) }
}

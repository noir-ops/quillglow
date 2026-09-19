import { NextResponse } from "next/server"
import { getActiveProvider } from "@/lib/payouts/registry"
import type { DisbursementRail } from "@/lib/payouts/types"

export const dynamic = "force-dynamic"

/**
 * The one cross-app door into disbursement-provider credentials. Institutions
 * live in this app's database but are managed from the admin app, which has
 * no provider keys of its own — by design, only quillglow-main talks to
 * disbursement providers directly. The admin app calls this endpoint to get
 * an onboarding link rather than holding its own copy of any provider's
 * secret.
 *
 * Provider-agnostic: resolves whichever provider is active on the rail via
 * getActiveProvider() and calls its getOnboardingUrl(). This used to call
 * Stripe's client directly — that broke the moment more than one
 * onboarding-requiring provider (Stripe, Trolley) existed on the same
 * rail, since whichever was actually active might not be Stripe. Now a
 * provider switch in /admin/disbursements just works here too, with zero
 * change to this file.
 *
 * Protected by a shared secret (INTERNAL_API_SECRET), not user auth —
 * there's no student/benefactor session for an institution's finance
 * office, so this is server-to-server only.
 */
export async function POST(req: Request) {
  const secret = req.headers.get("x-internal-secret")
  if (!secret || secret !== process.env.INTERNAL_API_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await req.json().catch(() => null)
  const email = body?.email as string | undefined
  const name = body?.name as string | undefined
  const rail = Number(body?.rail) as DisbursementRail

  if (!email) {
    return NextResponse.json({ error: "email is required" }, { status: 400 })
  }
  if (rail !== 2 && rail !== 3) {
    return NextResponse.json({ error: "rail must be 2 or 3" }, { status: 400 })
  }

  try {
    const provider = await getActiveProvider(rail)
    if (!provider.getOnboardingUrl) {
      return NextResponse.json(
        { error: `Rail ${rail}'s active provider ("${provider.key}") doesn't require hosted onboarding` },
        { status: 400 },
      )
    }
    const url = await provider.getOnboardingUrl({ email, name })
    return NextResponse.json({ url })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to build onboarding link"
    return NextResponse.json({ error: message }, { status: 502 })
  }
}

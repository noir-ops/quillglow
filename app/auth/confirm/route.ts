import { NextResponse } from "next/server"
import type { EmailOtpType } from "@supabase/supabase-js"
import { createClient } from "@/lib/supabase/server"
import { safeAuthNext } from "@/lib/auth/redirect"
import { finalizeConfirmedReferral } from "@/lib/billing/referral"

export const dynamic = "force-dynamic"
export async function GET(request: Request) {
  const url = new URL(request.url)
  const token_hash = url.searchParams.get("token_hash")
  const type = url.searchParams.get("type")
  const supported = ["email", "signup", "recovery", "email_change", "invite", "magiclink"]
  if (token_hash && type && supported.includes(type)) {
    const supabase = await createClient()
    const { error } = await supabase.auth.verifyOtp({ token_hash, type: type as EmailOtpType })
    if (!error) {
      await finalizeConfirmedReferral(supabase).catch(error => console.error("[referral]", error))
      const fallback = type === "recovery" ? "/auth/reset-password" : type === "email_change" ? "/settings" : "/dashboard"
      return NextResponse.redirect(new URL(safeAuthNext(url.searchParams.get("next"), fallback), url.origin))
    }
  }
  return NextResponse.redirect(new URL("/auth/verify-email?expired=1", url.origin))
}

import { safeAuthNext } from "@/lib/auth/redirect"
import { finalizeConfirmedReferral } from "@/lib/billing/referral"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get("code")
  const origin = requestUrl.origin

  // Read referral code from cookie (set before Google OAuth redirect)
  // Query params are stripped by Google's OAuth flow so we use cookies instead
  const referralCookie = request.cookies.get("referral_code")
  const referralCode = referralCookie?.value || null
  

  if (code) {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
            } catch {
              // The `setAll` method was called from a Server Component.
              // This can be ignored if you have middleware refreshing user sessions.
            }
          },
        },
      },
    )

    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      // Check if user has a profile, if not create one
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (user) {
        
        const { data: profile } = await supabase.from("profiles").select("id, referred_by").eq("id", user.id).single()

        // Referral attribution is finalized by the existing server-only RPC below.

        if (!profile) {
          // Create profile for new OAuth user
          const displayName =
            user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split("@")[0] || "Student"

          await supabase.from("profiles").insert({
            id: user.id,
            display_name: displayName,
            avatar_id: "default",
            xp: 0,
            level: 1,
            streak_days: 0,
            referred_by: referralCode || null,
          })

          // Initialize usage tracking for free plan
          await supabase.from("usage_tracking").insert({
            user_id: user.id,
            tasks_created: 0,
            flashcards_created: 0,
            ai_generations_used: 0,
            exams_generated: 0,
          })
        }
      }

      await finalizeConfirmedReferral(supabase, referralCode).catch(error => console.error("[referral]", error))
      const response = NextResponse.redirect(`${origin}${safeAuthNext(requestUrl.searchParams.get("next"))}`)
      // Clear referral cookie now that it has been consumed
      response.cookies.set("referral_code", "", { path: "/", maxAge: 0 })
      return response
    }
  }

  // Return the user to an error page with instructions
  return NextResponse.redirect(`${origin}/auth/login?error=Authentication%20link%20is%20invalid%20or%20expired.%20Please%20request%20a%20new%20one.`)
}

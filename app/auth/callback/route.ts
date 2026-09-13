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
  
  console.log("[v0] OAuth callback - referral cookie:", referralCookie)
  console.log("[v0] OAuth callback - referral code:", referralCode)
  console.log("[v0] OAuth callback - all cookies:", request.cookies.getAll())

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
        console.log("[v0] OAuth callback - user ID:", user.id, "email:", user.email)
        
        const { data: profile } = await supabase.from("profiles").select("id, referred_by").eq("id", user.id).single()
        console.log("[v0] OAuth callback - existing profile:", profile)
        console.log("[v0] OAuth callback - referralCode for processing:", referralCode)

        // Track referral for BOTH new and existing users who haven't been referred yet
        if (referralCode && (!profile || !profile.referred_by)) {
          console.log("[v0] OAuth callback - attempting to track referral")
          try {
            const { data: ambassador, error: ambError } = await supabase
              .from("ambassadors")
              .select("id, user_id")
              .eq("referral_code", referralCode)
              .eq("status", "approved")
              .single()

            console.log("[v0] OAuth callback - ambassador lookup:", ambassador, "error:", ambError)

            if (ambassador && ambassador.user_id !== user.id) {
              const now = new Date().toISOString()

              // Check not already referred
              const { data: existing } = await supabase
                .from("referrals")
                .select("id")
                .eq("referred_user_id", user.id)
                .maybeSingle()

              console.log("[v0] OAuth callback - existing referral:", existing)

              if (!existing) {
                // Create referral record as verified immediately
                const { error: insertError } = await supabase.from("referrals").insert({
                  ambassador_id: ambassador.id,
                  referral_code: referralCode,
                  referred_user_id: user.id,
                  referred_email: user.email,
                  status: "verified",
                  verification_date: now,
                })

                console.log("[v0] OAuth callback - referral insert error:", insertError)

                if (!insertError) {
                  // Sync counts from referrals table
                  const { data: allReferrals } = await supabase
                    .from("referrals")
                    .select("id, status")
                    .eq("ambassador_id", ambassador.id)

                  const totalCount = allReferrals?.length || 1
                  const verifiedCount = allReferrals?.filter((r) => r.status === "verified").length || 1

                  await supabase
                    .from("ambassadors")
                    .update({
                      total_referrals: totalCount,
                      verified_referrals: verifiedCount,
                      updated_at: now,
                    })
                    .eq("id", ambassador.id)

                  // Update profile with referred_by
                  await supabase
                    .from("profiles")
                    .update({ referred_by: referralCode })
                    .eq("id", user.id)

                  console.log("[v0] OAuth callback - referral tracked successfully, total:", totalCount)
                }
              }
            }
          } catch (refError) {
            console.error("[v0] OAuth callback - Failed to track referral:", refError)
          }
        }

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

      const response = NextResponse.redirect(`${origin}/dashboard`)
      // Clear referral cookie now that it has been consumed
      response.cookies.set("referral_code", "", { path: "/", maxAge: 0 })
      return response
    }
  }

  // Return the user to an error page with instructions
  return NextResponse.redirect(`${origin}/auth/login?error=Could not authenticate with Google`)
}

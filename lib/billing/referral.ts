import { createAdminClient } from "@/lib/supabase/admin"

/** A signup code is a preference, not proof of a verified referral/reward. */
export async function finalizeConfirmedReferral(supabase: any, preferredCode?: string | null) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.email_confirmed_at) return
  const code = preferredCode || user.user_metadata?.referred_by
  const { error } = await createAdminClient().rpc("finalize_confirmed_referral", {
    p_user_id: user.id, p_code: typeof code === "string" && /^[A-Za-z0-9_-]{1,100}$/.test(code) ? code : null,
  })
  if (error) console.error("[referral] confirmation finalization failed:", error.message)
}

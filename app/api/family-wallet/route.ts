import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

/**
 * Every family wallet a linked adult has funded for this student. A
 * student can have more than one (e.g. both parents linked separately)
 * — each is spent from independently, never pooled, so it's always clear
 * whose money paid for what.
 */
export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data, error } = await supabase
    .from("family_wallets")
    .select("id, balance_cached, currency, trusted_adults:adult_user_id(full_name)")
    .eq("student_user_id", user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ familyWallets: data ?? [] })
}

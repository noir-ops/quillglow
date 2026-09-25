import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getTransactions, getWallet } from "@/lib/services/wallet"

export const dynamic = "force-dynamic"

/** Wallet balance + recent transactions. Read-only: money moves server-side. */
export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const [wallet, transactions] = await Promise.all([getWallet(user.id), getTransactions(user.id)])
  return NextResponse.json({ wallet, transactions })
}

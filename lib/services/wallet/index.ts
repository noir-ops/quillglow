/**
 * Wallet service — Platform Core (Milestone 2).
 *
 * The ledger is authoritative; the cached balance is a convenience. Money only
 * moves through `post_wallet_transaction`, which holds a row lock and enforces
 * idempotency — so a retried webhook cannot double-credit.
 */

import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"

export type TransactionType =
  | "scholarship_award"
  | "scholarship_disbursement"
  | "marketplace_purchase"
  | "refund"
  | "reward"
  | "adjustment"
  | "topup"

export interface PostTransactionInput {
  userId: string
  /** Positive credits, negative debits. */
  amount: number
  type: TransactionType
  description?: string
  referenceType?: string
  referenceId?: string
  /** Pass a stable key (e.g. webhook event id) to make retries safe. */
  idempotencyKey?: string
}

export async function getWallet(userId: string) {
  const supabase = await createClient()
  const { data } = await supabase.from("wallets").select("*").eq("user_id", userId).maybeSingle()
  return data
}

export async function getTransactions(userId: string, limit = 50) {
  const supabase = await createClient()
  const { data } = await supabase
    .from("wallet_transactions")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit)
  return data ?? []
}

export async function postTransaction(input: PostTransactionInput) {
  const admin = createAdminClient()
  const { data, error } = await admin.rpc("post_wallet_transaction", {
    p_user_id: input.userId,
    p_amount: input.amount,
    p_type: input.type,
    p_description: input.description ?? null,
    p_reference_type: input.referenceType ?? null,
    p_reference_id: input.referenceId ?? null,
    p_idempotency_key: input.idempotencyKey ?? null,
  })

  if (error) throw new Error(error.message)
  const row = Array.isArray(data) ? data[0] : data
  return {
    transactionId: row?.transaction_id as number,
    balance: Number(row?.balance ?? 0),
    duplicate: !!row?.duplicate,
  }
}

/** Rebuild the cached balance from the ledger. Use if a discrepancy is suspected. */
export async function reconcile(userId: string): Promise<number> {
  const admin = createAdminClient()
  const { data } = await admin.rpc("reconcile_wallet", { p_user_id: userId })
  return Number(data ?? 0)
}

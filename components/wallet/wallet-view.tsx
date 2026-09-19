"use client"

import { useCallback, useEffect, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ArrowDownLeft, ArrowUpRight, ExternalLink, Loader2, Wallet as WalletIcon } from "lucide-react"
import { RedeemDialog } from "./redeem-dialog"

interface WalletData {
  wallet: { balance_cached: number; currency: string } | null
  transactions: Array<{
    id: number
    amount: number
    balance_after: number
    type: string
    description: string | null
    created_at: string
  }>
}

interface PayoutOrder {
  id: string
  amount: number
  currency: string
  delivery_method: string
  rail: 1 | 2 | 3 | 4
  status: "pending" | "created" | "delivered" | "failed" | "cancelled"
  redemption_url: string | null
  failure_reason: string | null
  created_at: string
  institutions?: { name: string } | null
}

const TYPE_LABEL: Record<string, string> = {
  scholarship_award: "Scholarship award",
  scholarship_disbursement: "Scholarship disbursement",
  marketplace_purchase: "Purchase",
  refund: "Refund",
  reward: "Redemption",
  adjustment: "Adjustment",
  topup: "Top up",
}

const PAYOUT_STATUS_META: Record<PayoutOrder["status"], { label: string; variant: any }> = {
  pending: { label: "Processing", variant: "secondary" },
  created: { label: "Sent — check email", variant: "default" },
  delivered: { label: "Delivered", variant: "default" },
  failed: { label: "Failed — refunded", variant: "destructive" },
  cancelled: { label: "Cancelled", variant: "secondary" },
}

const RAIL_LABEL: Record<PayoutOrder["rail"], string> = {
  1: "Gift card",
  2: "Institution payment",
  3: "Bank transfer",
  4: "Blockchain (USDC)",
}

function payoutTitle(p: PayoutOrder): string {
  const amt = `$${p.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}`
  if (p.rail === 2) return `${amt} to ${p.institutions?.name ?? "your institution"}`
  if (p.rail === 3) return `${amt} bank transfer`
  if (p.rail === 4) return `${amt} USDC transfer`
  return `${amt} ${p.delivery_method === "gift_card" ? "gift card" : "prepaid card"}`
}

/**
 * Was previously nothing — only a backend API existed, no page rendered it.
 * Now shows the ledger balance, four redemption paths (gift card / paid to
 * institution / bank transfer / blockchain USDC — one per disbursement
 * rail), and every redemption request's status, regardless of which rail
 * or provider fulfilled it.
 */
export function WalletView() {
  const [data, setData] = useState<WalletData | null>(null)
  const [payouts, setPayouts] = useState<PayoutOrder[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const [walletRes, payoutRes] = await Promise.all([
      fetch("/api/wallet").then((r) => r.json()),
      fetch("/api/wallet/payout").then((r) => r.json()),
    ])
    setData(walletRes)
    setPayouts(payoutRes.payoutOrders ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    load().catch(() => setLoading(false))
  }, [load])

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  // Balance always comes straight from the ledger-backed wallet endpoint, so
  // it reflects the debit the instant a redemption is requested on any rail
  // — no separate "pending deduction" state to reconcile against.
  const balance = Number(data?.wallet?.balance_cached ?? 0)

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-4 sm:p-6">
      <div>
        <h1 className="text-2xl font-bold">Wallet</h1>
        <p className="text-sm text-muted-foreground">Scholarship payments and other funds land here.</p>
      </div>

      <Card className="border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/40">
        <CardContent className="flex flex-wrap items-center justify-between gap-4 p-6">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/15">
              <WalletIcon className="h-6 w-6 text-emerald-600" />
            </div>
            <div>
              <p className="text-sm text-emerald-800 dark:text-emerald-300">Balance</p>
              <p className="text-3xl font-bold text-emerald-900 dark:text-emerald-100">
                ${balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </p>
            </div>
          </div>
          <RedeemDialog balance={balance} onRedeemed={load} />
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        Redeem as a gift card or prepaid card, paid straight to your institution, as a bank transfer to you or a
        guardian, or as USDC to a wallet address — no bank account required for the gift card option.
      </p>

      <div className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Redemption history</h2>
        {payouts.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center text-sm text-muted-foreground">
              No redemptions yet. Hit Redeem above to turn your balance into a card, institution payment, or bank
              transfer.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {payouts.map((p) => {
              const meta = PAYOUT_STATUS_META[p.status]
              return (
                <Card key={p.id}>
                  <CardContent className="flex items-center justify-between gap-3 p-4">
                    <div>
                      <p className="text-sm font-medium">{payoutTitle(p)}</p>
                      <div className="mt-0.5 flex items-center gap-2">
                        <Badge variant="outline" className="text-[10px]">
                          {RAIL_LABEL[p.rail]}
                        </Badge>
                        <p className="text-xs text-muted-foreground">{new Date(p.created_at).toLocaleString()}</p>
                      </div>
                      {p.status === "failed" && p.failure_reason && (
                        <p className="mt-1 text-xs text-destructive">{p.failure_reason}</p>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1.5">
                      <Badge variant={meta.variant}>{meta.label}</Badge>
                      {p.redemption_url && (p.status === "created" || p.status === "delivered") && (
                        <a
                          href={p.redemption_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                        >
                          Claim card <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </div>

      <div className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Transaction history
        </h2>
        {!data?.transactions.length ? (
          <Card>
            <CardContent className="p-8 text-center text-sm text-muted-foreground">
              No transactions yet. A scholarship award will appear here as soon as a benefactor pays it.
            </CardContent>
          </Card>
        ) : (
          data.transactions.map((t) => {
            const isCredit = t.amount > 0
            return (
              <Card key={t.id}>
                <CardContent className="flex items-center justify-between gap-3 p-4">
                  <div className="flex items-center gap-3">
                    <div
                      className={`flex h-9 w-9 items-center justify-center rounded-full ${
                        isCredit ? "bg-emerald-500/15" : "bg-red-500/15"
                      }`}
                    >
                      {isCredit ? (
                        <ArrowDownLeft className="h-4 w-4 text-emerald-600" />
                      ) : (
                        <ArrowUpRight className="h-4 w-4 text-red-600" />
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-medium">
                        {t.description || TYPE_LABEL[t.type] || t.type}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(t.created_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`font-semibold ${isCredit ? "text-emerald-600" : "text-red-600"}`}>
                      {isCredit ? "+" : ""}${Math.abs(t.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </p>
                    <Badge variant="outline" className="mt-0.5 text-[10px]">
                      {TYPE_LABEL[t.type] ?? t.type}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            )
          })
        )}
      </div>
    </div>
  )
}

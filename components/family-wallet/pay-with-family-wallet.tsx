"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2, Wallet } from "lucide-react"

interface FamilyWallet {
  id: string
  balance_cached: number
  currency: string
  trusted_adults: { full_name: string } | null
}

/**
 * Drop-in "pay with family balance" option, used on both /upgrade and the
 * shop. Only renders anything if the student actually has a family
 * wallet with a positive balance — a student with no family link (the
 * common case) sees nothing extra here at all.
 */
export function PayWithFamilyWallet({
  chargeEndpoint,
  chargeBody,
  onSuccess,
  label,
}: {
  chargeEndpoint: string
  chargeBody: Record<string, unknown>
  onSuccess: (data: any) => void
  label: string
}) {
  const [wallets, setWallets] = useState<FamilyWallet[]>([])
  const [selected, setSelected] = useState<string>("")
  const [loading, setLoading] = useState(true)
  const [paying, setPaying] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch("/api/family-wallet")
      .then((r) => r.json())
      .then((d) => {
        const usable = (d.familyWallets ?? []).filter((w: FamilyWallet) => Number(w.balance_cached) > 0)
        setWallets(usable)
        if (usable.length) setSelected(usable[0].id)
      })
      .finally(() => setLoading(false))
  }, [])

  const pay = async () => {
    if (!selected) return
    setPaying(true)
    setError(null)
    try {
      const res = await fetch(chargeEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ familyWalletId: selected, ...chargeBody }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Payment failed")
      onSuccess(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Payment failed")
    } finally {
      setPaying(false)
    }
  }

  if (loading) return null
  if (wallets.length === 0) return null

  return (
    <div className="space-y-2 rounded-lg border border-dashed p-3">
      <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <Wallet className="h-3.5 w-3.5" /> Or pay with a family balance
      </p>
      {wallets.length > 1 ? (
        <Select value={selected} onValueChange={setSelected}>
          <SelectTrigger className="h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {wallets.map((w) => (
              <SelectItem key={w.id} value={w.id}>
                {w.trusted_adults?.full_name ?? "Family"} — ${Number(w.balance_cached).toFixed(2)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : (
        <p className="text-xs text-muted-foreground">
          {wallets[0].trusted_adults?.full_name ?? "Family"} — ${Number(wallets[0].balance_cached).toFixed(2)}{" "}
          available
        </p>
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}
      <Button size="sm" variant="secondary" onClick={pay} disabled={paying} className="w-full">
        {paying && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
        {label}
      </Button>
    </div>
  )
}

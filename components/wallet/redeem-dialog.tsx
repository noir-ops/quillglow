"use client"

import { useEffect, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2, Gift, CreditCard, ShoppingBag, Play, Smartphone, Landmark, Banknote, ExternalLink, Coins } from "lucide-react"
import { cn } from "@/lib/utils"

interface Product {
  id: string
  name: string
  category: string
}

interface Institution {
  id: string
  name: string
  country: string | null
}

const PRODUCT_ICON: Record<string, typeof CreditCard> = {
  "Virtual Prepaid Visa": CreditCard,
  "Amazon eGift Card": ShoppingBag,
  "Google Play eGift Card": Play,
  "Apple eGift Card": Smartphone,
}

/**
 * Rail-2/3 failures can include an onboarding link when the recipient
 * hasn't finished payout setup yet — the domain depends on which
 * provider is currently active (Stripe Connect or Trolley; only one is
 * ever active at a time, per rail). Matching both, rather than
 * hardcoding one, is what keeps this UI provider-agnostic the same way
 * the backend already is — a provider switch in /admin/disbursements
 * shouldn't require a matching change here.
 */
function extractOnboardingUrl(message: string): string | null {
  const match = message.match(/https:\/\/(connect\.stripe\.com|widget\.trolley\.com)\S*/)
  return match ? match[0] : null
}

/**
 * Four ways to redeem the same wallet balance, one per rail:
 *   Rail 1 — gift card / prepaid card (self-serve, instant)
 *   Rail 2 — paid straight to your institution (tuition/fees)
 *   Rail 3 — bank transfer / cash, to you or a named guardian
 *   Rail 4 — USDC to a wallet address you control (future-use rail —
 *            see the note in /api/wallet/payout/stablecoin about Circle
 *            not having production credentials configured yet)
 * Each tab hits a different route, but they all debit the same ledger and
 * show up together in Redemption history below.
 */
export function RedeemDialog({ balance, onRedeemed }: { balance: number; onRedeemed: () => void }) {
  const [open, setOpen] = useState(false)

  // Rail 1 state
  const [products, setProducts] = useState<Product[]>([])
  const [loadingProducts, setLoadingProducts] = useState(false)
  const [productId, setProductId] = useState<string>("")

  // Rail 2 state
  const [institutions, setInstitutions] = useState<Institution[]>([])
  const [loadingInstitutions, setLoadingInstitutions] = useState(false)
  const [institutionId, setInstitutionId] = useState<string>("")

  // Rail 3 state
  const [bankEmail, setBankEmail] = useState("")
  const [bankName, setBankName] = useState("")

  // Rail 4 state
  const [walletAddress, setWalletAddress] = useState("")
  const [chain, setChain] = useState("ETH")

  const [amount, setAmount] = useState<string>("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setLoadingProducts(true)
    fetch("/api/wallet/payout/products")
      .then((r) => r.json())
      .then((d) => setProducts(d.products ?? []))
      .catch(() => setProducts([]))
      .finally(() => setLoadingProducts(false))

    setLoadingInstitutions(true)
    fetch("/api/institutions")
      .then((r) => r.json())
      .then((d) => setInstitutions(d.institutions ?? []))
      .catch(() => setInstitutions([]))
      .finally(() => setLoadingInstitutions(false))
  }, [open])

  const resetMessages = () => {
    setError(null)
    setSuccess(null)
  }

  const handleSuccess = () => {
    setSuccess("Sent! Check the recipient email for confirmation.")
    setAmount("")
    setProductId("")
    setInstitutionId("")
    setBankEmail("")
    setBankName("")
    onRedeemed()
  }

  const validateAmount = () => {
    const amt = Number(amount)
    if (!amt || amt <= 0) {
      setError("Enter a valid amount")
      return null
    }
    if (amt > balance) {
      setError("Amount exceeds your available balance")
      return null
    }
    return amt
  }

  const submitGiftCard = async () => {
    resetMessages()
    const amt = validateAmount()
    if (!amt) return
    if (!productId) return setError("Choose a card")
    const product = products.find((p) => p.id === productId)
    const deliveryMethod = product?.category === "gift_card" ? "gift_card" : "reward"

    setSubmitting(true)
    try {
      const res = await fetch("/api/wallet/payout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: amt,
          deliveryMethod,
          productId,
          idempotencyKey: `payout:${Date.now()}:${Math.random().toString(36).slice(2)}`,
        }),
      })
      const data = await res.json()
      if (!res.ok) setError(data.error ?? "Redemption failed")
      else handleSuccess()
    } catch {
      setError("Something went wrong. Try again.")
    } finally {
      setSubmitting(false)
    }
  }

  const submitInstitutional = async () => {
    resetMessages()
    const amt = validateAmount()
    if (!amt) return
    if (!institutionId) return setError("Choose your institution")

    setSubmitting(true)
    try {
      const res = await fetch("/api/wallet/payout/institutional", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: amt,
          institutionId,
          idempotencyKey: `payout:${Date.now()}:${Math.random().toString(36).slice(2)}`,
        }),
      })
      const data = await res.json()
      if (!res.ok) setError(data.error ?? "Payment failed")
      else handleSuccess()
    } catch {
      setError("Something went wrong. Try again.")
    } finally {
      setSubmitting(false)
    }
  }

  const submitBankTransfer = async () => {
    resetMessages()
    const amt = validateAmount()
    if (!amt) return
    if (!bankEmail) return setError("Enter a recipient email (yours or your guardian's)")

    setSubmitting(true)
    try {
      const res = await fetch("/api/wallet/payout/recipient", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: amt,
          recipientEmail: bankEmail,
          recipientName: bankName || undefined,
          idempotencyKey: `payout:${Date.now()}:${Math.random().toString(36).slice(2)}`,
        }),
      })
      const data = await res.json()
      if (!res.ok) setError(data.error ?? "Transfer failed")
      else handleSuccess()
    } catch {
      setError("Something went wrong. Try again.")
    } finally {
      setSubmitting(false)
    }
  }

  const submitBlockchain = async () => {
    resetMessages()
    const amt = validateAmount()
    if (!amt) return
    if (!walletAddress.trim()) return setError("Enter a destination wallet address")

    setSubmitting(true)
    try {
      const res = await fetch("/api/wallet/payout/stablecoin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: amt,
          walletAddress: walletAddress.trim(),
          chain,
          idempotencyKey: `payout:${Date.now()}:${Math.random().toString(36).slice(2)}`,
        }),
      })
      const data = await res.json()
      if (!res.ok) setError(data.error ?? "Transfer failed")
      else {
        handleSuccess()
        setWalletAddress("")
      }
    } catch {
      setError("Something went wrong. Try again.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) resetMessages()
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm" disabled={balance <= 0}>
          <Gift className="mr-2 h-4 w-4" />
          Redeem
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Redeem your balance</DialogTitle>
          <DialogDescription>
            ${balance.toLocaleString(undefined, { minimumFractionDigits: 2 })} available. Choose how you'd like to
            receive it.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="giftcard" onValueChange={resetMessages} className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="giftcard" className="text-xs">
              Gift Card
            </TabsTrigger>
            <TabsTrigger value="institution" className="text-xs">
              Institution
            </TabsTrigger>
            <TabsTrigger value="bank" className="text-xs">
              Bank Transfer
            </TabsTrigger>
            <TabsTrigger value="blockchain" className="text-xs">
              Blockchain
            </TabsTrigger>
          </TabsList>

          <div className="space-y-4 pt-4">
            <div className="space-y-1.5">
              <Label htmlFor="amount">Amount (USD)</Label>
              <Input
                id="amount"
                type="number"
                min={1}
                max={balance}
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="25.00"
              />
            </div>

            <TabsContent value="giftcard" className="mt-0 space-y-3">
              <p className="text-xs text-muted-foreground">
                A prepaid Visa card or gift card, sent to your email. No bank account needed. Works worldwide.
              </p>
              <div className="space-y-1.5">
                <Label>Choose a card</Label>
                {loadingProducts ? (
                  <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" /> Loading options…
                  </div>
                ) : products.length === 0 ? (
                  <p className="py-6 text-sm text-muted-foreground">No card options configured yet.</p>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    {products.map((p) => {
                      const Icon = PRODUCT_ICON[p.name] ?? Gift
                      const selected = productId === p.id
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => setProductId(p.id)}
                          className={cn(
                            "flex flex-col items-center gap-2 rounded-lg border p-3 text-center text-xs font-medium transition-colors",
                            selected
                              ? "border-primary bg-primary/5 text-foreground"
                              : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground",
                          )}
                        >
                          <Icon className={cn("h-6 w-6", selected ? "text-primary" : "text-muted-foreground")} />
                          <span className="leading-tight">{p.name}</span>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              {success && <p className="text-sm text-emerald-600">{success}</p>}
              <Button onClick={submitGiftCard} disabled={submitting || products.length === 0} className="w-full">
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Redeem as gift card
              </Button>
            </TabsContent>

            <TabsContent value="institution" className="mt-0 space-y-3">
              <p className="text-xs text-muted-foreground">
                Paid directly to your school — never touches your hands. For tuition, fees, or books.
              </p>
              <div className="space-y-1.5">
                <Label>Your institution</Label>
                {loadingInstitutions ? (
                  <div className="flex items-center gap-2 py-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" /> Loading…
                  </div>
                ) : institutions.length === 0 ? (
                  <p className="py-2 text-sm text-muted-foreground">
                    No institutions are set up yet — ask your program admin to add one.
                  </p>
                ) : (
                  <Select value={institutionId} onValueChange={setInstitutionId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select your institution" />
                    </SelectTrigger>
                    <SelectContent>
                      {institutions.map((i) => (
                        <SelectItem key={i.id} value={i.id}>
                          <div className="flex items-center gap-2">
                            <Landmark className="h-4 w-4" />
                            {i.name}
                            {i.country ? ` — ${i.country}` : ""}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
              {error && (
                <p className="text-sm text-destructive">
                  {extractOnboardingUrl(error)
                    ? "Your institution hasn't finished payout setup on their end yet — ask your program admin to follow up with their finance office."
                    : error}
                </p>
              )}
              {success && <p className="text-sm text-emerald-600">{success}</p>}
              <Button
                onClick={submitInstitutional}
                disabled={submitting || institutions.length === 0}
                className="w-full"
              >
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Pay my institution
              </Button>
            </TabsContent>

            <TabsContent value="bank" className="mt-0 space-y-3">
              <p className="text-xs text-muted-foreground">
                Real cash, by bank transfer — to you or a named guardian. The recipient may need to verify their
                identity with our payout partner before claiming funds.
              </p>
              <div className="space-y-1.5">
                <Label htmlFor="bankEmail">Recipient email</Label>
                <Input
                  id="bankEmail"
                  type="email"
                  value={bankEmail}
                  onChange={(e) => setBankEmail(e.target.value)}
                  placeholder="you@example.com or guardian@example.com"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="bankName">Recipient name (optional)</Label>
                <Input
                  id="bankName"
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  placeholder="Full name"
                />
              </div>
              {error && (
                <div className="space-y-2">
                  <p className="text-sm text-destructive">
                    {extractOnboardingUrl(error)
                      ? "You need to add a payout method before this can be sent."
                      : error}
                  </p>
                  {extractOnboardingUrl(error) && (
                    <a href={extractOnboardingUrl(error)!} target="_blank" rel="noopener noreferrer">
                      <Button type="button" size="sm" variant="outline" className="w-full">
                        Complete payout setup <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
                      </Button>
                    </a>
                  )}
                </div>
              )}
              {success && <p className="text-sm text-emerald-600">{success}</p>}
              <Button onClick={submitBankTransfer} disabled={submitting} className="w-full">
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <Banknote className="mr-2 h-4 w-4" />
                Send bank transfer
              </Button>
            </TabsContent>

            <TabsContent value="blockchain" className="mt-0 space-y-3">
              <p className="text-xs text-muted-foreground">
                USDC sent directly to a wallet address you control. Irreversible once sent — double-check the
                address and network before confirming.
              </p>
              <div className="space-y-1.5">
                <Label htmlFor="walletAddress">Destination wallet address</Label>
                <Input
                  id="walletAddress"
                  value={walletAddress}
                  onChange={(e) => setWalletAddress(e.target.value)}
                  placeholder="0x..."
                  className="font-mono text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Network</Label>
                <Select value={chain} onValueChange={setChain}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ETH">Ethereum</SelectItem>
                    <SelectItem value="BASE">Base</SelectItem>
                    <SelectItem value="MATIC">Polygon</SelectItem>
                    <SelectItem value="SOL">Solana</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              {success && <p className="text-sm text-emerald-600">{success}</p>}
              <Button onClick={submitBlockchain} disabled={submitting} className="w-full">
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <Coins className="mr-2 h-4 w-4" />
                Send USDC
              </Button>
            </TabsContent>
          </div>
        </Tabs>

        <DialogFooter />
      </DialogContent>
    </Dialog>
  )
}

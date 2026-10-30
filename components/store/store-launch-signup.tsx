"use client"
import { useEffect, useState } from "react"
import Link from "next/link"
import { Bell, CheckCircle2, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"

interface SignupStatus { email: string; verified: boolean; subscribed: boolean }
export function StoreLaunchSignup() {
  const [status, setStatus] = useState<SignupStatus | null>(null)
  const [guest, setGuest] = useState(false)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [consent, setConsent] = useState(false)
  const [error, setError] = useState("")
  useEffect(() => {
    let ignore = false
    fetch("/api/store/notifications", { cache: "no-store" }).then(async (response) => {
      if (response.status === 401) { if (!ignore) setGuest(true); return }
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Could not load your notification signup")
      if (!ignore) setStatus(data)
    }).catch((e) => { if (!ignore) setError(e.message) }).finally(() => { if (!ignore) setLoading(false) })
    return () => { ignore = true }
  }, [])
  async function save(subscribed: boolean) {
    setBusy(true); setError("")
    try {
      const response = await fetch("/api/store/notifications", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ subscribed }) })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Could not save your signup")
      setStatus(data); setConsent(false)
    } catch (e) { setError(e instanceof Error ? e.message : "Please try again") }
    finally { setBusy(false) }
  }
  return <div className="rounded-2xl border bg-card p-6 text-left shadow-sm space-y-4">
    {loading ? <p className="flex items-center justify-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Loading…</p> : guest ? <>
      <h2 className="text-lg font-semibold">Be the first to know</h2>
      <p className="text-sm text-muted-foreground">Use your free QuillGlow account to sign up for a Store launch email.</p>
      <div className="flex flex-wrap gap-3"><Button asChild><Link href="/auth/login?next=/store/coming-soon">Sign in to get notified</Link></Button><Button asChild variant="outline"><Link href="/auth/signup">Create an account</Link></Button></div>
    </> : status && !status.verified ? <>
      <h2 className="font-semibold">Verify your email first</h2>
      <p className="text-sm text-muted-foreground">Confirm your QuillGlow email before signing up for Store updates.</p>
      <Button asChild variant="outline"><Link href="/auth/verify-email">Verify email</Link></Button>
    </> : status?.subscribed ? <>
      <p role="status" className="flex items-center gap-2 font-semibold text-primary"><CheckCircle2 className="h-5 w-5" />You're on the list</p>
      <p className="text-sm text-muted-foreground">We'll notify your QuillGlow account email, {status.email}, when the Store opens. You can cancel here at any time.</p>
      <Button variant="outline" disabled={busy} onClick={() => save(false)}>{busy ? "Saving…" : "Cancel launch notifications"}</Button>
    </> : status ? <>
      <h2 className="text-lg font-semibold">Get a launch notification</h2>
      <p className="text-sm text-muted-foreground">Send the update to {status.email}.</p>
      <label className="flex items-start gap-3 text-sm"><Checkbox checked={consent} onCheckedChange={(v) => setConsent(v === true)} disabled={busy} className="mt-0.5" /><span>I agree to receive an email when the QuillGlow Store launches.</span></label>
      <Button className="w-full" disabled={busy || !consent} onClick={() => save(true)}><Bell className="mr-2 h-4 w-4" />{busy ? "Saving…" : "Notify me when it opens"}</Button>
    </> : null}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
  </div>
}

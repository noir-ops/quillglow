"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Mail } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export default function VerifyEmailPage() {
  const [email, setEmail] = useState("")
  const [token, setToken] = useState("")
  const [busy, setBusy] = useState(false)
  const [cooldown, setCooldown] = useState(0)
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")
  const router = useRouter()
  useEffect(() => {
    setEmail(sessionStorage.getItem("verification_email") || "")
    if (new URLSearchParams(window.location.search).has("expired")) setError("This link is invalid or expired. Request a new email below.")
  }, [])
  useEffect(() => {
    if (cooldown <= 0) return
    const timer = setTimeout(() => setCooldown((n) => n - 1), 1000)
    return () => clearTimeout(timer)
  }, [cooldown])

  async function resend() {
    if (busy || cooldown > 0) return
    setBusy(true); setError(""); setMessage("")
    try {
      const { error } = await createClient().auth.resend({ type: "signup", email: email.trim(),
        options: { emailRedirectTo: `${window.location.origin}/auth/callback` } })
      if (error) throw error
      setMessage("If this address has an unconfirmed account, a new verification email has been requested. Check your inbox and spam folder.")
      setCooldown(60)
    } catch (e) { setError(e instanceof Error ? e.message : "Could not request the email. Please try again.") }
    finally { setBusy(false) }
  }
  async function verify(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError(""); setMessage("")
    try {
      const { error } = await createClient().auth.verifyOtp({ email: email.trim(), token: token.trim(), type: "signup" })
      if (error) throw error
      await fetch("/api/ambassador/finalize-referral", { method: "POST" }).catch(() => {})
      sessionStorage.removeItem("verification_email")
      router.replace("/dashboard"); router.refresh()
    } catch (e) { setError(e instanceof Error ? e.message : "Verification failed") }
    finally { setBusy(false) }
  }
  return (
    <div className="flex min-h-screen w-full items-center justify-center p-6 bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
      <Card className="w-full max-w-md border-2">
        <CardHeader className="space-y-4 text-center">
          <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center"><Mail className="w-8 h-8 text-primary" /></div>
          <CardTitle className="text-2xl font-bold">Check Your Email</CardTitle>
          <CardDescription>Confirm your account using the link or code in your verification email. Any email provider is supported.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Label htmlFor="verification-email">Email address</Label>
          <Input id="verification-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
          <Button type="button" variant="outline" className="w-full" disabled={busy || cooldown > 0 || !email.trim()} onClick={resend}>
            {cooldown > 0 ? `Resend in ${cooldown}s` : busy ? "Please wait…" : "Resend verification email"}
          </Button>
          <form onSubmit={verify} className="space-y-3">
            <Label htmlFor="verification-code">Verification code</Label>
            <Input id="verification-code" value={token} onChange={(e) => setToken(e.target.value)} inputMode="numeric" autoComplete="one-time-code" placeholder="Code from your email" required />
            <Button className="w-full" disabled={busy || !email.trim() || !token.trim()}>Verify email</Button>
          </form>
          {message && <p role="status" className="text-sm text-green-700">{message}</p>}
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <p className="text-center text-sm text-muted-foreground">Check spam or junk if the message is missing. <Link href="/auth/login" className="text-primary hover:underline">Back to sign in</Link></p>
        </CardContent>
      </Card>
    </div>
  )
}

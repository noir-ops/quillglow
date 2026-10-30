"use client"

import { useEffect, useState } from "react"
import { CheckCircle2, LifeBuoy, Loader2, Send } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { createBrowserClient } from "@/lib/supabase/client"
import { toast } from "sonner"

const TOPICS = ["Account & login", "Billing & subscription", "Bug or technical problem", "Feature request", "Scholarships & applications", "Other"]
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * Contact support from Settings. Replaces the floating chat bubble as the
 * signed-in way to reach a human. Tickets are saved to contact_messages —
 * the same place the bubble saved them — so they appear in the admin
 * panel's Contacts page as before. (Logged-out visitors use /contact.)
 */
export function SupportTicketCard() {
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [topic, setTopic] = useState(TOPICS[0])
  const [subject, setSubject] = useState("")
  const [message, setMessage] = useState("")
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ticket, setTicket] = useState<{ number: string; email: string } | null>(null)

  // Pre-fill from the signed-in account.
  useEffect(() => {
    const supabase = createBrowserClient()
    supabase.auth.getUser().then(async ({ data }) => {
      const user = data.user
      if (!user) return
      setEmail((e) => e || user.email || "")
      const { data: profile } = await supabase.from("profiles").select("display_name").eq("id", user.id).maybeSingle()
      setName((n) => n || profile?.display_name || "")
    })
  }, [])

  const submit = async () => {
    setError(null)
    if (!name.trim() || !subject.trim() || message.trim().length < 10 || !EMAIL_RE.test(email.trim())) {
      setError("Please fill in your name, a valid email, a subject, and a message of at least 10 characters.")
      return
    }
    setSending(true)
    try {
      const res = await fetch("/api/chatbot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supportTicket: {
            name: name.trim(),
            email: email.trim(),
            // The topic is folded into the subject so the team can triage from
            // the Contacts list without a schema change.
            subject: `[${topic}] ${subject.trim()}`,
            message: message.trim(),
          },
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.ticketNumber) throw new Error(data.error || "Could not submit your ticket")
      setTicket({ number: data.ticketNumber, email: email.trim() })
      setSubject("")
      setMessage("")
      toast.success(`Ticket ${data.ticketNumber} submitted`)
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not submit your ticket"
      setError(`${msg}. You can also email support@quillglow.com.`)
    } finally {
      setSending(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <LifeBuoy className="h-5 w-5" />
          Contact Support
        </CardTitle>
        <CardDescription>Submit a ticket and our team will reply by email within 24 hours</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {ticket && (
          <div role="status" className="flex items-start gap-3 rounded-lg border border-green-500/40 bg-green-50 p-3 text-sm dark:bg-green-950/20">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-green-600" />
            <div className="space-y-0.5">
              <p className="font-semibold text-green-800 dark:text-green-300">
                Ticket <span className="font-mono">{ticket.number}</span> submitted
              </p>
              <p className="text-green-800/80 dark:text-green-300/80">
                We&apos;ll reply to {ticket.email} within 24 hours. Keep your ticket number for reference.
              </p>
            </div>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="support-name">Name</Label>
            <Input id="support-name" value={name} maxLength={120} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="support-email">Reply-to email</Label>
            <Input id="support-email" type="email" value={email} maxLength={200} onChange={(e) => setEmail(e.target.value)} />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="support-topic">Topic</Label>
          <select
            id="support-topic"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            className="h-10 w-full rounded-md border bg-background px-3 text-sm"
          >
            {TOPICS.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="support-subject">Subject</Label>
          <Input id="support-subject" value={subject} maxLength={160} placeholder="What's this about?" onChange={(e) => setSubject(e.target.value)} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="support-message">Message</Label>
          <Textarea
            id="support-message"
            value={message}
            maxLength={5000}
            rows={5}
            placeholder="Describe the issue — what you were doing, what you expected, and what happened instead."
            onChange={(e) => setMessage(e.target.value)}
          />
        </div>

        {error && (
          <p role="alert" className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </p>
        )}

        <Button onClick={submit} disabled={sending} className="gap-2">
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          Submit ticket
        </Button>
      </CardContent>
    </Card>
  )
}

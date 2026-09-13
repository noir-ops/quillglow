"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog"
import { AppLayout } from "@/components/dashboard/app-layout"
import { Users, UserPlus, Copy, Check, X, Loader2 } from "lucide-react"

interface GuardianLink {
  id: string
  link_type: "family" | "mentor"
  status: string
  created_at: string
  trusted_adults: { full_name: string; contact_email: string } | null
}

/**
 * Where a student links a family member or mentor's account. Same invite
 * code either side can generate/redeem — a code from here works on
 * quillglow_guardian-main and vice versa (both call the same
 * create_guardian_link_invite / accept_guardian_link_invite RPCs, 044).
 */
function InviteDialog({ linkType, onLinked }: { linkType: "family" | "mentor"; onLinked: () => void }) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [code, setCode] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const generate = async () => {
    setLoading(true)
    setError(null)
    const res = await fetch("/api/guardian-links/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ linkType }),
    })
    const data = await res.json()
    if (!res.ok) setError(data.error ?? "Failed to create invite")
    else setCode(data.inviteCode)
    setLoading(false)
  }

  const copy = () => {
    if (!code) return
    navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) {
          setCode(null)
          setError(null)
          onLinked()
        }
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <UserPlus className="mr-1.5 h-3.5 w-3.5" />
          Invite {linkType === "family" ? "a family member" : "a mentor"}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{linkType === "family" ? "Invite family" : "Invite a mentor"}</DialogTitle>
          <DialogDescription>
            Generate a code and share it with them — they redeem it from their own account to complete the link.
          </DialogDescription>
        </DialogHeader>
        {!code ? (
          <Button onClick={generate} disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Generate invite code
          </Button>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center justify-between rounded-md border bg-muted/40 px-4 py-3 font-mono text-lg tracking-widest">
              {code}
              <Button size="sm" variant="ghost" onClick={copy}>
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">Expires in 7 days.</p>
          </div>
        )}
        {error && <p className="text-sm text-destructive">{error}</p>}
      </DialogContent>
    </Dialog>
  )
}

function RedeemCard({ onLinked }: { onLinked: () => void }) {
  const [code, setCode] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const redeem = async () => {
    setLoading(true)
    setError(null)
    const res = await fetch("/api/guardian-links/accept", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ inviteCode: code }),
    })
    const data = await res.json()
    if (!res.ok) setError(data.error ?? "Invalid or expired code")
    else {
      setSuccess(true)
      setCode("")
      onLinked()
    }
    setLoading(false)
  }

  return (
    <Card>
      <CardContent className="flex flex-wrap items-end gap-3 p-4">
        <div className="flex-1 space-y-1.5">
          <Label htmlFor="redeem">Have a code from a family member or mentor?</Label>
          <Input
            id="redeem"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="e.g. A1B2C3D4"
            className="font-mono tracking-widest"
          />
        </div>
        <Button onClick={redeem} disabled={loading || !code}>
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Redeem
        </Button>
        {error && <p className="w-full text-sm text-destructive">{error}</p>}
        {success && <p className="w-full text-sm text-emerald-600">Linked successfully.</p>}
      </CardContent>
    </Card>
  )
}

function LinkRow({ link, onRevoked }: { link: GuardianLink; onRevoked: (id: string) => void }) {
  const [revoking, setRevoking] = useState(false)

  const revoke = async () => {
    if (!confirm(`Remove this ${link.link_type} link? This can't be undone from here.`)) return
    setRevoking(true)
    const res = await fetch(`/api/guardian-links/${link.id}`, { method: "PATCH" })
    if (res.ok) onRevoked(link.id)
    setRevoking(false)
  }

  return (
    <div className="flex items-center justify-between rounded-md border p-3">
      <div>
        <p className="text-sm font-medium">{link.trusted_adults?.full_name ?? "Trusted adult"}</p>
        <p className="text-xs text-muted-foreground">{link.trusted_adults?.contact_email}</p>
      </div>
      <div className="flex items-center gap-2">
        <Badge variant="outline" className="text-[10px]">
          {link.link_type === "family" ? "Family" : "Mentor"}
        </Badge>
        <Button size="sm" variant="ghost" onClick={revoke} disabled={revoking}>
          {revoking ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  )
}

export default function FamilyMentorsPage() {
  const [links, setLinks] = useState<GuardianLink[]>([])
  const [loading, setLoading] = useState(true)

  const load = async () => {
    const res = await fetch("/api/guardian-links")
    const data = await res.json()
    setLinks(data.links ?? [])
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  const family = links.filter((l) => l.link_type === "family")
  const mentors = links.filter((l) => l.link_type === "mentor")

  return (
    <AppLayout>
      <div className="mx-auto max-w-2xl space-y-6 p-4 sm:p-6">
        <div>
          <h1 className="text-2xl font-bold">Family &amp; Mentors</h1>
          <p className="text-sm text-muted-foreground">
            Link a parent, guardian, or mentor to your account. They'll see what you allow — deadlines,
            application status, and more — from their own QuillGlow account.
          </p>
        </div>

        <RedeemCard onLinked={load} />

        {loading ? (
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        ) : (
          <>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Users className="h-4 w-4" /> Family ({family.length})
                </CardTitle>
                <CardDescription>Parents or guardians with view access to your applications.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <InviteDialog linkType="family" onLinked={load} />
                {family.map((l) => (
                  <LinkRow key={l.id} link={l} onRevoked={load} />
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Users className="h-4 w-4" /> Mentors ({mentors.length})
                </CardTitle>
                <CardDescription>Mentors who can review your applications and leave recommendations.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <InviteDialog linkType="mentor" onLinked={load} />
                {mentors.map((l) => (
                  <LinkRow key={l.id} link={l} onRevoked={load} />
                ))}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </AppLayout>
  )
}

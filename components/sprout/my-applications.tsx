"use client"

import { useCallback, useEffect, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Loader2, Pencil, Trash2, Send } from "lucide-react"

interface Application {
  id: string
  status: string
  notes: string | null
  award_amount: number | null
  payment_status: string
  submitted_at: string | null
  updated_at: string
  opportunities: { title: string; provider: string | null; deadline: string | null; award_amount: number | null } | null
}

const STATUS_META: Record<string, { label: string; variant: any }> = {
  saved: { label: "Saved", variant: "secondary" },
  in_progress: { label: "Draft in progress", variant: "secondary" },
  submitted: { label: "Submitted", variant: "outline" },
  shortlisted: { label: "Shortlisted", variant: "default" },
  awarded: { label: "Awarded", variant: "default" },
  rejected: { label: "Not selected", variant: "destructive" },
  withdrawn: { label: "Withdrawn", variant: "secondary" },
}

/**
 * Was previously nothing — a student who applied had no page to check their
 * own status, see a payment come through, or withdraw. Only Save/Apply
 * existed; nothing showed what happened next.
 */
export function MyApplications() {
  const [apps, setApps] = useState<Application[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draftNotes, setDraftNotes] = useState("")

  const load = useCallback(async () => {
    const res = await fetch("/api/opportunities/applications")
    if (res.ok) setApps((await res.json()).applications ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const withdraw = async (id: string) => {
    setBusy(id)
    setError(null)
    const res = await fetch(`/api/opportunities/applications/${id}/withdraw`, { method: "POST" })
    if (!res.ok) setError((await res.json()).error ?? "Could not withdraw")
    await load()
    setBusy(null)
  }

  const saveDraft = async (id: string) => {
    setBusy(id)
    setError(null)
    const res = await fetch(`/api/opportunities/applications/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes: draftNotes }),
    })
    if (!res.ok) setError((await res.json()).error ?? "Could not save")
    else setEditingId(null)
    await load()
    setBusy(null)
  }

  const remove = async (id: string) => {
    if (!confirm("Delete this draft application? This can't be undone.")) return
    setBusy(id)
    setError(null)
    const res = await fetch(`/api/opportunities/applications/${id}`, { method: "DELETE" })
    if (!res.ok) setError((await res.json()).error ?? "Could not delete")
    await load()
    setBusy(null)
  }

  const submitApplication = async (id: string) => {
    setBusy(id)
    setError(null)
    const res = await fetch(`/api/opportunities/applications/${id}/submit`, { method: "POST" })
    if (!res.ok) setError((await res.json()).error ?? "Could not submit")
    await load()
    setBusy(null)
  }

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  // Bookmarks ('saved') are shown too, but distinctly — they're not really
  // "applications" yet, just things the student is considering.
  const real = apps.filter((a) => a.status !== "saved")
  const bookmarks = apps.filter((a) => a.status === "saved")

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-4 sm:p-6">
      <div>
        <h1 className="text-2xl font-bold">My Applications</h1>
        <p className="text-sm text-muted-foreground">Track the status of every scholarship you've applied to.</p>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {real.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            No applications yet. Find a scholarship under Opportunities and click Apply.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {real.map((a) => {
            const meta = STATUS_META[a.status] ?? { label: a.status, variant: "outline" }
            const canWithdraw = ["submitted", "shortlisted"].includes(a.status) && a.payment_status !== "paid"
            // Drafts were rendering with no actions at all — the reported
            // "static, can't edit or delete" bug. A draft is the student's
            // own unsubmitted work, so edit/submit/delete all apply here.
            const isDraft = ["saved", "in_progress"].includes(a.status)
            return (
              <Card key={a.id}>
                <CardContent className="space-y-2 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-medium">{a.opportunities?.title ?? "Scholarship"}</p>
                      {a.opportunities?.provider && (
                        <p className="text-xs text-muted-foreground">{a.opportunities.provider}</p>
                      )}
                    </div>
                    <Badge variant={meta.variant}>{meta.label}</Badge>
                  </div>

                  {a.status === "awarded" && a.payment_status === "paid" && (
                    <p className="text-xs font-medium text-emerald-600">
                      ${a.award_amount?.toLocaleString()} paid — check your Wallet
                    </p>
                  )}

                  <p className="text-xs text-muted-foreground">
                    {a.submitted_at ? `Submitted ${new Date(a.submitted_at).toLocaleDateString()}` : ""}
                  </p>

                  {isDraft && editingId === a.id && (
                    <div className="space-y-2">
                      <Textarea
                        value={draftNotes}
                        onChange={(e) => setDraftNotes(e.target.value)}
                        rows={4}
                        placeholder="Your notes for this application…"
                      />
                      <div className="flex gap-2">
                        <Button size="sm" disabled={busy === a.id} onClick={() => saveDraft(a.id)}>
                          {busy === a.id ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : null}
                          Save
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2">
                    {isDraft && editingId !== a.id && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busy === a.id}
                          onClick={() => {
                            setEditingId(a.id)
                            setDraftNotes(a.notes ?? "")
                          }}
                        >
                          <Pencil className="mr-1.5 h-3 w-3" />
                          Edit
                        </Button>
                        <Button size="sm" disabled={busy === a.id} onClick={() => submitApplication(a.id)}>
                          {busy === a.id ? (
                            <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
                          ) : (
                            <Send className="mr-1.5 h-3 w-3" />
                          )}
                          Submit
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive hover:text-destructive"
                          disabled={busy === a.id}
                          onClick={() => remove(a.id)}
                        >
                          <Trash2 className="mr-1.5 h-3 w-3" />
                          Delete
                        </Button>
                      </>
                    )}

                    {canWithdraw && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy === a.id}
                        onClick={() => withdraw(a.id)}
                      >
                        {busy === a.id ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : null}
                        Withdraw
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {bookmarks.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Saved for later
          </h2>
          {bookmarks.map((a) => (
            <Card key={a.id}>
              <CardContent className="p-4">
                <p className="text-sm font-medium">{a.opportunities?.title ?? "Scholarship"}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

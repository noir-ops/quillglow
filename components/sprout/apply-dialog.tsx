"use client"

import { useEffect, useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { CheckCircle2, FileText, Loader2, Upload, X } from "lucide-react"

interface OpportunityDetail {
  id: string
  title: string
  description: string | null
  requires_essay: boolean
  requires_recommendation: boolean
}

interface DocRow {
  id: string
  original_filename: string | null
}

/**
 * The real application step — this is what "Save" was previously standing in
 * for. Creates/updates the application as a draft (status='in_progress') as
 * the student writes, lets them attach documents against the SAME
 * application id via the existing secure document pipeline, then submits
 * through submit_application(), which validates the opportunity's stated
 * requirements server-side before allowing the transition to 'submitted'.
 */
export function ApplyDialog({
  opportunityId,
  children,
  onSubmitted,
}: {
  opportunityId: string
  children: React.ReactNode
  onSubmitted?: () => void
}) {
  const [open, setOpen] = useState(false)
  const [detail, setDetail] = useState<OpportunityDetail | null>(null)
  const [applicationId, setApplicationId] = useState<string | null>(null)
  const [notes, setNotes] = useState("")
  const [docs, setDocs] = useState<DocRow[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open || detail) return
    setLoading(true)
    fetch(`/api/opportunities/detail/${opportunityId}`)
      .then((r) => r.json())
      .then((d) => setDetail(d.opportunity))
      .catch(() => setError("Could not load this scholarship's requirements"))
      .finally(() => setLoading(false))
  }, [open, opportunityId, detail])

  // Ensure a draft application row exists so documents have something to
  // attach to, without waiting for the student to type anything first.
  const ensureApplication = async (): Promise<string | null> => {
    if (applicationId) return applicationId
    const res = await fetch("/api/opportunities/applications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ opportunityId, status: "in_progress", notes: notes || null }),
    })
    if (!res.ok) return null
    const data = await res.json()
    setApplicationId(data.application.id)
    return data.application.id
  }

  const saveDraft = async () => {
    setSaving(true)
    setError(null)
    try {
      await ensureApplication()
      if (applicationId) {
        await fetch("/api/opportunities/applications", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ opportunityId, status: "in_progress", notes }),
        })
      }
    } finally {
      setSaving(false)
    }
  }

  const uploadFile = async (file: File) => {
    setUploading(true)
    setError(null)
    try {
      const id = await ensureApplication()
      if (!id) throw new Error("Could not start your application")

      const form = new FormData()
      form.append("file", file)
      form.append("documentType", "recommendation")
      form.append("resourceType", "opportunity_application")
      form.append("resourceId", id)

      const res = await fetch("/api/documents", { method: "POST", body: form })
      if (!res.ok) throw new Error((await res.json()).error ?? "Upload failed")
      const data = await res.json()
      setDocs((d) => [...d, data.document])
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed")
    } finally {
      setUploading(false)
    }
  }

  const submit = async () => {
    setSubmitting(true)
    setError(null)
    try {
      const id = await ensureApplication()
      if (!id) throw new Error("Could not find your application")

      // Save the latest essay text before submitting, so a last-second edit
      // isn't lost.
      await fetch("/api/opportunities/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ opportunityId, status: "in_progress", notes }),
      })

      const res = await fetch(`/api/opportunities/applications/${id}/submit`, { method: "POST" })
      if (!res.ok) throw new Error((await res.json()).error ?? "Submission failed")

      setSubmitted(true)
      onSubmitted?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submission failed")
    } finally {
      setSubmitting(false)
    }
  }

  const essayOk = !detail?.requires_essay || notes.trim().length >= 50
  const docsOk = !detail?.requires_recommendation || docs.length > 0

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-lg">
        {submitted ? (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <CheckCircle2 className="h-10 w-10 text-emerald-500" />
            <p className="font-medium">Application submitted</p>
            <p className="text-sm text-muted-foreground">
              The benefactor will review it. You'll be notified here if your status changes.
            </p>
            <Button size="sm" onClick={() => setOpen(false)}>
              Close
            </Button>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>{detail?.title ?? "Apply"}</DialogTitle>
            </DialogHeader>

            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="space-y-4">
                {detail?.description && <p className="text-sm text-muted-foreground">{detail.description}</p>}

                <div className="flex flex-wrap gap-2">
                  {detail?.requires_essay && (
                    <Badge variant={essayOk ? "default" : "outline"}>
                      {essayOk ? "✓ " : ""}Essay required (min. 50 characters)
                    </Badge>
                  )}
                  {detail?.requires_recommendation && (
                    <Badge variant={docsOk ? "default" : "outline"}>
                      {docsOk ? "✓ " : ""}Supporting document required
                    </Badge>
                  )}
                </div>

                {detail?.requires_essay && (
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Your essay</label>
                    <Textarea
                      rows={6}
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      onBlur={saveDraft}
                      placeholder="Why are you a strong fit for this scholarship?"
                    />
                    <p className="text-xs text-muted-foreground">
                      {notes.trim().length}/50 characters minimum
                      {saving && " · saving…"}
                    </p>
                  </div>
                )}

                {!detail?.requires_essay && (
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Notes (optional)</label>
                    <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} onBlur={saveDraft} />
                  </div>
                )}

                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    Supporting documents {detail?.requires_recommendation ? "(required)" : "(optional)"}
                  </label>
                  {docs.map((d) => (
                    <div key={d.id} className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      {d.original_filename}
                    </div>
                  ))}
                  <label className="flex cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed p-3 text-sm text-muted-foreground hover:bg-accent/40">
                    {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                    Upload a file
                    <input
                      type="file"
                      className="hidden"
                      disabled={uploading}
                      onChange={(e) => {
                        const f = e.target.files?.[0]
                        if (f) uploadFile(f)
                        e.target.value = ""
                      }}
                    />
                  </label>
                </div>

                {error && <p className="text-sm text-destructive">{error}</p>}

                <div className="flex justify-end gap-2 border-t pt-3">
                  <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
                    Save &amp; close
                  </Button>
                  <Button
                    size="sm"
                    disabled={submitting || !essayOk || !docsOk}
                    onClick={submit}
                  >
                    {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Submit application
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

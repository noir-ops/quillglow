"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { toast } from "sonner"
import { Archive, ArchiveRestore, ChevronDown, ExternalLink, Loader2, Plus, Search, Trash2, Undo2 } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { ApplicationTracker, stageIndex } from "@/components/applications/application-tracker"

interface AppRow {
  id: string
  status: string
  created_at: string
  updated_at: string
  submitted_at: string | null
  screened_at: string | null
  decided_at: string | null
  archived_at: string | null
  payment_status: string | null
  paid_amount: number | null
  opportunities: {
    title: string
    provider: string | null
    deadline: string | null
    award_amount: number | null
    url: string | null
  } | null
}

const STATUS_FILTERS = [
  { value: "all", label: "All statuses" },
  { value: "in_progress", label: "In progress" },
  { value: "submitted", label: "Submitted" },
  { value: "screen", label: "Screening" },
  { value: "awarded", label: "Awarded" },
  { value: "rejected", label: "Not successful" },
  { value: "withdrawn", label: "Withdrawn" },
]

const isDraft = (s: string) => s === "saved" || s === "in_progress"

function matchesStatus(app: AppRow, filter: string) {
  switch (filter) {
    case "all":
      return true
    case "in_progress":
      return isDraft(app.status)
    case "screen":
      return app.status === "shortlisted"
    default:
      return app.status === filter
  }
}

/**
 * Application Dashboard. Every application a learner has started, with a
 * four-step tracker (In-Progress → Submitted → Screen → Decision) showing
 * where each one stands and when it got there.
 *
 * Active vs Archived: withdrawn applications and anything the learner
 * archives themselves live under Archived, so the Active list stays focused
 * on what still needs attention.
 */
export function MyApplications() {
  const [apps, setApps] = useState<AppRow[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<"active" | "archived">("active")
  const [query, setQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [expanded, setExpanded] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  const load = useCallback(async () => {
    const res = await fetch("/api/opportunities/applications", { cache: "no-store" })
    if (res.ok) setApps((await res.json()).applications ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const isArchived = (a: AppRow) => !!a.archived_at || a.status === "withdrawn"

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return apps.filter((a) => {
      if ((tab === "archived") !== isArchived(a)) return false
      if (!matchesStatus(a, statusFilter)) return false
      if (!q) return true
      return (
        (a.opportunities?.title ?? "").toLowerCase().includes(q) ||
        (a.opportunities?.provider ?? "").toLowerCase().includes(q)
      )
    })
  }, [apps, tab, query, statusFilter])

  const activeCount = apps.filter((a) => !isArchived(a)).length
  const archivedCount = apps.length - activeCount

  const act = async (id: string, fn: () => Promise<Response>, success: string) => {
    setBusy(id)
    try {
      const res = await fn()
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Something went wrong")
      toast.success(success)
      await load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Something went wrong")
    } finally {
      setBusy(null)
    }
  }

  const withdraw = (id: string) => {
    if (!confirm("Withdraw this application? Reviewers will no longer consider it.")) return
    act(id, () => fetch(`/api/opportunities/applications/${id}/withdraw`, { method: "POST" }), "Application withdrawn")
  }
  const remove = (id: string) => {
    if (!confirm("Delete this draft application? This can't be undone.")) return
    act(id, () => fetch(`/api/opportunities/applications/${id}`, { method: "DELETE" }), "Draft deleted")
  }
  const setArchived = (id: string, archived: boolean) =>
    act(
      id,
      () =>
        fetch(`/api/opportunities/applications/${id}/archive`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ archived }),
        }),
      archived ? "Moved to Archived" : "Moved back to Active",
    )

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:py-8 space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Application Dashboard</h1>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mt-1">
            {apps.length} total application{apps.length === 1 ? "" : "s"}
          </p>
        </div>
        <Button asChild className="gap-1.5">
          <Link href="/opportunities?type=scholarship">
            <Plus className="h-4 w-4" /> Add application
          </Link>
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-5 border-b">
        {(["active", "archived"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "-mb-px border-b-2 pb-2 text-sm font-medium capitalize transition-colors",
              tab === t ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {t} <span className="ml-1 text-xs text-muted-foreground">({t === "active" ? activeCount : archivedCount})</span>
          </button>
        ))}
      </div>

      {/* Search + filter */}
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by scholarship or provider"
            className="pl-9"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="h-10 rounded-md border bg-background px-3 text-sm sm:w-48"
          aria-label="Filter by status"
        >
          {STATUS_FILTERS.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </select>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading applications…
        </div>
      ) : visible.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center space-y-3">
            <p className="text-muted-foreground">
              {apps.length === 0
                ? "You haven't started any applications yet."
                : tab === "archived"
                  ? "Nothing archived."
                  : "No applications match your search."}
            </p>
            {apps.length === 0 && (
              <Button asChild variant="outline">
                <Link href="/opportunities?type=scholarship">Browse scholarships</Link>
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {visible.map((a) => {
            const open = expanded === a.id
            const draft = isDraft(a.status)
            const o = a.opportunities
            return (
              <Card key={a.id} className={cn(open && "border-primary/40")}>
                <div className="flex flex-col gap-4 p-4 md:flex-row md:items-center">
                  <button
                    type="button"
                    onClick={() => setExpanded(open ? null : a.id)}
                    className="min-w-0 flex-1 text-left md:max-w-[35%]"
                  >
                    <p className="truncate font-semibold">{o?.title ?? "Scholarship"}</p>
                    <p className="truncate text-sm text-muted-foreground">{o?.provider ?? ""}</p>
                  </button>
                  <div className="flex flex-1 items-center gap-2 overflow-x-auto">
                    <ApplicationTracker application={a} compact />
                    <button
                      type="button"
                      onClick={() => setExpanded(open ? null : a.id)}
                      aria-label={open ? "Hide details" : "Show details"}
                      className="shrink-0 p-1 text-muted-foreground hover:text-foreground"
                    >
                      <ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} />
                    </button>
                  </div>
                </div>

                {open && (
                  <CardContent className="space-y-4 border-t pt-4">
                    <div className="grid gap-3 text-sm sm:grid-cols-4">
                      <Detail label="Award" value={o?.award_amount ? Number(o.award_amount).toLocaleString() : "—"} />
                      <Detail label="Deadline" value={o?.deadline ? new Date(o.deadline).toLocaleDateString() : "—"} />
                      <Detail label="Last updated" value={new Date(a.updated_at).toLocaleDateString()} />
                      <Detail
                        label="Stage"
                        value={
                          a.status === "withdrawn"
                            ? "Withdrawn"
                            : ["In progress", "Submitted", "Screening", a.status === "awarded" ? "Awarded" : "Not successful"][
                                stageIndex(a.status)
                              ]
                        }
                      />
                    </div>

                    {a.status === "awarded" && a.payment_status && a.payment_status !== "unpaid" && (
                      <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-700 dark:bg-green-900/20 dark:text-green-400">
                        Payment {a.payment_status}
                        {a.paid_amount ? ` · ${Number(a.paid_amount).toLocaleString()}` : ""}
                      </p>
                    )}

                    <div className="flex flex-wrap gap-2">
                      <Button asChild size="sm">
                        <Link href={`/applications/${a.id}`}>
                          {draft ? (a.status === "saved" ? "Start application" : "Continue application") : "View application"}
                        </Link>
                      </Button>
                      {o?.url && (
                        <Button asChild size="sm" variant="outline" className="gap-1.5">
                          <a href={o.url} target="_blank" rel="noreferrer">
                            Scholarship page <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        </Button>
                      )}
                      {["submitted", "shortlisted"].includes(a.status) && (
                        <Button size="sm" variant="outline" disabled={busy === a.id} onClick={() => withdraw(a.id)} className="gap-1.5">
                          <Undo2 className="h-3.5 w-3.5" /> Withdraw
                        </Button>
                      )}
                      {draft && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busy === a.id}
                          onClick={() => remove(a.id)}
                          className="gap-1.5 text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-3.5 w-3.5" /> Delete draft
                        </Button>
                      )}
                      {a.status !== "withdrawn" && (
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={busy === a.id}
                          onClick={() => setArchived(a.id, !a.archived_at)}
                          className="gap-1.5"
                        >
                          {a.archived_at ? (
                            <>
                              <ArchiveRestore className="h-3.5 w-3.5" /> Unarchive
                            </>
                          ) : (
                            <>
                              <Archive className="h-3.5 w-3.5" /> Archive
                            </>
                          )}
                        </Button>
                      )}
                    </div>
                  </CardContent>
                )}
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  )
}

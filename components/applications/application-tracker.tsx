"use client"

import { cn } from "@/lib/utils"

export interface TrackableApplication {
  status: string
  created_at: string
  submitted_at: string | null
  screened_at: string | null
  decided_at: string | null
}

const STEPS = ["In-Progress", "Submitted", "Screen", "Decision"] as const

/** How far along an application is: 0 = In-Progress … 3 = Decision. */
export function stageIndex(status: string): number {
  switch (status) {
    case "submitted":
      return 1
    case "shortlisted":
      return 2
    case "awarded":
    case "rejected":
      return 3
    default:
      return 0 // saved, in_progress, withdrawn
  }
}

const fmt = (d: string | null) =>
  d ? new Date(d).toLocaleDateString(undefined, { month: "numeric", day: "numeric", year: "2-digit" }) : ""

/**
 * The In-Progress → Submitted → Screen → Decision tracker from the
 * dashboard design. Dates come from the stage timestamps the database sets
 * automatically (064), so they stay accurate no matter which reviewer —
 * admin or Impact Partner — moved the application along.
 */
export function ApplicationTracker({ application, compact }: { application: TrackableApplication; compact?: boolean }) {
  const current = stageIndex(application.status)
  const withdrawn = application.status === "withdrawn"
  const dates = [application.created_at, application.submitted_at, application.screened_at, application.decided_at]

  const decisionLabel =
    application.status === "awarded" ? "Awarded" : application.status === "rejected" ? "Not successful" : "Decision"
  const decisionTone =
    application.status === "awarded" ? "bg-green-500" : application.status === "rejected" ? "bg-red-500" : "bg-primary"

  return (
    <div className={cn("w-full", compact ? "min-w-[260px]" : "")}>
      <div className="relative flex items-start justify-between">
        {/* connecting line */}
        <div className="absolute left-[12.5%] right-[12.5%] top-[9px] h-0.5 bg-muted" />
        <div
          className="absolute left-[12.5%] top-[9px] h-0.5 bg-primary transition-all"
          style={{ width: `${(current / (STEPS.length - 1)) * 75}%` }}
        />
        {STEPS.map((label, i) => {
          const reached = i <= current && !withdrawn
          const isDecision = i === 3
          return (
            <div key={label} className="relative z-10 flex w-1/4 flex-col items-center gap-1 text-center">
              <span
                className={cn(
                  "h-[18px] w-[18px] rounded-full border-2",
                  reached
                    ? cn("border-transparent", isDecision && current === 3 ? decisionTone : "bg-primary")
                    : "border-muted-foreground/30 bg-background",
                )}
              />
              <span className={cn("text-[11px] font-medium leading-tight", reached ? "text-foreground" : "text-muted-foreground")}>
                {isDecision ? decisionLabel : label}
              </span>
              <span className="h-3 text-[10px] text-muted-foreground">{reached ? fmt(dates[i]) : ""}</span>
            </div>
          )
        })}
      </div>
      {withdrawn && <p className="mt-1 text-center text-xs text-muted-foreground">Withdrawn</p>}
    </div>
  )
}

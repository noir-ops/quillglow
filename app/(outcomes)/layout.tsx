import type React from "react"
import { AppLayout } from "@/components/dashboard/app-layout"

/**
 * Outcome-based workflow shell.
 *
 * Wraps AppLayout so Learn / Prepare / Opportunities / Grow get the same
 * sidebar, header and mobile navigation as every other page. The workflows are
 * listed in the sidebar itself, so no second in-page switcher is needed here.
 */
export default function OutcomesLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppLayout>
      <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">{children}</div>
    </AppLayout>
  )
}

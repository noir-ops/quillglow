/**
 * Fired in the browser after the learner completes something that counts as
 * study (a task, a planner session…), so live widgets — the streak and
 * "Done Today" on Home — refresh without a page reload.
 */
export const STUDY_ACTIVITY_EVENT = "qg:study-activity"

export function announceStudyActivity() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(STUDY_ACTIVITY_EVENT))
}

/** The learner's IANA timezone, so "today" and streak days are their own days. */
export function learnerTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"
  } catch {
    return "UTC"
  }
}

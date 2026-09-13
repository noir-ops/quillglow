/**
 * Event worker.
 *
 * Claims a batch, dispatches each event to its handler, and reports outcomes.
 * Retry, backoff and dead-lettering are handled in SQL (`fail_event`), so a
 * crashed worker loses nothing — `requeueStaleEvents` recovers anything left
 * locked.
 */

import { claimEvents, completeEvent, failEvent, requeueStaleEvents } from "./bus"
import { getHandler } from "./handlers"

export interface WorkerResult {
  claimed: number
  succeeded: number
  failed: number
  skipped: number
  requeuedStale: number
  durationMs: number
}

export async function processEvents(options: { batchSize?: number; workerId?: string } = {}): Promise<WorkerResult> {
  const started = Date.now()
  const workerId = options.workerId ?? `worker-${Math.random().toString(36).slice(2, 8)}`

  // Recover anything a previous crashed run left locked.
  const requeuedStale = await requeueStaleEvents(10)

  const events = await claimEvents(workerId, options.batchSize ?? 10)
  let succeeded = 0
  let failed = 0
  let skipped = 0

  for (const event of events) {
    const handler = getHandler(event.event_type)

    if (!handler) {
      // Unknown type: complete it rather than retrying forever.
      console.warn(`[worker] no handler for ${event.event_type}, completing`)
      await completeEvent(event.id)
      skipped++
      continue
    }

    try {
      await handler(event)
      await completeEvent(event.id)
      succeeded++
    } catch (err) {
      const message = err instanceof Error ? err.message : "handler failed"
      console.error(`[worker] event ${event.id} (${event.event_type}) failed:`, message)
      await failEvent(event.id, message)
      failed++
    }
  }

  return {
    claimed: events.length,
    succeeded,
    failed,
    skipped,
    requeuedStale,
    durationMs: Date.now() - started,
  }
}

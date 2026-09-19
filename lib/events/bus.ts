/**
 * Event bus client.
 *
 * Backed by the `platform_events` table rather than a queue service — same
 * guarantees (durability, retry, backoff, dead-lettering, replay) with nothing
 * extra to operate. The handler interface is queue-shaped, so swapping in a real
 * queue later doesn't touch handler code.
 */

import { createAdminClient } from "@/lib/supabase/admin"

export type PlatformEventType =
  | "learning.evidence_recorded"
  | "learning.session_completed"
  | "assessment.requested"
  | "curriculum.requested"
  | "scores.refresh_requested"

export interface EmitOptions {
  userId?: string | null
  payload?: Record<string, unknown>
  /**
   * Collapses duplicate work. Repeated emissions with the same key debounce into
   * a single pending event, so a 20-question exam submission triggers one
   * assessment run rather than twenty.
   */
  dedupeKey?: string
  /** Debounce window: the event won't run until this many seconds from now. */
  delaySeconds?: number
}

/** Emit an event. Never throws — a bus failure must not break the caller. */
export async function emit(type: PlatformEventType, opts: EmitOptions = {}): Promise<number | null> {
  try {
    const admin = createAdminClient()
    const { data, error } = await admin.rpc("emit_event", {
      p_event_type: type,
      p_user_id: opts.userId ?? null,
      p_payload: opts.payload ?? {},
      p_dedupe_key: opts.dedupeKey ?? null,
      p_delay_seconds: opts.delaySeconds ?? 0,
    })
    if (error) {
      console.error("[events] emit failed:", error.message)
      return null
    }
    return data as number
  } catch (err) {
    console.error("[events] emit threw:", err)
    return null
  }
}

export interface PlatformEvent {
  id: number
  user_id: string | null
  event_type: PlatformEventType
  payload: Record<string, any>
  attempts: number
}

export async function claimEvents(workerId: string, limit = 10): Promise<PlatformEvent[]> {
  const admin = createAdminClient()
  const { data, error } = await admin.rpc("claim_events", { p_worker_id: workerId, p_limit: limit })
  if (error) {
    console.error("[events] claim failed:", error.message)
    return []
  }
  return (data ?? []) as PlatformEvent[]
}

export async function completeEvent(id: number): Promise<void> {
  const admin = createAdminClient()
  await admin.rpc("complete_event", { p_id: id })
}

export async function failEvent(id: number, error: string): Promise<void> {
  const admin = createAdminClient()
  await admin.rpc("fail_event", { p_id: id, p_error: error.slice(0, 500) })
}

export async function requeueStaleEvents(staleMinutes = 10): Promise<number> {
  const admin = createAdminClient()
  const { data } = await admin.rpc("requeue_stale_events", { p_stale_minutes: staleMinutes })
  return (data as number) ?? 0
}

export async function getQueueHealth() {
  const admin = createAdminClient()
  const { data } = await admin.from("event_queue_health").select("*")
  return data ?? []
}

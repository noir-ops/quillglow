import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"

export const dynamic = "force-dynamic"
export const maxDuration = 120

/**
 * Prunes chat history in sprout_chat_sessions and tutor_sessions — spec
 * requirement: "do not store entire conversations indefinitely, store useful
 * structured information." The structured side (learning_events) is already
 * append-only by design; this brings the raw chat logs sitting beside it in
 * line with the same principle.
 *
 * Same CRON_SECRET pattern as /api/events/process and
 * /api/knowledge/process-pending. Add to the same scheduler — daily is
 * sufficient, this doesn't need per-minute granularity.
 */
async function authorize(req: Request): Promise<boolean> {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  return req.headers.get("authorization") === `Bearer ${secret}`
}

export async function POST(req: Request) {
  if (!(await authorize(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const admin = createAdminClient()
    const { data, error } = await admin.rpc("prune_chat_history", {
      p_retention_days: Number(process.env.CHAT_RETENTION_DAYS ?? 90),
      p_min_keep: Number(process.env.CHAT_MIN_KEEP ?? 10),
      p_hard_cap: Number(process.env.CHAT_HARD_CAP ?? 200),
    })

    if (error) throw new Error(error.message)

    const rows = data ?? []
    return NextResponse.json({
      sessionsPruned: rows.length,
      totalMessagesRemoved: rows.reduce(
        (sum: number, r: any) => sum + (r.messages_before - r.messages_after),
        0,
      ),
      detail: rows,
    })
  } catch (err) {
    console.error("[prune-chat-history] error:", err)
    return NextResponse.json({ error: "Pruning failed" }, { status: 500 })
  }
}

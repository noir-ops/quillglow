import { NextResponse } from "next/server"
import { processEvents } from "@/lib/events/worker"
import { getQueueHealth } from "@/lib/events/bus"

export const dynamic = "force-dynamic"
export const maxDuration = 300

/**
 * Event worker endpoint. Drive it with a scheduler (Vercel Cron, GitHub Actions,
 * or any external pinger) every minute or two.
 *
 * Protected by CRON_SECRET — this triggers real LLM spend, so it must not be
 * publicly callable.
 */
async function authorize(req: Request): Promise<boolean> {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const header = req.headers.get("authorization") ?? ""
  return header === `Bearer ${secret}`
}

export async function POST(req: Request) {
  if (!(await authorize(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const result = await processEvents({ batchSize: 10 })
    return NextResponse.json(result)
  } catch (err) {
    console.error("[events/process] error:", err)
    return NextResponse.json({ error: "Worker failed" }, { status: 500 })
  }
}

/** Queue health, for monitoring. */
export async function GET(req: Request) {
  if (!(await authorize(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  return NextResponse.json({ queue: await getQueueHealth() })
}

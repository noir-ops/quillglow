import { NextResponse } from "next/server"
import { deliverNotificationEmails } from "@/lib/services/notifications/email"
export const dynamic = "force-dynamic"
export const maxDuration = 60
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  try { return NextResponse.json(await deliverNotificationEmails(undefined, 5)) }
  catch (error) { console.error("[notification-emails]", error); return NextResponse.json({ error: "Email worker failed" }, { status: 500 }) }
}

import "server-only"
import { createAdminClient } from "@/lib/supabase/admin"

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!)

export function notificationLink(path: unknown, origin: string): string | null {
  if (typeof path !== "string" || !path.startsWith("/") || path.startsWith("//") || /[\\\u0000-\u001f]/.test(path)) return null
  return new URL(path, origin).toString()
}

/** Provider accepted means queued by MailerSend, not proof of inbox delivery. */
export async function deliverNotificationEmails(userId?: string, limit = 10) {
  const apiKey = process.env.MAILERSEND_API_KEY
  const from = process.env.MAILERSEND_FROM_EMAIL
  const originValue = process.env.NEXT_PUBLIC_APP_URL
  if (!apiKey || !from || !originValue) return { configured: false, accepted: 0, failed: 0, skipped: 0 }
  const origin = new URL(originValue).origin
  if (!/^https?:/.test(origin)) throw new Error("NEXT_PUBLIC_APP_URL must use http(s)")
  const admin = createAdminClient()
  const { data: rows, error } = await admin.rpc("claim_notification_emails", { p_limit: limit, p_user_id: userId ?? null })
  if (error) throw new Error(`Email queue could not be read: ${error.message}`)
  const counts = { configured: true, accepted: 0, failed: 0, skipped: 0 }
  for (const row of rows ?? []) {
    async function finish(patch: Record<string, unknown>) {
      const { error } = await admin.from("notification_email_outbox").update({ ...patch, locked_at: null, lock_token: null })
        .eq("id", row.id).eq("lock_token", row.lock_token)
      if (error) throw new Error(`Email queue status could not be saved: ${error.message}`)
    }
    let response: Response | undefined
    try {
      // Recheck opt-outs and current recipient at send time, including a changed email.
      const { data: allowed, error: preferenceError } = await admin.rpc("notification_email_allowed", {
        p_user_id: row.user_id, p_category: row.category, p_metadata: row.metadata,
      })
      if (preferenceError) throw new Error("Could not load email preferences")
      const { data: { user }, error: userError } = await admin.auth.admin.getUserById(row.user_id)
      if (userError) throw new Error("Could not load email recipient")
      if (!allowed || !user?.email || !user.email_confirmed_at) {
        await finish({ status: "skipped", last_error: "Email opted out or recipient is unverified" }); counts.skipped++; continue
      }
      const action = notificationLink(row.action_url, origin)
      const settings = `${origin}/settings`
      const text = `${row.title}\n\n${row.body || ""}${action ? `\n\nView: ${action}` : ""}\n\nManage notification preferences: ${settings}`
      const html = `<html lang="en"><body style="font-family:Arial,sans-serif;line-height:1.6"><h1 style="font-size:22px">${esc(row.title)}</h1><p style="white-space:pre-wrap">${esc(row.body || "")}</p>${action ? `<p><a href="${esc(action)}">View in QuillGlow</a></p>` : ""}<p><a href="${esc(settings)}">Manage notification preferences</a></p></body></html>`
      response = await fetch("https://api.mailersend.com/v1/email", {
        method: "POST", headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from: { email: from, name: process.env.MAILERSEND_FROM_NAME || "QuillGlow" },
          to: [{ email: user.email }], subject: String(row.title).replace(/[\r\n]/g, " ").slice(0, 200), text, html,
          tags: ["notification", `notification-${row.notification_id}`] }),
        signal: AbortSignal.timeout(10_000),
      })
      if (!response.ok) throw new Error(`MailerSend HTTP ${response.status}`)
    } catch (error) {
      const retryable = !response || response.status === 429 || response.status >= 500
      const retry = retryable && row.attempts < 5
      await finish({ status: retry ? "pending" : "failed", last_error: error instanceof Error ? error.message : "Email failed",
        available_at: new Date(Date.now() + Math.min(24 * 60, 2 ** row.attempts) * 60_000).toISOString() })
      counts.failed++; continue
    }
    // A DB failure after acceptance leaves the lease for operator review/recovery.
    await finish({ status: "sent", sent_at: new Date().toISOString(), provider_message_id: response!.headers.get("x-message-id"), last_error: null })
    counts.accepted++
  }
  return counts
}

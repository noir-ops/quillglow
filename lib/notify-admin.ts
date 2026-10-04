/**
 * Emails the admin team when a support ticket arrives or a learner replies to
 * one. Recipients: ADMIN_NOTIFY_EMAILS (comma-separated), falling back to
 * ADMIN_EMAILS. Sent through MailerSend with the same MAILERSEND_* settings
 * the shop's order emails use.
 *
 * Never throws and never takes longer than a few seconds: a learner's ticket
 * must be saved and confirmed even if email is down or not configured.
 */
export interface TicketAlert {
  kind: "new_ticket" | "learner_reply"
  ticketNumber: string | null
  name: string
  email: string
  subject: string
  message: string
  source: string // e.g. "Contact form", "Settings → Contact Support", "Support page"
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!)

export function adminNotifyRecipients(): string[] {
  const raw = process.env.ADMIN_NOTIFY_EMAILS || process.env.ADMIN_EMAILS || ""
  return Array.from(new Set(raw.split(",").map((e) => e.trim()).filter((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e))))
}

export async function notifyAdminsOfTicket(alert: TicketAlert, timeoutMs = 4000): Promise<boolean> {
  const apiKey = process.env.MAILERSEND_API_KEY
  const to = adminNotifyRecipients()
  if (!apiKey || to.length === 0) {
    console.warn("[notify-admin] skipped: set MAILERSEND_API_KEY and ADMIN_NOTIFY_EMAILS to receive ticket alerts")
    return false
  }
  const adminUrl = (process.env.ADMIN_APP_URL || "").replace(/\/$/, "")
  const heading = alert.kind === "new_ticket" ? "New support ticket" : "A learner replied to a ticket"
  const subject = `[QuillGlow] ${heading}${alert.ticketNumber ? ` ${alert.ticketNumber}` : ""}: ${alert.subject}`.slice(0, 200)
  const preview = alert.message.length > 1500 ? `${alert.message.slice(0, 1500)}…` : alert.message
  const link = adminUrl ? `${adminUrl}/admin/contacts?status=open` : null

  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:560px">
      <h2 style="margin:0 0 12px">${esc(heading)}</h2>
      <p style="margin:0 0 4px"><b>From:</b> ${esc(alert.name)} &lt;${esc(alert.email)}&gt;</p>
      ${alert.ticketNumber ? `<p style="margin:0 0 4px"><b>Ticket:</b> ${esc(alert.ticketNumber)}</p>` : ""}
      <p style="margin:0 0 4px"><b>Subject:</b> ${esc(alert.subject)}</p>
      <p style="margin:0 0 12px;color:#666"><b>Via:</b> ${esc(alert.source)}</p>
      <div style="white-space:pre-wrap;border-left:3px solid #ddd;padding:8px 12px;color:#333">${esc(preview)}</div>
      ${link ? `<p style="margin-top:16px"><a href="${link}">Open in the admin panel →</a></p>` : ""}
    </div>`
  const text = `${heading}\nFrom: ${alert.name} <${alert.email}>\n${alert.ticketNumber ? `Ticket: ${alert.ticketNumber}\n` : ""}Subject: ${alert.subject}\nVia: ${alert.source}\n\n${preview}${link ? `\n\nOpen: ${link}` : ""}`

  try {
    const res = await fetch("https://api.mailersend.com/v1/email", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", "X-Requested-With": "XMLHttpRequest" },
      body: JSON.stringify({
        from: { email: process.env.MAILERSEND_FROM_EMAIL || "noreply@quillglow.com", name: process.env.MAILERSEND_FROM_NAME || "QuillGlow" },
        to: to.map((email) => ({ email })),
        reply_to: { email: alert.email, name: alert.name },
        subject,
        html,
        text,
      }),
      signal: AbortSignal.timeout(timeoutMs),
    })
    if (!res.ok) {
      console.error("[notify-admin] MailerSend rejected the alert:", res.status, (await res.text().catch(() => "")).slice(0, 300))
      return false
    }
    return true
  } catch (err) {
    console.error("[notify-admin] alert failed:", err instanceof Error ? err.message : err)
    return false
  }
}

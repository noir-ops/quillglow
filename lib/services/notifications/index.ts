/**
 * Notification service — Platform Core (Milestone 2).
 *
 * In-app notifications are always delivered; only email respects category
 * opt-outs, so a student can't accidentally opt out of learning that they won
 * a scholarship.
 */

import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"

export type NotificationCategory =
  | "scholarship"
  | "learning"
  | "marketplace"
  | "account"
  | "system"

export interface SendNotificationInput {
  userId: string
  category: NotificationCategory
  title: string
  body?: string
  actionUrl?: string
  channel?: "in_app" | "email" | "push"
  metadata?: Record<string, unknown>
}

/** Fire-and-forget — a notification failure must not break the action. */
export function notify(input: SendNotificationInput): void {
  void (async () => {
    try {
      const admin = createAdminClient()
      await admin.rpc("send_notification", {
        p_user_id: input.userId,
        p_category: input.category,
        p_title: input.title,
        p_body: input.body ?? null,
        p_action_url: input.actionUrl ?? null,
        p_channel: input.channel ?? "in_app",
        p_metadata: input.metadata ?? {},
      })
    } catch (err) {
      console.error("[notifications] send failed:", err)
    }
  })()
}

export async function listNotifications(userId: string, limit = 50) {
  const supabase = await createClient()
  const { data } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit)
  return data ?? []
}

export async function markRead(userId: string, ids: number[]) {
  const supabase = await createClient()
  await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", userId)
    .in("id", ids)
    .is("read_at", null)
}

export async function unreadCount(userId: string): Promise<number> {
  const admin = createAdminClient()
  const { data } = await admin.rpc("unread_notification_count", { p_user_id: userId })
  return Number(data ?? 0)
}

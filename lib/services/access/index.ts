/**
 * Access control — spec §16, §21, §22.
 *
 * Authorization is ALWAYS server-side. Hiding a button in the UI is not a
 * security mechanism (§21) — every protected route calls `requirePermission`.
 */

import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

export type Role = "student" | "mentor" | "benefactor" | "admin"

export type Permission =
  | "learning.read"
  | "learning.create"
  | "scholarship.apply"
  | "scholarship.review"
  | "scholarship.create"
  | "funding.manage"
  | "marketplace.purchase"
  | "marketplace.manage"
  | "platform.administer"

export type Entitlement =
  | "basic_learning"
  | "premium_learning"
  | "advanced_ai"
  | "exam_coach"
  | "scholarship_assistance"
  | "scholarship_discovery"
  | "premium_analytics"
  | "marketplace_access"
  | "marketplace_discount"
  | "basic_progress"

export interface UserAccess {
  userId: string
  roles: Role[]
  permissions: Permission[]
  plan: "free" | "premium"
  entitlements: Entitlement[]
}

export async function getUserAccess(userId: string): Promise<UserAccess | null> {
  try {
    const admin = createAdminClient()
    const { data, error } = await admin.rpc("get_user_access", { p_user_id: userId })
    if (error) {
      console.error("[access] lookup failed:", error.message)
      return null
    }
    const row = Array.isArray(data) ? data[0] : data
    if (!row) return null

    return {
      userId,
      roles: (row.roles ?? ["student"]) as Role[],
      permissions: (row.permissions ?? []) as Permission[],
      plan: (row.plan ?? "free") as "free" | "premium",
      entitlements: (row.entitlements ?? []) as Entitlement[],
    }
  } catch (err) {
    console.error("[access] lookup threw:", err)
    return null
  }
}

/** Spec §21: `authorize(user, permission)`. */
export function authorize(access: UserAccess | null, permission: Permission): boolean {
  return !!access?.permissions.includes(permission)
}

export function hasEntitlement(access: UserAccess | null, entitlement: Entitlement): boolean {
  return !!access?.entitlements.includes(entitlement)
}

export interface AuthContext {
  userId: string
  access: UserAccess
}

/**
 * Route guard. Returns a `Response` to return immediately, or an AuthContext.
 *
 *   const guard = await requirePermission("scholarship.create")
 *   if ("error" in guard) return guard.error
 *   // guard.userId, guard.access available
 */
export async function requirePermission(
  permission: Permission,
): Promise<{ error: Response } | AuthContext> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }
  }

  const access = await getUserAccess(user.id)
  if (!authorize(access, permission)) {
    return {
      error: NextResponse.json(
        { error: "Forbidden", requiredPermission: permission },
        { status: 403 },
      ),
    }
  }

  return { userId: user.id, access: access! }
}

/** Gate a premium feature. Returns an upgrade prompt rather than a bare 403. */
export async function requireEntitlement(
  entitlement: Entitlement,
): Promise<{ error: Response } | AuthContext> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }
  }

  const access = await getUserAccess(user.id)
  if (!hasEntitlement(access, entitlement)) {
    return {
      error: NextResponse.json(
        {
          error: "Upgrade required",
          message: "This feature is part of Premium.",
          requiredEntitlement: entitlement,
          plan: access?.plan ?? "free",
          upgradeUrl: "/upgrade",
        },
        { status: 402 },
      ),
    }
  }

  return { userId: user.id, access: access! }
}

// ── Audit logging (spec §22) ────────────────────────────────────────────────

export interface AuditEntry {
  actorId: string | null
  action: string
  resourceType?: string
  resourceId?: string
  before?: Record<string, unknown> | null
  after?: Record<string, unknown> | null
  metadata?: Record<string, unknown>
  request?: Request
}

/** Fire-and-forget: an audit write must never break the action it records. */
export function writeAuditLog(entry: AuditEntry): void {
  void (async () => {
    try {
      const admin = createAdminClient()
      await admin.rpc("write_audit_log", {
        p_actor_id: entry.actorId,
        p_action: entry.action,
        p_resource_type: entry.resourceType ?? null,
        p_resource_id: entry.resourceId ?? null,
        p_before: entry.before ?? null,
        p_after: entry.after ?? null,
        p_metadata: entry.metadata ?? {},
        p_ip:
          entry.request?.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
          entry.request?.headers.get("x-real-ip") ??
          null,
        p_user_agent: entry.request?.headers.get("user-agent") ?? null,
      })
    } catch (err) {
      console.error("[audit] write failed:", err)
    }
  })()
}

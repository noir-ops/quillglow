import { createHmac, timingSafeEqual, createHash, randomUUID } from "node:crypto"

function key(): string {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!secret) throw new Error("Server session signing is not configured")
  return secret
}
function contextHash(topic: string, mode: string): string {
  return createHash("sha256").update(JSON.stringify([topic, mode])).digest("hex")
}
function sign(payload: string): string {
  return createHmac("sha256", key()).update(`quillglow:echomind:v1:${payload}`).digest("base64url")
}
/** A paid session can continue through this UTC month, bound to its user/topic/mode. */
export function createQuotaSession(userId: string, topic: string, mode: string, now = new Date()): string {
  const payload = Buffer.from(JSON.stringify({ uid: userId, context: contextHash(topic, mode), id: randomUUID(),
    exp: Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1) })).toString("base64url")
  return `${payload}.${sign(payload)}`
}
export function validQuotaSession(token: unknown, userId: string, topic: string, mode: string, now = Date.now()): boolean {
  if (typeof token !== "string" || token.length > 2000) return false
  try {
    const [payload, signature, extra] = token.split(".")
    if (!payload || !signature || extra) return false
    const expected = Buffer.from(sign(payload)), actual = Buffer.from(signature)
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return false
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"))
    return data.uid === userId && data.context === contextHash(topic, mode) && Number.isFinite(data.exp) && data.exp > now
  } catch { return false }
}

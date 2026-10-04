import { createHmac, timingSafeEqual } from "crypto"

/**
 * Verifies a Polar webhook (Standard Webhooks format). Mirrors the official
 * @polar-sh/sdk validateWebhook exactly:
 *   - headers webhook-id, webhook-timestamp, webhook-signature are required
 *   - timestamp must be within 5 minutes (replay protection)
 *   - signed content is `${id}.${timestamp}.${rawBody}`, HMAC-SHA256
 *   - the secret is tried both as raw UTF-8 and as base64 (after an optional
 *     "whsec_" prefix), as Polar does
 *   - webhook-signature may hold several space-separated "v1,<base64>" values
 */
export class PolarWebhookError extends Error {}

const TOLERANCE_SECONDS = 300

function candidateKeys(secret: string): Buffer[] {
  const utf8 = Buffer.from(secret, "utf8")
  const keys = [utf8]
  const remainder = secret.startsWith("whsec_") ? secret.slice(6) : secret
  const decoded = forgivingBase64Decode(remainder)
  if (decoded && decoded.length > 0 && !decoded.equals(utf8)) keys.push(decoded)
  return keys
}

/**
 * The web platform's "forgiving-base64 decode" — what atob() does, and so
 * what Polar's SDK accepts. Notably it ignores leftover bits in the last
 * character (a stricter "must re-encode identically" check rejected some
 * secrets the SDK accepts). Returns null where atob would throw.
 */
function forgivingBase64Decode(input: string): Buffer | null {
  let s = input.replace(/[\t\n\f\r ]/g, "")
  if (s.length % 4 === 0) s = s.replace(/={1,2}$/, "")
  if (s.length % 4 === 1 || !/^[A-Za-z0-9+/]*$/.test(s)) return null
  return Buffer.from(s, "base64")
}

export function verifyPolarWebhook(rawBody: string, headers: Headers, secret: string, nowSeconds = Date.now() / 1000): void {
  if (!secret) throw new PolarWebhookError("Webhook secret is not configured")
  const id = headers.get("webhook-id")
  const timestamp = headers.get("webhook-timestamp")
  const signatures = headers.get("webhook-signature")
  if (!id || !timestamp || !signatures) throw new PolarWebhookError("Missing required headers")

  const ts = Number(timestamp)
  if (!Number.isFinite(ts)) throw new PolarWebhookError("Invalid signature headers")
  if (ts < nowSeconds - TOLERANCE_SECONDS) throw new PolarWebhookError("Message timestamp too old")
  if (ts > nowSeconds + TOLERANCE_SECONDS) throw new PolarWebhookError("Message timestamp too new")

  const signed = `${id}.${Math.floor(ts)}.${rawBody}`
  const expected = candidateKeys(secret).map((key) => createHmac("sha256", key).update(signed).digest())

  for (const versioned of signatures.split(" ")) {
    const [version, signature] = versioned.split(",", 2)
    if (version !== "v1" || !signature) continue
    const given = Buffer.from(signature, "base64")
    for (const exp of expected) {
      if (given.length === exp.length && timingSafeEqual(given, exp)) return
    }
  }
  throw new PolarWebhookError("No matching signature found")
}

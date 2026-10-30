import { timingSafeEqual } from "crypto"

/** Missing CRON_SECRET must never accept the literal "Bearer undefined". */
export function isCronAuthorized(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret?.trim()) return false
  const expected = Buffer.from(`Bearer ${secret}`)
  const actual = Buffer.from(request.headers.get("authorization") || "")
  return actual.length === expected.length && timingSafeEqual(actual, expected)
}

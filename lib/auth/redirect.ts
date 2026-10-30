/** Only permit application paths; reject protocol-relative and backslash URLs. */
export function safeAuthNext(value: string | null | undefined, fallback = "/dashboard"): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || /[\\\u0000-\u001f]/.test(value)) return fallback
  return value
}

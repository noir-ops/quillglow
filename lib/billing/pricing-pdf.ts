import type { PublicPricing } from "@/lib/billing/pricing-view"
import { formatPrice } from "@/lib/billing/pricing-view"

/** One-page, live pricing sheet; only built-in PDF fonts, no new app dependency. */
export function pricingPdf(pricing: PublicPricing, rows: { label: string; scholar: number | null; genius: number | null }[]): Buffer {
  const safe = (s: string) => s.replace(/[^\x20-\x7E]/g, "-").replace(/([\\()])/g, "\\$1")
  const commands: string[] = []
  const text = (x: number, y: number, s: string, size = 10, bold = false) => commands.push(`BT /F${bold ? 2 : 1} ${size} Tf ${x} ${y} Td (${safe(s)}) Tj ET`)
  commands.push("0.35 0.17 0.72 rg 40 778 515 4 re f", "0.10 0.10 0.16 rg")
  text(40, 800, "QuillGlow - Plans & pricing", 23, true)
  text(40, 755, `Genius: ${formatPrice(pricing.monthlyCents)} billed monthly`, 14, true)
  text(40, 735, pricing.annualAvailable ? `Annual option: ${formatPrice(pricing.annualCents!)} billed once per year` : "Annual billing is not available yet.", 11)
  text(40, 714, "Scholar stays free. Final totals and eligible discounts are shown at checkout.", 9)
  text(40, 690, "Monthly AI allowance", 10, true); text(380, 690, "Scholar", 10, true); text(480, 690, "Genius", 10, true)
  const amount = (n: number | null) => n === null ? "Not listed" : n < 0 ? "No limit" : n === 0 ? "Not included" : n.toLocaleString("en-US")
  let y = 666
  for (const [i, row] of rows.slice(0, 24).entries()) {
    if (i % 2 === 0) commands.push(`0.96 0.95 0.99 rg 40 ${y - 5} 515 18 re f`, "0.10 0.10 0.16 rg")
    text(47, y, row.label.slice(0, 51), 9); text(380, y, amount(row.scholar), 9); text(480, y, amount(row.genius), 9)
    y -= 19
  }
  y -= 15
  for (const line of ["AI allowances reset on the 1st of each month (UTC), including annual plans.",
    "Flashcards count cards; EchoMind counts session starts; StudyPilot counts study systems.",
    "Existing subscriptions retain their current rate while the subscription continues.",
    "Family balance purchases provide 30-day access and are not recurring subscriptions.",
    "Current offers and allowances: https://www.quillglow.com/pricing"]) { text(40, y, line, 8); y -= 15 }
  text(40, 35, `Generated ${new Date(pricing.serverNow).toISOString().slice(0, 10)} UTC - amounts in USD`, 8)
  const stream = commands.join("\n")
  const objects = ["<< /Type /Catalog /Pages 2 0 R >>", "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Courier /Encoding /WinAnsiEncoding >>", "<< /Type /Font /Subtype /Type1 /BaseFont /Courier-Bold /Encoding /WinAnsiEncoding >>",
    `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`]
  let pdf = "%PDF-1.4\n", offsets = [0]
  objects.forEach((o, i) => { offsets.push(Buffer.byteLength(pdf)); pdf += `${i + 1} 0 obj\n${o}\nendobj\n` })
  const xref = Buffer.byteLength(pdf)
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map((o) => String(o).padStart(10, "0") + " 00000 n \n").join("")}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`
  return Buffer.from(pdf)
}

# Platform Fees on Scholarship Funding

A benefactor funding a $500 scholarship is now charged $512.50 — the
scholarship amount plus a technology fee (1.5%) and a processing fee
(1.0%) — and sees that breakdown live, before ever reaching Polar's
checkout page. The payment provider's own fee (Polar) is disclosed
alongside it, but never added to what's charged — Polar, as Merchant of
Record, deducts its own cut from what it remits to QuillGlow, not from
what the benefactor pays.

```
Scholarship                     $500.00
Technology fee (1.5%)             $7.50
Processing fee (1.0%)             $5.00
Total before provider fees      $512.50   ← what's actually charged
Est. Polar processing fee        ~$20.90  ← disclosed only, not charged
```

## Where this lives

**Migration:** `scripts/041_platform_fee_settings.sql` (quillglow-main)
- `platform_fee_settings` — single global row (same pattern as `ai_provider_settings`), holds both platform rates and the provider-fee disclosure text
- Adds `tech_fee`, `processing_fee`, `total_charged` to `fund_deposit_checkouts` — additive columns for accounting; the existing `amount` column is untouched and still the only thing credited to a wallet

**Benefactor app (where funding happens):**
- `lib/fees/index.ts` — `getFeeSettings()` + `computeFeeBreakdown()`, the one place the math lives. Both the checkout route (which charges real money) and the fee-settings endpoint (which the dialog polls for a live preview) call this exact function, so what's previewed can never drift from what's billed.
- `app/api/funds/fee-settings/route.ts` — read-only endpoint the Add Funds dialog polls as the benefactor types an amount
- `app/api/funds/deposit/checkout/route.ts` — now charges Polar for the fee-inclusive total, while still recording (and later crediting) only the scholarship principal
- `components/funds/add-funds-dialog.tsx` — live breakdown, disclosure note, and a submit button that shows the real total ("Continue to payment — $512.50")

**Admin app:**
- `/admin/platform-fees` — edit the technology fee %, processing fee %, provider name, provider fee estimate, and disclosure text. Takes effect on the benefactor app's next fee-settings lookup — no deploy.

## The money flow, precisely

1. Benefactor enters $500 → sees $512.50 total → clicks through
2. Polar charges the benefactor's card $512.50
3. `fund_deposit_checkouts` row records `amount: 500`, `tech_fee: 7.50`, `processing_fee: 5.00`, `total_charged: 512.50`
4. On confirmation, `confirm_fund_deposit()` (unchanged, 032) credits exactly `amount` — $500 — to the benefactor's wallet
5. The $12.50 difference is platform revenue, collected via the same Polar transaction, never touching any wallet or scholarship fund

**The full scholarship amount always reaches the fund** — fees are additive on top, never deducted from what gets allocated to students.

## Why the provider fee is disclosed, not charged

Polar is a Merchant of Record: it charges the customer (the benefactor) the
sticker price and deducts its own processing fee from what it remits to
the merchant (QuillGlow) afterward. Adding Polar's estimated fee on top of
what the benefactor is charged would mean charging them for a cost they
never actually bear. The disclosure exists so benefactors understand
QuillGlow doesn't keep 100% of the $512.50 — not to justify charging them
more.

Because that rate isn't fixed — Polar's own published rate has changed
twice in 2026 already — it's admin-configurable rather than hardcoded, and
the admin page includes a note to check Polar's pricing page directly
rather than assuming the estimate is current.

import { createStablecoinTransfer, getTransferStatus } from "@/lib/circle"
import type { CreatePayoutInput, PayoutProvider, PayoutResult } from "../types"
import { ProviderNotConfiguredError } from "../types"

/**
 * Rail 4 — Blockchain/Stablecoin Payout. Still future-use scaffolding: no
 * route in this codebase calls getActiveProvider(4). What changed from
 * the original stub is that the entity-secret encryption — the piece
 * explicitly documented as missing — is now implemented for real in
 * lib/circle/index.ts.
 *
 * Requires input.recipient.walletAddress — an email alone isn't a valid
 * destination for a stablecoin transfer, unlike every other rail here.
 * Also requires CIRCLE_TOKEN_ID, since Circle identifies "USDC on Base"
 * vs "USDC on Ethereum" as different token ids, not a currency + chain
 * pair you can compute — that id has to come from the platform's actual
 * Circle wallet setup (GET /v1/w3s/wallets/{id}/balances or the wallet
 * creation response), so it's an env var, not derived here.
 */
export const circleProvider: PayoutProvider = {
  key: "circle",
  rail: 4,

  async createPayout(input: CreatePayoutInput): Promise<PayoutResult> {
    if (!process.env.CIRCLE_API_KEY) {
      throw new ProviderNotConfiguredError("circle")
    }
    if (!input.recipient.walletAddress) {
      throw new Error("Rail 4 requires recipient.walletAddress")
    }
    const sourceWalletId = process.env.CIRCLE_SOURCE_WALLET_ID
    const tokenId = process.env.CIRCLE_TOKEN_ID
    if (!sourceWalletId) throw new Error("CIRCLE_SOURCE_WALLET_ID is not configured")
    if (!tokenId) throw new Error("CIRCLE_TOKEN_ID is not configured")

    const transfer = await createStablecoinTransfer({
      idempotencyKey: input.idempotencyKey,
      amount: input.amount,
      destinationWalletAddress: input.recipient.walletAddress,
      sourceWalletId,
      tokenId,
    })

    return { providerPayoutId: transfer.id, status: "pending" }
  },

  async getPayoutStatus(providerPayoutId: string) {
    const transfer = await getTransferStatus(providerPayoutId)
    return { status: transfer.status }
  },
}

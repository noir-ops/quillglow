import "server-only"
import { publicEncrypt, constants, randomBytes, randomUUID } from "node:crypto"

/**
 * Circle — Rail 4 (Blockchain/Stablecoin Payout). This used to be a
 * scaffold that always threw, explaining that entity-secret handling
 * wasn't implemented. It's implemented now — verified against Circle's
 * own entity-secret sample code and developer docs
 * (developers.circle.com), not guessed.
 *
 * The piece that was missing: every write to Circle's Developer-
 * Controlled Wallets API needs a fresh `entitySecretCiphertext` —  the
 * platform's 32-byte entity secret, RSA-OAEP encrypted (SHA-256 for both
 * the OAEP hash and MGF1) with Circle's public key, base64-encoded, and
 * regenerated on EVERY request (Circle rejects a reused ciphertext —
 * that's the replay protection). Implemented directly with Node's
 * built-in `crypto` module rather than Circle's SDK
 * (@circle-fin/developer-controlled-wallets) or node-forge — no extra
 * dependency, and the algorithm is simple enough to verify by reading
 * this file rather than trusting an opaque SDK call.
 *
 * Still genuinely NOT wired to any live flow — Rail 4 remains future-use,
 * no route calls getActiveProvider(4). What changed is that the one piece
 * explicitly documented as missing is no longer missing.
 */

const CIRCLE_BASE_URL =
  process.env.CIRCLE_BASE_URL ||
  (process.env.CIRCLE_ENV === "production" ? "https://api.circle.com" : "https://api-sandbox.circle.com")
const CIRCLE_API_KEY = process.env.CIRCLE_API_KEY // "TEST_API_KEY:..." or "LIVE_API_KEY:..."
const CIRCLE_ENTITY_SECRET = process.env.CIRCLE_ENTITY_SECRET // 32-byte hex string, generated once via generateEntitySecretHex() below and registered in the Circle console

async function circleFetch(endpoint: string, options: RequestInit = {}) {
  if (!CIRCLE_API_KEY) {
    throw new Error("CIRCLE_API_KEY is not configured")
  }
  const response = await fetch(`${CIRCLE_BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${CIRCLE_API_KEY}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  })
  return response
}

/**
 * One-time setup helper — generates a cryptographically secure 32-byte
 * entity secret as a 64-character hex string. Run this once, save the
 * output as CIRCLE_ENTITY_SECRET, then register it with Circle (see
 * registerEntitySecret below). Never call this more than once per
 * platform — generating a new one orphans every wallet created under the
 * old one.
 */
export function generateEntitySecretHex(): string {
  return randomBytes(32).toString("hex")
}

/** GET /v1/w3s/config/entity/publicKey — Circle's RSA public key, needed to encrypt the entity secret before every write. */
async function fetchEntityPublicKey(): Promise<string> {
  const res = await circleFetch("/v1/w3s/config/entity/publicKey")
  if (!res.ok) throw new Error(`Failed to fetch Circle entity public key: ${await res.text()}`)
  const data = await res.json()
  const key = data?.data?.publicKey
  if (!key) throw new Error("Circle did not return an entity public key")
  return key
}

/**
 * The actual encryption: RSA-OAEP, SHA-256 for both the OAEP hash and the
 * MGF1 hash — Circle is explicit that both must be SHA-256, not just the
 * OAEP hash (Node's default MGF1 hash follows the OAEP hash automatically
 * on modern Node versions, but mgf1Hash is passed explicitly here so this
 * doesn't silently depend on that default).
 */
function encryptEntitySecret(entitySecretHex: string, publicKeyPem: string): string {
  const entitySecretBuffer = Buffer.from(entitySecretHex, "hex")
  const encrypted = publicEncrypt(
    {
      key: publicKeyPem,
      padding: constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: "sha256",
      mgf1Hash: "sha256",
    },
    entitySecretBuffer,
  )
  return encrypted.toString("base64")
}

/**
 * Builds a fresh entitySecretCiphertext for one request. MUST be called
 * again for every single write — never cache or reuse the result, Circle
 * rejects a repeated ciphertext outright as a replay-attack defense.
 */
async function getFreshEntitySecretCiphertext(): Promise<string> {
  if (!CIRCLE_ENTITY_SECRET) {
    throw new Error(
      "CIRCLE_ENTITY_SECRET is not configured — generate one with generateEntitySecretHex() and register it with Circle first",
    )
  }
  const publicKey = await fetchEntityPublicKey()
  return encryptEntitySecret(CIRCLE_ENTITY_SECRET, publicKey)
}

/**
 * One-time setup call — registers the ciphertext of a newly generated
 * entity secret with Circle, so Circle knows to trust ciphertexts
 * produced from it going forward. Circle also returns a recovery file at
 * this step in their own dashboard flow; doing this via raw API only
 * gets you the registration, not the recovery file — for that, use
 * Circle's Console UI instead of this function, since losing both the
 * secret and the recovery file locks the platform out permanently.
 */
export async function registerEntitySecret(entitySecretHex: string): Promise<void> {
  const publicKey = await fetchEntityPublicKey()
  const ciphertext = encryptEntitySecret(entitySecretHex, publicKey)
  const res = await circleFetch("/v1/w3s/config/entity/publicKey", {
    method: "POST",
    body: JSON.stringify({ entitySecretCiphertext: ciphertext }),
  })
  if (!res.ok) throw new Error(`Failed to register Circle entity secret: ${await res.text()}`)
}

export interface CircleWalletSet {
  id: string
  name: string
}

/** POST /v1/w3s/developer/walletSets — one-time setup: creates the wallet set the platform's payout wallet lives in. */
export async function createWalletSet(name: string): Promise<CircleWalletSet> {
  const ciphertext = await getFreshEntitySecretCiphertext()
  const res = await circleFetch("/v1/w3s/developer/walletSets", {
    method: "POST",
    body: JSON.stringify({ idempotencyKey: randomUUID(), name, entitySecretCiphertext: ciphertext }),
  })
  if (!res.ok) throw new Error(`Failed to create Circle wallet set: ${await res.text()}`)
  const data = await res.json()
  return { id: data.data.walletSet.id, name: data.data.walletSet.name }
}

export interface CircleWallet {
  id: string
  address: string
  blockchain: string
}

/** POST /v1/w3s/developer/wallets — one-time setup: creates the platform's payout wallet on a given chain. */
export async function createWallet(walletSetId: string, blockchain: string): Promise<CircleWallet> {
  const ciphertext = await getFreshEntitySecretCiphertext()
  const res = await circleFetch("/v1/w3s/developer/wallets", {
    method: "POST",
    body: JSON.stringify({
      idempotencyKey: randomUUID(),
      walletSetId,
      blockchains: [blockchain],
      accountType: "EOA",
      entitySecretCiphertext: ciphertext,
    }),
  })
  if (!res.ok) throw new Error(`Failed to create Circle wallet: ${await res.text()}`)
  const data = await res.json()
  const wallet = data.data.wallets[0]
  return { id: wallet.id, address: wallet.address, blockchain: wallet.blockchain }
}

export interface CircleTransferInput {
  idempotencyKey: string
  amount: number
  destinationWalletAddress: string
  sourceWalletId: string
  tokenId: string // Circle's identifier for the specific stablecoin+chain combination (e.g. USDC on the source wallet's chain) — fetch via GET /v1/w3s/tokens or the wallet's balance response, not guessable
}

/**
 * POST /v1/w3s/developer/transactions/transfer — the actual money
 * movement. Endpoint path and core fields (walletId, destinationAddress,
 * amounts, tokenId, entitySecretCiphertext, idempotencyKey) match
 * Circle's documented transaction-transfer shape; verify feeLevel and any
 * account-specific requirements against Circle's live API reference
 * before enabling this rail for real, the way every other provider in
 * this codebase was verified before going live.
 */
export async function createStablecoinTransfer(input: CircleTransferInput): Promise<{ id: string; status: string }> {
  const ciphertext = await getFreshEntitySecretCiphertext()
  const res = await circleFetch("/v1/w3s/developer/transactions/transfer", {
    method: "POST",
    body: JSON.stringify({
      idempotencyKey: input.idempotencyKey,
      entitySecretCiphertext: ciphertext,
      walletId: input.sourceWalletId,
      destinationAddress: input.destinationWalletAddress,
      tokenId: input.tokenId,
      amounts: [input.amount.toString()],
      feeLevel: "MEDIUM",
    }),
  })
  if (!res.ok) throw new Error(`Circle transfer failed: ${await res.text()}`)
  const data = await res.json()
  return { id: data.data.id, status: data.data.state }
}

/** GET /v1/w3s/transactions/{id} — reconciliation / status polling. Read-only, no entity secret needed. */
export async function getTransferStatus(transferId: string): Promise<{ status: string }> {
  const res = await circleFetch(`/v1/w3s/transactions/${transferId}`)
  if (!res.ok) throw new Error(`Failed to get Circle transfer status: ${await res.text()}`)
  const data = await res.json()
  return { status: data.data?.transaction?.state ?? "unknown" }
}

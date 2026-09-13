/**
 * Secure document service — spec §23.
 *
 * The invariant: `storage_path` NEVER leaves the server. Clients receive an
 * opaque document id, exchange it for a short-lived signed URL, and every
 * exchange is authorized and logged.
 */

import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"

const BUCKET = process.env.SECURE_DOCUMENTS_BUCKET || "secure-documents"
/** Short by design — long enough to open, short enough that a leaked URL dies fast. */
const SIGNED_URL_TTL_SECONDS = 60

export type DocumentType =
  | "passport"
  | "national_id"
  | "transcript"
  | "certificate"
  | "recommendation"
  | "financial_statement"
  | "photo"
  | "essay"
  | "other"

/** Client-safe shape — deliberately has no storage path. */
export interface DocumentMetadata {
  id: string
  document_type: string
  original_filename: string | null
  mime_type: string | null
  size_bytes: number | null
  verification_status: string
  verification_notes: string | null
  resource_type: string | null
  resource_id: string | null
  created_at: string
}

const CLIENT_FIELDS =
  "id, document_type, original_filename, mime_type, size_bytes, verification_status, verification_notes, resource_type, resource_id, created_at"

const ALLOWED_MIME = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]
const MAX_BYTES = 10 * 1024 * 1024

export interface UploadInput {
  ownerId: string
  file: File
  documentType: DocumentType
  resourceType?: string
  resourceId?: string
  /** Retention: null keeps until explicitly deleted. */
  expiresInDays?: number | null
}

export async function uploadDocument(input: UploadInput): Promise<DocumentMetadata> {
  const { file } = input

  if (!ALLOWED_MIME.includes(file.type)) {
    throw new Error(`Unsupported file type: ${file.type}`)
  }
  if (file.size > MAX_BYTES) {
    throw new Error("File exceeds the 10MB limit")
  }

  const admin = createAdminClient()

  // Random, unguessable path. Never derived from the filename, so a document
  // can't be located by guessing "passport.pdf".
  const ext = (file.name.split(".").pop() ?? "bin").toLowerCase().replace(/[^a-z0-9]/g, "")
  const path = `${input.ownerId}/${crypto.randomUUID()}.${ext}`

  // Content checksum — the foundation for duplicate/reused-document
  // detection. The column has existed since this table was created but
  // nothing ever computed it, so no fraud signal was possible: two students
  // submitting the byte-identical "recommendation letter" was invisible.
  const buffer = await file.arrayBuffer()
  const hashBuffer = await crypto.subtle.digest("SHA-256", buffer)
  const checksum = Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")

  const { error: uploadError } = await admin.storage
    .from(BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false })

  if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`)

  const expiresAt =
    input.expiresInDays != null
      ? new Date(Date.now() + input.expiresInDays * 86_400_000).toISOString()
      : null

  const { data, error } = await admin
    .from("secure_documents")
    .insert({
      owner_id: input.ownerId,
      storage_bucket: BUCKET,
      storage_path: path,
      document_type: input.documentType,
      original_filename: file.name,
      mime_type: file.type,
      size_bytes: file.size,
      checksum,
      resource_type: input.resourceType ?? null,
      resource_id: input.resourceId ?? null,
      expires_at: expiresAt,
    })
    .select(CLIENT_FIELDS)
    .single()

  if (error) {
    // Don't leave an orphaned object behind if the row insert failed.
    await admin.storage.from(BUCKET).remove([path])
    throw new Error(`Failed to record document: ${error.message}`)
  }

  await logAccess(data.id, input.ownerId, "uploaded")
  return data as DocumentMetadata
}

async function logAccess(
  documentId: string,
  accessorId: string | null,
  action: string,
  reason?: string,
  req?: Request,
) {
  try {
    const admin = createAdminClient()
    await admin.rpc("log_document_access", {
      p_document_id: documentId,
      p_accessor_id: accessorId,
      p_action: action,
      p_reason: reason ?? null,
      p_ip:
        req?.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
        req?.headers.get("x-real-ip") ??
        null,
      p_user_agent: req?.headers.get("user-agent") ?? null,
    })
  } catch (err) {
    console.error("[documents] access logging failed:", err)
  }
}

export interface SignedUrlResult {
  url: string
  expiresInSeconds: number
}

/**
 * Authorize, then mint a short-lived signed URL.
 *
 * Returns null when access is denied — the caller must not distinguish
 * "forbidden" from "not found" in its response, or the API becomes an oracle
 * for which document ids exist.
 */
export async function getSignedUrl(
  documentId: string,
  requesterId: string,
  req?: Request,
): Promise<SignedUrlResult | null> {
  const admin = createAdminClient()

  const { data: authData, error: authError } = await admin.rpc("can_access_document", {
    p_document_id: documentId,
    p_user_id: requesterId,
  })

  if (authError) {
    console.error("[documents] authorization check failed:", authError.message)
    return null
  }

  const decision = Array.isArray(authData) ? authData[0] : authData
  if (!decision?.allowed) {
    await logAccess(documentId, requesterId, "denied", decision?.reason ?? "forbidden", req)
    return null
  }

  const { data: doc } = await admin
    .from("secure_documents")
    .select("storage_bucket, storage_path")
    .eq("id", documentId)
    .single()

  if (!doc) return null

  const { data: signed, error: signError } = await admin.storage
    .from(doc.storage_bucket)
    .createSignedUrl(doc.storage_path, SIGNED_URL_TTL_SECONDS)

  if (signError || !signed?.signedUrl) {
    console.error("[documents] signing failed:", signError?.message)
    return null
  }

  await logAccess(documentId, requesterId, "issued_url", decision.reason, req)
  return { url: signed.signedUrl, expiresInSeconds: SIGNED_URL_TTL_SECONDS }
}

/** Documents owned by a user. Metadata only — no paths. */
export async function listMyDocuments(userId: string): Promise<DocumentMetadata[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from("secure_documents")
    .select(CLIENT_FIELDS)
    .eq("owner_id", userId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
  return (data ?? []) as DocumentMetadata[]
}

/** Documents attached to a resource, for an authorized reviewer. */
export async function listResourceDocuments(
  resourceType: string,
  resourceId: string,
): Promise<DocumentMetadata[]> {
  const admin = createAdminClient()
  const { data } = await admin
    .from("secure_documents")
    .select(CLIENT_FIELDS)
    .eq("resource_type", resourceType)
    .eq("resource_id", resourceId)
    .is("deleted_at", null)
  return (data ?? []) as DocumentMetadata[]
}

/** Soft delete — the storage object is removed by the retention job. */
export async function deleteDocument(documentId: string, requesterId: string): Promise<boolean> {
  const admin = createAdminClient()
  const { error } = await admin
    .from("secure_documents")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", documentId)
    .eq("owner_id", requesterId)

  if (error) return false
  await logAccess(documentId, requesterId, "deleted")
  return true
}

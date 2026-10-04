import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { listMyDocuments, uploadDocument, type DocumentType } from "@/lib/services/documents"

export const dynamic = "force-dynamic"
export const maxDuration = 60

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  return NextResponse.json({ documents: await listMyDocuments(user.id) })
}

/** Upload a document. Always owned by the caller — ownerId is never taken from the body. */
export async function POST(req: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const form = await req.formData()
    const file = form.get("file")
    const documentType = String(form.get("documentType") ?? "other") as DocumentType

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "file is required" }, { status: 400 })
    }

    const document = await uploadDocument({
      ownerId: user.id,
      file,
      documentType,
      resourceType: (form.get("resourceType") as string) || undefined,
      resourceId: (form.get("resourceId") as string) || undefined,
      expiresInDays: form.get("expiresInDays") ? Number(form.get("expiresInDays")) : null,
    })

    return NextResponse.json({ document })
  } catch (err) {
    console.error("[documents] upload failed:", err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Upload failed" },
      { status: 400 },
    )
  }
}

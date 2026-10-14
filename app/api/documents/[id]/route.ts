import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { deleteDocument, getSignedUrl } from "@/lib/services/documents"

export const dynamic = "force-dynamic"

/**
 * Exchange a document id for a short-lived signed URL — spec §23.
 *
 * Denied and non-existent both return 404. Distinguishing them would let a
 * caller enumerate which document ids exist.
 */
/** params is a Promise in Next 16 — see the note in the sprout sessions route. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const signed = await getSignedUrl(id, user.id, req)
  if (!signed) return NextResponse.json({ error: "Not found" }, { status: 404 })

  return NextResponse.json(signed, {
    // Never let a signed URL sit in a shared cache.
    headers: { "Cache-Control": "no-store, no-cache, must-revalidate, private" },
  })
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const ok = await deleteDocument(id, user.id)
  return ok ? NextResponse.json({ success: true }) : NextResponse.json({ error: "Not found" }, { status: 404 })
}

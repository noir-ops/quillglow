import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getIndexStatus } from "@/lib/ai/rag/indexer"

export const dynamic = "force-dynamic"

/** Index health: which namespaces are indexed, under which embedding model. */
export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  return NextResponse.json(await getIndexStatus())
}

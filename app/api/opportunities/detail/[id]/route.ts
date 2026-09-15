import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

/** Public detail for the Apply dialog — only approved+active listings, matching the same visibility RLS students already get on the list. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data, error } = await supabase
    .from("opportunities")
    .select("id, title, description, requires_essay, requires_recommendation, deadline, is_rolling")
    .eq("id", id)
    .eq("status", "active")
    .eq("review_status", "approved")
    .single()

  if (error || !data) return NextResponse.json({ error: "Not found" }, { status: 404 })
  return NextResponse.json({ opportunity: data })
}

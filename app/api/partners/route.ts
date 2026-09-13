import { createServerClient } from "@/lib/supabase/server"

export async function GET(request: Request) {
  const supabase = await createServerClient()
  const { searchParams } = new URL(request.url)

  const search = searchParams.get("search")?.toLowerCase() || ""
  const type = searchParams.get("type") || "all"
  const sort = searchParams.get("sort") || "featured"

  try {
    let query = supabase.from("partners").select("*")

    // Filter by type
    if (type !== "all") {
      query = query.eq("type", type)
    }

    const { data, error } = await query

    if (error) throw error

    // Filter by search
    let filtered = data || []
    if (search) {
      filtered = filtered.filter(
        (partner) =>
          partner.name.toLowerCase().includes(search) ||
          partner.description.toLowerCase().includes(search) ||
          partner.tags.some((tag: string) => tag.toLowerCase().includes(search)),
      )
    }

    // Sort
    if (sort === "featured") {
      filtered.sort((a, b) => {
        if (a.featured === b.featured) {
          return a.name.localeCompare(b.name)
        }
        return a.featured ? -1 : 1
      })
    } else if (sort === "a-z") {
      filtered.sort((a, b) => a.name.localeCompare(b.name))
    }

    return Response.json({ partners: filtered })
  } catch (error) {
    console.error("[v0] Error fetching partners:", error)
    return Response.json({ error: "Failed to fetch partners" }, { status: 500 })
  }
}

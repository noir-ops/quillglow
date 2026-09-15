import { createServerClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function GET() {
  try {
    const supabase = await createServerClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data: memory, error } = await supabase
      .from("tutor_memory")
      .select("*")
      .eq("user_id", user.id)
      .order("last_seen", { ascending: false })

    if (error) {
      console.error("Error fetching tutor memory:", error)
      return NextResponse.json({ error: "Failed to fetch memory" }, { status: 500 })
    }

    return NextResponse.json({ memory: memory || [] })
  } catch (error) {
    console.error("Tutor memory error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createServerClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { subject, topic, confidence_level } = body

    if (!subject || !topic) {
      return NextResponse.json({ error: "Subject and topic are required" }, { status: 400 })
    }

    const { data, error } = await supabase
      .from("tutor_memory")
      .upsert(
        {
          user_id: user.id,
          subject,
          topic,
          confidence_level: confidence_level || "medium",
          last_seen: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "user_id,subject,topic",
        },
      )
      .select()
      .single()

    if (error) {
      console.error("Error updating tutor memory:", error)
      return NextResponse.json({ error: "Failed to update memory" }, { status: 500 })
    }

    return NextResponse.json({ memory: data })
  } catch (error) {
    console.error("Tutor memory error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const supabase = await createServerClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const memoryId = searchParams.get("id")

    if (memoryId) {
      // Delete specific memory
      await supabase.from("tutor_memory").delete().eq("id", memoryId).eq("user_id", user.id)
    } else {
      // Delete all memory (reset)
      await supabase.from("tutor_memory").delete().eq("user_id", user.id)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Tutor memory delete error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { readBillingRollout, publicPricing } from "@/lib/billing/pricing"
export const dynamic = "force-dynamic"
export async function GET(req: Request) {
  const client = await createClient(), { data: { user } } = await client.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  try {
    if (!publicPricing(await readBillingRollout()).phase3Enabled) return NextResponse.json({ enabled: false, steps: [] })
    const { data: plan, error: planError } = await client.rpc("my_plan")
    if (planError) return NextResponse.json({ error: "Could not verify access" }, { status: 503 })
    if (plan !== "genius") return NextResponse.json({ error: "Personalized next steps are included with Genius", upgradeUrl: "/upgrade" }, { status: 403 })
    const id = new URL(req.url).searchParams.get("sessionId")
    if (!id || id.length > 100) return NextResponse.json({ error: "Session ID required" }, { status: 400 })
    const { data: session, error } = await client.from("study_agent_sessions").select("analysis,weakness_insights").eq("id", id).eq("user_id", user.id).maybeSingle()
    if (error) throw error
    if (!session) return NextResponse.json({ error: "Study system not found" }, { status: 404 })
    const topic = String(session.weakness_insights?.priorityGaps?.[0]?.topic || session.analysis?.mainTopics?.[0] || session.analysis?.subject || "your current topic").slice(0, 180)
    return NextResponse.json({ enabled: true, steps: [
      { title: `Reinforce ${topic}`, description: "Reflect on the topic and explain it in your own words.", href: `/echomind?mode=my_knowledge&topic=${encodeURIComponent(topic)}` },
      { title: "Schedule your next review", description: "Use your saved study system to organize the next study session.", href: "/planner" },
      { title: "Practice with your saved flashcards", description: "Open your generated deck and test active recall.", href: "/flashcards" },
    ] }, { headers: { "Cache-Control": "private, no-store" } })
  } catch { return NextResponse.json({ error: "Could not load next steps" }, { status: 503 }) }
}

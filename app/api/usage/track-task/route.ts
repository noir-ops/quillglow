import { NextResponse } from "next/server"
import { incrementUsage } from "@/lib/utils/usage-tracking"

export async function POST() {
  try {
    await incrementUsage("tasks_created", 1)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[v0] Error tracking task:", error)
    return NextResponse.json({ error: "Failed to track task" }, { status: 500 })
  }
}

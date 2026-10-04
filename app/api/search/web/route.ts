import { NextResponse } from "next/server"

/**
 * Retired. This powered the Browse page, which was merged into Study AI
 * (/tutor); nothing in the app calls it any more. It made paid Google Search,
 * YouTube and AI calls, so it now refuses before doing any work.
 */
export async function POST() {
  return NextResponse.json({ error: "gone", message: "Browse has moved into Study AI." }, { status: 410 })
}

export async function GET() {
  return NextResponse.json({ error: "gone", message: "Browse has moved into Study AI." }, { status: 410 })
}

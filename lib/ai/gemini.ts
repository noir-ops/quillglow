import { google } from "@ai-sdk/google"

console.log("[v0] Initializing Gemini configuration...")
console.log("[v0] GEMINI_API_KEY exists:", !!process.env.GEMINI_API_KEY)
console.log("[v0] GEMINI_API_KEY length:", process.env.GEMINI_API_KEY?.length || 0)

if (!process.env.GEMINI_API_KEY) {
  console.error("[v0] ERROR: GEMINI_API_KEY is not set in environment variables!")
  throw new Error("GEMINI_API_KEY is not set in environment variables. Please add it to your .env.local file.")
}

console.log("[v0] Creating Gemini 2.5 Flash model instance...")

export const gemini = google("gemini-2.5-flash", {
  apiKey: process.env.GEMINI_API_KEY,
})

console.log("[v0] Gemini model configured successfully")

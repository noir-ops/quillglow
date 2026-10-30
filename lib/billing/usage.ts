/**
 * Learner-facing usage, read from the same plan_limits rows the quota engine
 * enforces — so anything shown ("3 of 5 left") is exactly what's applied.
 * Replaces the hand-written PLAN_LIMITS constant, which disagreed with the
 * server (e.g. LearnCast 5 shown vs 3 enforced).
 */
import type { AIFeature } from "@/lib/services/quota"

export interface FeatureInfo {
  label: string
  /** What one unit is, for "3 of 5 <unit> left". */
  unit: string
  group: "Learn" | "Prepare" | "AI Hub"
}

/** Every metered feature, in the order Settings lists them. */
export const FEATURE_INFO: Partial<Record<AIFeature, FeatureInfo>> = {
  ai_total: { label: "Combined AI allowance", unit: "units", group: "AI Hub" },
  tutor_chat: { label: "AI Tutor (Study AI + Sprout AI)", unit: "messages", group: "Learn" },
  quilly_chat: { label: "Quilly chat", unit: "messages", group: "Learn" },
  revision_notes: { label: "AI revision notes", unit: "notes", group: "Learn" },
  flashcards: { label: "AI flashcards", unit: "cards", group: "Learn" },
  mind_map: { label: "Mind Maps", unit: "maps", group: "Learn" },
  audio_overview: { label: "LearnCast", unit: "episodes", group: "Learn" },
  writereal_detect: { label: "WriteReal · AI Detector", unit: "checks", group: "Learn" },
  writereal_grammar: { label: "WriteReal · Grammar Checker", unit: "checks", group: "Learn" },
  writereal_humanize: { label: "WriteReal · AI Humanizer", unit: "rewrites", group: "Learn" },
  writereal_paraphrase: { label: "WriteReal · Paraphraser", unit: "rewrites", group: "Learn" },
  study_agent: { label: "StudyPilot", unit: "runs", group: "Prepare" },
  study_plan: { label: "Study Planner AI plans", unit: "plans", group: "Prepare" },
  task_suggestions: { label: "AI task suggestions", unit: "suggestions", group: "Prepare" },
  syllabus_analysis: { label: "Syllabus analysis", unit: "analyses", group: "Prepare" },
  weekly_review: { label: "Weekly review tests", unit: "tests", group: "Prepare" },
  exam_questions: { label: "Practice exams", unit: "exams", group: "Prepare" },
  mock_exam: { label: "Mock MCQ exams", unit: "exams", group: "Prepare" },
  essay: { label: "Essay writer", unit: "essays", group: "Prepare" },
  echomind: { label: "EchoMind", unit: "sessions", group: "AI Hub" },
  stress_relief: { label: "Stress-relief chat", unit: "messages", group: "AI Hub" },
  quest_generation: { label: "Quests", unit: "quests", group: "AI Hub" },
}

export interface FeatureUsage {
  feature: string
  plan: "scholar" | "genius"
  isGenius: boolean
  used: number
  /** -1 = no limit, 0 = not included in this plan */
  limit: number
  remaining: number
  /** Kept for existing callers that read these names. */
  unlimited: boolean
  upgradeLimit?: number | null
  blocked?: boolean
  blockingFeature?: string
  resetDate?: string
}

export class UsageUnavailableError extends Error {}

export function nextUsageReset(): string {
  const now = new Date()
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)).toISOString()
}

export async function getAllUsage(supabase: any, userId: string): Promise<FeatureUsage[]> {
  const { data, error } = await supabase.rpc("get_ai_quota_status", { p_user_id: userId })
  if (error) {
    console.error("[billing] usage read failed:", error.message)
    throw new UsageUnavailableError("Usage checks are temporarily unavailable")
  }
  if (!Array.isArray(data) || !data.length || data.some((r: any) =>
    typeof r.feature !== "string" || !["scholar", "genius"].includes(r.plan) ||
    !Number.isInteger(r.used) || r.used < 0 || !Number.isInteger(r.limit) || r.limit < -1 ||
    !Number.isInteger(r.remaining) || r.remaining !== (r.limit === -1 ? -1 : Math.max(0, r.limit - r.used)))) {
    throw new UsageUnavailableError("Usage response is incomplete")
  }
  return data.map((r: any) => ({
    feature: r.feature,
    plan: r.plan === "genius" ? "genius" : "scholar",
    isGenius: r.plan === "genius",
    used: Number(r.used ?? 0),
    limit: Number(r.limit ?? 0),
    remaining: Number(r.remaining ?? 0),
    unlimited: Number(r.limit) < 0,
    resetDate: nextUsageReset(),
  }))
}

export async function getFeatureUsage(supabase: any, userId: string, feature: AIFeature): Promise<FeatureUsage> {
  const all = await getAllUsage(supabase, userId)
  const row = all.find((r) => r.feature === feature)
  if (!row) throw new UsageUnavailableError(`Missing allowance for ${feature}`)
  const total = all.find((r) => r.feature === "ai_total")
  const blocked = row.limit >= 0 && row.remaining === 0
  const totalBlocked = !!total && total.limit >= 0 && total.remaining === 0
  const { data: upgrade } = await supabase.from("plan_limits").select("monthly_limit")
    .eq("plan_type", "genius").eq("feature", feature).maybeSingle()
  return { ...row, blocked: blocked || totalBlocked, blockingFeature: totalBlocked ? "ai_total" : feature,
    upgradeLimit: Number.isInteger(upgrade?.monthly_limit) ? upgrade.monthly_limit : null }
}

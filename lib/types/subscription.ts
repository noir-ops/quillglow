export type PlanType = "scholar" | "genius"

export interface Subscription {
  id: string
  user_id: string
  plan_type: PlanType
  polar_customer_id?: string
  polar_subscription_id?: string
  polar_product_id?: string
  polar_checkout_id?: string
  status: "active" | "canceled" | "past_due"
  current_period_start?: string
  current_period_end?: string
  created_at: string
  updated_at: string
}

export interface UsageTracking {
  id: string
  user_id: string
  month_year: string
  tasks_created: number
  ai_generations_used: number
  created_at: string
  updated_at: string
}

export interface PlanLimits {
  tasks_per_month: number
  flashcards_total: number
  notes_total: number
  ai_generations_per_month: number
  voice_to_text: boolean
  mind_maps_per_month: number
  revision_notes_per_month: number
  audio_overviews_per_month: number
}

export const PLAN_LIMITS: Record<PlanType, PlanLimits> = {
  scholar: {
    tasks_per_month: 50,
    flashcards_total: 100,
    notes_total: 20,
    ai_generations_per_month: 3,    // study plans
    voice_to_text: false,
    mind_maps_per_month: 5,
    revision_notes_per_month: 5,
    audio_overviews_per_month: 5,
  },
  genius: {
    tasks_per_month: -1,            // unlimited
    flashcards_total: -1,           // unlimited
    notes_total: -1,                // unlimited
    ai_generations_per_month: -1,   // unlimited
    voice_to_text: true,
    mind_maps_per_month: -1,        // unlimited
    revision_notes_per_month: -1,   // unlimited
    audio_overviews_per_month: -1,  // unlimited
  },
}

// Separate named constants for easy reference across the codebase
export const SCHOLAR_LIMITS = {
  mind_maps_per_month: 5,
  revision_notes_per_month: 5,
  audio_overviews_per_month: 5,
  exam_generations_per_month: 3,
  echomind_per_30_days: 3,
  writereal_per_month: 3,
} as const

export const PLAN_DETAILS = {
  scholar: {
    name: "Scholar",
    price: 0,
    description: "Perfect for students starting their journey",
    features: [
      "50 tasks per month",
      "100 flashcards total",
      "20 notes total",
      "3 exam generations per month",
      "3 WriteReal humanizations per month",
      "5 AI mind maps per month",
      "5 revision notes per month",
      "5 audio overviews per month",
      "Basic web search with safe search",
      "Pomodoro timer with presets",
      "Time blocking schedule",
      "Basic analytics & heatmap",
      "Personalized AI tutor (limited)",
      "Community chat access",
      "Study buddy matchmaking",
      "Zen Runner stress-relief game",
    ],
  },
  genius: {
    name: "Genius",
    price: 4.99,
    description: "For serious students who want unlimited access",
    features: [
      "Everything in Scholar, plus:",
      "Unlimited tasks & to-dos",
      "Unlimited flashcards with PDF upload",
      "Unlimited notes",
      "Unlimited AI Study Agent runs",
      "Unlimited exam generations",
      "Unlimited WriteReal humanizations",
      "Unlimited AI mind maps",
      "Unlimited revision notes",
      "Unlimited audio overviews",
      "Advanced web search with AI summaries",
      "Voice-to-text transcription",
      "Custom Pomodoro timer settings",
      "Advanced analytics & insights",
      "Unlimited AI tutor conversations",
      "Priority community features",
      "Private study rooms (unlimited)",
      "Priority support",
    ],
  },
}

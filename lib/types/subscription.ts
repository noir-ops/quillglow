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
      "AI Tutor (Study AI + Sprout AI): 60 messages a month",
      "StudyPilot: 1 full study-system run a month",
      "100 AI flashcards, 5 mind maps, 5 AI revision notes and 5 LearnCasts a month",
      "3 practice exams, 5 mock MCQ exams and 2 weekly review tests a month",
      "3 EchoMind sessions a month",
      "WriteReal: 10 AI checks, plus 3 each of grammar, humanize and paraphrase",
      "Unlimited notes, flashcards and tasks you create yourself",
      "Study Planner, Study Coach and progress analytics",
      "Scholarship discovery and applications",
      "Pomodoro timer, Focus mode and study buddy matchmaking",
    ],
  },
  genius: {
    name: "Genius",
    price: 4.99,
    description: "For serious students who want deeper AI help and higher limits",
    features: [
      "Everything in Scholar, plus:",
      "Higher limits on every AI tool (fair use)",
      "Up to 100 StudyPilot runs and 2,000 AI Tutor messages a month",
      "Up to 300 EchoMind sessions and 60 weekly review tests a month",
      "Deeper StudyPilot output (more exam questions and videos)",
      "Advanced analytics & insights",
      "Private study rooms",
      "Priority support",
    ],
  },
}

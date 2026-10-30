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

export const PLAN_DETAILS = {
  scholar: {
    name: "Scholar",
    price: 0,
    description: "Perfect for students starting their journey",
    features: [
      "Unlimited notes, flashcards and tasks you create yourself",
      "Study Planner, Study Coach and progress analytics",
      "Scholarship discovery and applications",
      "Pomodoro timer, Focus mode and study buddy matchmaking",
    ],
  },
  genius: {
    name: "Genius",
    description: "For serious students who want deeper AI help and higher limits",
    features: [
      "Everything in Scholar, plus:",
      "Higher limits on every AI tool (fair use)",
      "Deeper StudyPilot output (more exam questions and videos)",
      "Advanced analytics & insights",
      "Private study rooms",
      "Priority support",
    ],
  },
}

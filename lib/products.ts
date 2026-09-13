export interface Product {
    id: string
    name: string
    description: string
    priceInCents: number
    originalPriceInCents?: number
    features: {
      tracker: string[]
      insights: string[]
    }
    whatsIncluded: string[]
    rating: {
      score: number
      count: number
    }
  }
  
  export const PRODUCTS: Product[] = [
    {
      id: "digital-study-tracker",
      name: "Digital Study Tracker & Analytics",
      description: "Everything you need to track your study progress and boost productivity in one comprehensive digital package",
      priceInCents: 99, // $2.00
      originalPriceInCents: 200, // $5.00
      features: {
        tracker: [
          "Daily & Weekly Progress Tracking",
          "Assignment Tracking System",
          "Study Schedule Builder",
          "Time Block Planner",
          "Goal Progress Monitor",
        ],
        insights: [
          "Performance Analytics Dashboard",
          "Study Pattern Insights",
          "Productivity Heatmaps",
          "Focus Time Reports",
          "Achievement Tracker",
        ],
      },
      whatsIncluded: [
        "Complete Study Tracking System",
        "Real-time Analytics Dashboard",
        "Mobile & Desktop Optimized",
        "Lifetime Access & Updates",
      ],
      rating: {
        score: 4.9,
        count: 100,
      },
    },
  ]
  
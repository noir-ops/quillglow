"use client"

import { useRef, useState } from "react"
import { motion, useInView } from "framer-motion"
import { Heart, MessageCircle, Sparkles } from "lucide-react"

interface Testimonial {
  id: string
  username: string
  displayName: string
  comment: string
  likes: number
  replies: number
  timeAgo: string
  badge?: string
  badgeColor?: string
  badgeBg?: string
}

const row1: Testimonial[] = [
  {
    id: "1",
    username: "@studyqueen",
    displayName: "Sarah",
    comment: "The AI quiz feature is a game changer! I went from struggling with biology to actually understanding it. My test scores improved by 20%!",
    likes: 1247,
    replies: 34,
    timeAgo: "2d",
    badge: "Biology student",
    badgeColor: "#10B981",
    badgeBg: "#E8FFF4",
  },
  {
    id: "2",
    username: "@mathgenius",
    displayName: "Alex",
    comment: "I was skeptical at first but the smart notes feature literally saved my semester. It summarizes everything perfectly and I can review faster now.",
    likes: 892,
    replies: 21,
    timeAgo: "5d",
    badge: "Maths A-Level",
    badgeColor: "#3B82F6",
    badgeBg: "#E8F4FF",
  },
  {
    id: "3",
    username: "@collegelife",
    displayName: "Emma",
    comment: "The stress relief feature is honestly so underrated. Between exams and assignments I was burning out but this actually helps me take proper breaks.",
    likes: 2103,
    replies: 67,
    timeAgo: "1w",
    badge: "Burnout survivor",
    badgeColor: "#EC4899",
    badgeBg: "#FFF0F6",
  },
  {
    id: "4",
    username: "@premed_student",
    displayName: "Marcus",
    comment: "Used this for my MCAT prep and it is incredible. The quiz generation from my notes is exactly what I needed. Worth every penny of the Genius plan.",
    likes: 1567,
    replies: 45,
    timeAgo: "3d",
    badge: "Pre-Med",
    badgeColor: "#7C3AED",
    badgeBg: "#EDE9FF",
  },
]

const row2: Testimonial[] = [
  {
    id: "5",
    username: "@gradschoolbound",
    displayName: "Priya",
    comment: "Finally an app that actually understands how students study. The timer keeps me focused and the AI summaries are spot on. My GPA went from 3.2 to 3.8!",
    likes: 3421,
    replies: 89,
    timeAgo: "4d",
    badge: "GPA +0.6",
    badgeColor: "#F59E0B",
    badgeBg: "#FFF4E0",
  },
  {
    id: "6",
    username: "@engineeringmajor",
    displayName: "Jake",
    comment: "I have tried so many study apps and this is the only one I actually use daily. Clean interface, does exactly what I need. No fluff.",
    likes: 756,
    replies: 18,
    timeAgo: "6d",
    badge: "Engineering",
    badgeColor: "#10B981",
    badgeBg: "#E8FFF4",
  },
  {
    id: "7",
    username: "@lawschool2025",
    displayName: "Olivia",
    comment: "The amount of time I save with the AI summaries is insane. I can review a whole week of lectures in an hour. This app is helping me survive law school.",
    likes: 1834,
    replies: 52,
    timeAgo: "2d",
    badge: "Law School",
    badgeColor: "#7C3AED",
    badgeBg: "#EDE9FF",
  },
  {
    id: "8",
    username: "@biologynerdd",
    displayName: "Chen",
    comment: "Best study tool I have ever used. The quiz feature alone is worth it. I used to spend hours making flashcards, now it is automatic.",
    likes: 1092,
    replies: 28,
    timeAgo: "1w",
    badge: "Biology",
    badgeColor: "#3B82F6",
    badgeBg: "#E8F4FF",
  },
]

function TestimonialCard({ t }: { t: Testimonial }) {
  const [liked, setLiked] = useState(false)
  const initials = t.displayName.slice(0, 2).toUpperCase()

  return (
    <motion.div
      whileHover={{ y: -6, scale: 1.02, boxShadow: "0 20px 50px rgba(124,58,237,0.12)" }}
      transition={{ type: "spring", stiffness: 250 }}
      className="w-72 shrink-0 mx-3 rounded-3xl bg-white p-6 shadow-lg cursor-default"
      style={{ border: "1.5px solid #EDE9FF" }}
    >
      <div className="flex items-start gap-3 mb-4">
        <div
          className="h-10 w-10 rounded-full flex items-center justify-center shrink-0 text-sm font-800 text-white"
          style={{ background: "linear-gradient(135deg, #7C3AED, #F59E0B)", fontWeight: 800 }}
        >
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-800 text-[#1C1917] text-sm" style={{ fontWeight: 800 }}>{t.displayName}</p>
          <p className="text-xs text-[#6B7280]">{t.username}</p>
        </div>
        {t.badge && (
          <span
            className="shrink-0 text-[10px] font-700 rounded-full px-2.5 py-1"
            style={{ fontWeight: 700, color: t.badgeColor, background: t.badgeBg }}
          >
            {t.badge}
          </span>
        )}
      </div>

      <p className="text-[#1C1917] text-sm leading-relaxed mb-5 font-600" style={{ fontWeight: 600 }}>{t.comment}</p>

      <div className="flex items-center gap-5 text-[#6B7280]">
        <button
          onClick={() => setLiked(l => !l)}
          className="flex items-center gap-1.5 hover:text-[#EC4899] transition-colors"
        >
          <Heart className={`w-4 h-4 transition-all ${liked ? "fill-[#EC4899] text-[#EC4899] scale-110" : ""}`} />
          <span className="text-xs font-700" style={{ fontWeight: 700 }}>{liked ? t.likes + 1 : t.likes}</span>
        </button>
        <div className="flex items-center gap-1.5">
          <MessageCircle className="w-4 h-4" />
          <span className="text-xs font-700" style={{ fontWeight: 700 }}>{t.replies}</span>
        </div>
        <span className="text-xs ml-auto">{t.timeAgo}</span>
      </div>
    </motion.div>
  )
}

export function TestimonialsSection() {
  const ref = useRef<HTMLElement>(null)
  const isInView = useInView(ref, { once: true, margin: "-80px" })

  return (
    <section ref={ref} className="relative py-24 md:py-36 overflow-hidden" style={{ background: "#FFFDF7" }}>
      {/* Orbs */}
      <div className="orb w-[500px] h-[500px] bg-[#7C3AED]/08 top-[-60px] left-[10%]" />
      <div className="orb w-[400px] h-[400px] bg-[#F59E0B]/07 bottom-[-40px] right-[10%]" />

      <div className="relative z-10">
        {/* Header */}
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center mb-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6 }}
            className="mb-5 inline-flex items-center gap-2 rounded-full bg-[#EDE9FF] border border-[#7C3AED]/20 px-5 py-2"
          >
            <Sparkles className="h-4 w-4 text-[#7C3AED]" />
            <span className="text-sm font-700 text-[#7C3AED]" style={{ fontWeight: 700 }}>Loved by Students</span>
          </motion.div>

          <motion.h2
            initial={{ opacity: 0, y: 24 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.7, delay: 0.1 }}
            className="text-4xl md:text-5xl lg:text-6xl font-black text-[#1C1917] leading-[1.05] mb-5"
          >
            19k+ students
            <br />
            <span className="text-gradient-qg">can&apos;t be wrong</span>
          </motion.h2>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-lg text-[#6B7280] max-w-xl mx-auto"
          >
            Real students. Real results. Real change.
          </motion.p>
        </div>

        {/* Row 1 — scrolls left */}
        <div className="relative mb-5 overflow-hidden">
          <div className="absolute left-0 top-0 bottom-0 w-28 z-10 pointer-events-none" style={{ background: "linear-gradient(to right, #FFFDF7, transparent)" }} />
          <div className="absolute right-0 top-0 bottom-0 w-28 z-10 pointer-events-none" style={{ background: "linear-gradient(to left, #FFFDF7, transparent)" }} />
          <div className="flex animate-marquee-l py-3" style={{ width: "max-content" }}>
            {[...row1, ...row1].map((t, i) => <TestimonialCard key={i} t={t} />)}
          </div>
        </div>

        {/* Row 2 — scrolls right */}
        <div className="relative overflow-hidden">
          <div className="absolute left-0 top-0 bottom-0 w-28 z-10 pointer-events-none" style={{ background: "linear-gradient(to right, #FFFDF7, transparent)" }} />
          <div className="absolute right-0 top-0 bottom-0 w-28 z-10 pointer-events-none" style={{ background: "linear-gradient(to left, #FFFDF7, transparent)" }} />
          <div className="flex animate-marquee-r py-3" style={{ width: "max-content" }}>
            {[...row2, ...row2].map((t, i) => <TestimonialCard key={i} t={t} />)}
          </div>
        </div>
      </div>

      
    </section>
  )
}
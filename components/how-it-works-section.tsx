"use client"

import { useRef } from "react"
import { motion, useInView } from "framer-motion"
import { UserPlus, Calendar, Brain, TrendingUp, Award } from "lucide-react"

const steps = [
  {
    num: "01",
    icon: UserPlus,
    title: "Learn",
    desc: "Learn smarter with AI-driven resources tailored to your needs. Sign up in seconds to get started.",
    color: "#7C3AED",
    bg: "#EDE9FF",
    glow: "rgba(124,58,237,0.15)",
  },
  {
    num: "02",
    icon: Calendar,
    title: "Prepare",
    desc: "Prepare for exams with organized study plans, a smart calendar, and focused Pomodoro sessions.",
    color: "#F59E0B",
    bg: "#FFF4E0",
    glow: "rgba(245,158,11,0.15)",
  },
  {
    num: "03",
    icon: Brain,
    title: "Discover",
    desc: "Discover new concepts with flashcards, notes, mind maps, and EchoMind reflections powered by AI.",
    color: "#10B981",
    bg: "#E8FFF4",
    glow: "rgba(16,185,129,0.15)",
  },
  {
    num: "04",
    icon: TrendingUp,
    title: "Progress",
    desc: "Track your progress with study streaks, GPA estimates, burnout risk, and actionable AI insights.",
    color: "#3B82F6",
    bg: "#E8F4FF",
    glow: "rgba(59,130,246,0.15)",
  },
  {
    num: "05",
    icon: Award,
    title: "Opportunity",
    desc: "Turn your progress into real opportunity — get matched to scholarships, grants, and programs.",
    color: "#EC4899",
    bg: "#FFF0F8",
    glow: "rgba(236,72,153,0.15)",
  },
]

export function HowItWorksSection() {
  const ref = useRef<HTMLElement>(null)
  const inView = useInView(ref, { once: true, margin: "-80px" })

  return (
    <section
      ref={ref}
      id="how-it-works"
      className="relative py-28 md:py-36 overflow-hidden"
      style={{ background: "linear-gradient(180deg, #FFFDF7 0%, #F3EEFF 50%, #FFFDF7 100%)" }}
    >
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 h-px w-3/4 bg-gradient-to-r from-transparent via-[#7C3AED]/20 to-transparent" />
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 h-px w-3/4 bg-gradient-to-r from-transparent via-[#7C3AED]/20 to-transparent" />
      </div>

      <div className="relative mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="mb-20 text-center"
        >
          <span className="mb-4 inline-flex rounded-full bg-[#EDE9FF] px-4 py-1.5 text-sm font-700 text-[#7C3AED]">
            How it works
          </span>
          <h2 className="mt-4 text-4xl font-900 tracking-tight text-[#1C1917] md:text-5xl text-balance">
            From zero to{" "}
            <span className="text-gradient-qg">exam-ready</span>{" "}
            in minutes
          </h2>
        </motion.div>

        {/* Steps */}
        <div className="relative grid gap-8 sm:grid-cols-2 lg:grid-cols-5">
          {/* Connecting line — desktop */}
          <div
            aria-hidden
            className="pointer-events-none absolute top-14 left-[10%] right-[10%] hidden h-0.5 lg:block"
            style={{ background: "linear-gradient(90deg, #7C3AED33, #F59E0B33, #10B98133, #3B82F633, #EC489933)" }}
          />

          {steps.map((s, i) => (
            <motion.div
              key={s.num}
              initial={{ opacity: 0, y: 40 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.6, delay: i * 0.14, ease: [0.22, 1, 0.36, 1] }}
              className="relative flex flex-col items-center text-center"
            >
              {/* Icon circle */}
              <motion.div
                whileHover={{ scale: 1.1 }}
                transition={{ type: "spring", stiffness: 300 }}
                className="relative mb-6"
              >
                <div
                  className="absolute -inset-4 rounded-full blur-xl"
                  style={{ background: s.glow }}
                />
                <div
                  className="relative flex h-28 w-28 items-center justify-center rounded-full border-4 border-white shadow-xl"
                  style={{ background: s.bg }}
                >
                  <s.icon className="h-10 w-10" style={{ color: s.color }} />
                </div>
                {/* Step number badge */}
                <div
                  className="absolute -top-2 -right-1 flex h-8 w-8 items-center justify-center rounded-full text-xs font-900 text-white shadow-md"
                  style={{ background: s.color }}
                >
                  {s.num}
                </div>
              </motion.div>

              <h3 className="mb-2 text-lg font-800 text-[#1C1917]">{s.title}</h3>
              <p className="text-sm leading-relaxed text-[#6B7280] max-w-[200px]">{s.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
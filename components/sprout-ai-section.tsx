"use client"

import { useRef } from "react"
import { motion, useInView } from "framer-motion"
import { Sparkles, Target, User, Clock, BookOpen, ClipboardCheck, Compass, ArrowUpRight } from "lucide-react"

const KPIS = [
  { icon: Sparkles, label: "Less searching.", color: "#7C3AED" },
  { icon: Target, label: "Less guesswork.", color: "#EF4444" },
  { icon: User, label: "More personalized guidance.", color: "#F97316" },
  { icon: Clock, label: "More time focused on what matters.", color: "#EAB308" },
]

const PILLS = [
  { icon: BookOpen, label: "Learn smarter", color: "#7C3AED" },
  { icon: ClipboardCheck, label: "Prepare better", color: "#10B981" },
  { icon: Compass, label: "Discover opportunities", color: "#F59E0B" },
  { icon: ArrowUpRight, label: "Know what's next", color: "#EC4899" },
]

export function SproutAISection() {
  const ref = useRef<HTMLElement>(null)
  const inView = useInView(ref, { once: true, margin: "-80px" })

  return (
    <section ref={ref} className="relative py-20 md:py-28 bg-[#FFFDF7] overflow-hidden">
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[420px] w-[420px] rounded-full bg-[#7C3AED]/5 blur-[100px]" />
      </div>

      <div className="relative mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="mb-5 inline-flex items-center gap-2 rounded-full border border-[#7C3AED]/20 bg-[#EDE9FF] px-4 py-1.5 text-sm text-[#7C3AED]"
          style={{ fontWeight: 700 }}
        >
          <Sparkles className="h-4 w-4" />
          Powered by Sprout AI&trade;
        </motion.div>

        <motion.h2
          initial={{ opacity: 0, y: 24 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="text-3xl md:text-4xl lg:text-5xl tracking-tight text-[#1C1917] text-balance"
          style={{ fontWeight: 900 }}
        >
          One intelligence layer,
          <br />
          <span className="text-gradient-qg">smarter education everywhere</span>
        </motion.h2>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="mx-auto mt-5 max-w-2xl text-lg text-[#6B7280] text-balance"
        >
          Sprout AI connects your entire QuillGlow journey — turning what you learn, how you prepare, and what you discover into one intelligent experience.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="mt-8 flex flex-wrap items-center justify-center gap-x-4 gap-y-3"
        >
          {KPIS.map((k, i) => (
            <div key={k.label} className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <k.icon className="h-4 w-4 shrink-0" style={{ color: k.color }} />
                <span className="text-sm text-[#1C1917] whitespace-nowrap" style={{ fontWeight: 600 }}>{k.label}</span>
              </div>
              {i < KPIS.length - 1 && (
                <span className="text-[#D1D5DB] hidden sm:inline" aria-hidden>|</span>
              )}
            </div>
          ))}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="mt-10 flex flex-wrap items-center justify-center gap-3"
        >
          {PILLS.map((p, i) => (
            <div key={p.label} className="flex items-center gap-3">
              <div className="flex items-center gap-2 rounded-full border-2 border-[#E9E4FF] bg-white px-5 py-3 shadow-sm">
                <p.icon className="h-4 w-4" style={{ color: p.color }} />
                <span className="text-sm text-[#1C1917] whitespace-nowrap" style={{ fontWeight: 700 }}>{p.label}</span>
              </div>
              {i < PILLS.length - 1 && (
                <span className="text-[#D1D5DB]" aria-hidden>
                  →
                </span>
              )}
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  )
}

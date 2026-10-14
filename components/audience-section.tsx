"use client"

import { useRef } from "react"
import { motion, useInView } from "framer-motion"
import { GraduationCap, HeartHandshake, Landmark, ArrowRight } from "lucide-react"
import Link from "next/link"

const AUDIENCES = [
  {
    icon: GraduationCap,
    title: "Learner",
    subtitle: "You're the one studying",
    desc: "AI tutoring, flashcards, mind maps, and a real scholarship wallet — get paid your way once you're awarded.",
    color: "#7C3AED",
    bg: "#EDE9FF",
    cta: "Start Free",
    href: "/pricing",
  },
  {
    icon: HeartHandshake,
    title: "Guide",
    subtitle: "You support a learner — family or mentor",
    desc: "See a linked student's progress, message them, set goals that show up in their own planner, and optionally fund their Genius plan or shop purchases.",
    color: "#10B981",
    bg: "#E8FFF4",
    cta: "Create a Guide account",
    href: process.env.NEXT_PUBLIC_GUARDIAN_URL || "https://guide.quillglow.com",
  },
  {
    icon: Landmark,
    title: "Impact Partner",
    subtitle: "You fund scholarships",
    desc: "List scholarships, review applicants, and disburse real awards — gift card, institution payment, bank transfer, or blockchain.",
    color: "#F59E0B",
    bg: "#FFF4E0",
    cta: "Become an Impact Partner",
    href: process.env.NEXT_PUBLIC_BENEFACTOR_URL || "https://impact.quillglow.com",
  },
]

const fadeUp = {
  hidden: { opacity: 0, y: 32 },
  show: (i: number) => ({
    opacity: 1, y: 0,
    transition: { duration: 0.55, delay: i * 0.1, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] },
  }),
}

export function AudienceSection() {
  const ref = useRef<HTMLElement>(null)
  const inView = useInView(ref, { once: true, margin: "-80px" })

  return (
    <section id="audience" ref={ref} className="relative py-28 md:py-36 bg-[#FFFDF7] scroll-mt-24">
      <div className="relative mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="mb-16 text-center"
        >
          <h2
            className="text-4xl tracking-tight text-[#1C1917] md:text-5xl lg:text-6xl text-balance"
            style={{ fontWeight: 900 }}
          >
            One platform,{" "}
            <span className="text-gradient-qg">three kinds of</span>
            <br />
            <span className="text-gradient-qg">people</span>
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-[#6B7280] text-balance">
            QuillGlow isn&apos;t only for students. Whoever you are in a student&apos;s life, there&apos;s an account for you.
          </p>
        </motion.div>

        {/* Cards */}
        <div className="grid gap-6 md:grid-cols-3">
          {AUDIENCES.map((a, i) => (
            <motion.div
              key={a.title}
              custom={i}
              variants={fadeUp}
              initial="hidden"
              animate={inView ? "show" : "hidden"}
              className="flex flex-col rounded-3xl border-2 border-white bg-white p-8 shadow-lg"
            >
              <div
                className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl"
                style={{ background: a.bg }}
              >
                <a.icon className="h-7 w-7" style={{ color: a.color }} />
              </div>

              <h3 className="text-2xl text-[#1C1917]" style={{ fontWeight: 800 }}>{a.title}</h3>
              <p className="mt-1 text-sm" style={{ fontWeight: 700, color: a.color }}>{a.subtitle}</p>
              <p className="mt-4 flex-1 text-[#6B7280] leading-relaxed">{a.desc}</p>

              <Link href={a.href} className="mt-8">
                <motion.div
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl px-6 py-3.5 text-white shadow-md"
                  style={{ background: a.color, fontWeight: 800 }}
                >
                  {a.cta}
                  <ArrowRight className="h-4 w-4" />
                </motion.div>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
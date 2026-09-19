"use client"

import { useRef } from "react"
import { motion, useInView } from "framer-motion"
import {
  Network, BookOpenCheck, GraduationCap, Layers, Headphones, Sparkles,
  Users, StickyNote, Search, FileQuestion, FileUp, BarChart3, Zap, Award,
} from "lucide-react"

/* ─── New flagship features — alternating large cards ─── */
const NEW_FEATURES = [
  {
    icon: Award,
    title: "Scholarship Provision",
    desc: "Get matched to scholarships, grants, and STEAM programs based on what you've actually mastered — not guesswork. Real opportunities surfaced from your real study data.",
    color: "#10B981",
    bg: "#E8FFF4",
    tags: ["Real Matches", "Grants & Programs", "Mastery-Based", "STEAM"],
    layout: "left",
  },
  {
    icon: FileQuestion,
    title: "WriteReal — AI Humanizer",
    desc: "Paste your essay and instantly find out if it reads as AI-generated. Then rewrite it through a 3-pass humanization pipeline that kills AI phrases, injects sentence burstiness, and adds natural voice — so it passes any detector.",
    color: "#7C3AED",
    bg: "#EDE9FF",
    tags: ["AI Detector", "3-Pass Humanizer", "Tone Control", "Scholar: 3/month"],
    layout: "right",
  },
  {
    icon: Layers,
    title: "Flashcards from Any Source",
    desc: "Generate flashcards from PDFs, photos of textbooks, or pasted notes. Q&A, Definition, or Fill-in-blank formats. Study with spaced-repetition confidence ratings.",
    color: "#3B82F6",
    bg: "#E8F4FF",
    tags: ["PDF + Images", "3 Card Types", "Confidence Rating", "Spaced Repetition"],
    layout: "left",
  },
  {
    icon: Headphones,
    title: "AI Audio Overview",
    desc: "Turn any study material into a spoken audio overview — your personal study podcast. Choose style, length, and speed. Commute Mode and Night Mode included.",
    color: "#EC4899",
    bg: "#FFF0F8",
    tags: ["Text-to-Speech", "Commute Mode", "Night Mode", "Speed Control"],
    layout: "right",
  },
]


/* ─── Supporting features — icon grid ─── */
const MORE_FEATURES = [
  { icon: Sparkles,     title: "EchoMind",          desc: "AI reflection on your real study data", color: "#6366F1", bg: "#EEEEFF" },
  { icon: Network,      title: "AI Mind Maps",      desc: "Turn PDFs into interactive mind maps",  color: "#7C3AED", bg: "#EDE9FF" },
  { icon: BookOpenCheck, title: "Revision Notes",   desc: "Exam-oriented notes, PDF export",       color: "#10B981", bg: "#E8FFF4" },
  { icon: GraduationCap, title: "AI Tutor",         desc: "Grounded answers with citations",       color: "#F59E0B", bg: "#FFF4E0" },
  { icon: Users,        title: "Study Together",    desc: "Live rooms with AI assistant",        color: "#3B82F6", bg: "#E8F4FF" },
  { icon: StickyNote,   title: "Smart Notes",       desc: "Rich editor, AI summaries, auto-save", color: "#F59E0B", bg: "#FFF4E0" },
  { icon: Search,       title: "AI Smart Search",   desc: "Search with YouTube + web resources",  color: "#10B981", bg: "#E8FFF4" },
  { icon: FileQuestion, title: "Exam Generator",    desc: "Practice exams from your documents",   color: "#6366F1", bg: "#EEEEFF" },
  { icon: FileUp,       title: "Document Upload",   desc: "Extract knowledge from any PDF",       color: "#06B6D4", bg: "#E0FEFF" },
  { icon: BarChart3,    title: "Progress Analytics", desc: "GPA estimate, burnout risk, mood",    color: "#0EA5E9", bg: "#E8F6FF" },
]

const fadeUp = {
  hidden: { opacity: 0, y: 32 },
  show: (i: number) => ({
    opacity: 1, y: 0,
    transition: { duration: 0.55, delay: i * 0.08, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] },
  }),
}

function FeatureRow({ f, index, inView }: { f: typeof NEW_FEATURES[0]; index: number; inView: boolean }) {
  const isLeft = f.layout === "left"
  return (
    <motion.div
      custom={index}
      variants={fadeUp}
      initial="hidden"
      animate={inView ? "show" : "hidden"}
      className={`flex flex-col gap-8 lg:gap-16 lg:items-center ${isLeft ? "lg:flex-row" : "lg:flex-row-reverse"}`}
    >
      {/* Visual placeholder / icon block */}
      <div className="flex-1 flex items-center justify-center">
        <motion.div
          whileHover={{ scale: 1.03 }}
          transition={{ type: "spring", stiffness: 260 }}
          className="relative w-full max-w-md rounded-3xl border-2 border-white bg-white p-10 shadow-xl flex flex-col items-center justify-center gap-6 min-h-[260px]"
          style={{ boxShadow: `0 20px 60px ${f.color}18` }}
        >
          {f.flagship && (
            <span
              className="absolute top-4 right-4 inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs text-white"
              style={{ background: f.color, fontWeight: 700 }}
            >
              <Sparkles className="h-3 w-3" /> Flagship
            </span>
          )}
          <div className="flex h-20 w-20 items-center justify-center rounded-3xl" style={{ background: f.bg }}>
            <f.icon className="h-10 w-10" style={{ color: f.color }} />
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            {f.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full border px-3 py-1 text-xs"
                style={{ borderColor: `${f.color}30`, background: f.bg, color: f.color, fontWeight: 600 }}
              >
                {tag}
              </span>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Text */}
      <div className="flex-1 text-center lg:text-left">
        <div
          className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl"
          style={{ background: f.bg }}
        >
          <f.icon className="h-7 w-7" style={{ color: f.color }} />
        </div>
        <h3 className="mb-3 text-2xl tracking-tight text-[#1C1917] md:text-3xl" style={{ fontWeight: 800 }}>
          {f.title}
        </h3>
        <p className="text-lg leading-relaxed text-[#6B7280] max-w-md mx-auto lg:mx-0">{f.desc}</p>
      </div>
    </motion.div>
  )
}

export function FeaturesSection() {
  const ref = useRef<HTMLElement>(null)
  const inView = useInView(ref, { once: true, margin: "-80px" })

  return (
    <section ref={ref} id="features" className="relative py-28 md:py-36 bg-[#FFFDF7]">
      {/* Ambient bg */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute top-20 right-0 h-[500px] w-[500px] rounded-full bg-[#7C3AED]/5 blur-[100px]" />
        <div className="absolute bottom-40 left-0 h-[400px] w-[400px] rounded-full bg-[#F59E0B]/6 blur-[100px]" />
      </div>

      <div className="relative mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="mb-20 text-center"
        >
          <span
            className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#7C3AED]/20 bg-[#EDE9FF] px-4 py-1.5 text-sm text-[#7C3AED]"
            style={{ fontWeight: 700 }}
          >
            <Zap className="h-4 w-4" /> Everything you need
          </span>
          <h2
            className="mt-4 text-4xl tracking-tight text-[#1C1917] md:text-5xl lg:text-6xl text-balance"
            style={{ fontWeight: 900 }}
          >
            Your entire study universe,{" "}
            <span className="text-gradient-qg">in one place</span>
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-[#6B7280] text-balance">
            From AI-generated revision notes to live study rooms — every tool a student needs, working together intelligently.
          </p>
        </motion.div>

        {/* Alternating feature rows */}
        <div className="space-y-24 md:space-y-32 mb-28">
          {NEW_FEATURES.map((f, i) => (
            <FeatureRow key={f.title} f={f} index={i} inView={inView} />
          ))}
        </div>

        {/* Divider */}
        <div className="mb-20 flex items-center gap-4">
          <div className="h-px flex-1 bg-gradient-to-r from-transparent via-[#E9E4FF] to-transparent" />
          <span className="text-xs text-[#6B7280] uppercase tracking-widest" style={{ fontWeight: 600 }}>And much more</span>
          <div className="h-px flex-1 bg-gradient-to-r from-transparent via-[#E9E4FF] to-transparent" />
        </div>

        {/* Quick features icon grid */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="text-center mb-10"
        >
          <h3 className="text-2xl text-[#1C1917]" style={{ fontWeight: 800 }}>Core study tools built in</h3>
          <p className="mt-2 text-[#6B7280]">The full suite — all in one platform, always free to start</p>
        </motion.div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {MORE_FEATURES.map((f, i) => (
            <motion.div
              key={f.title}
              custom={i + NEW_FEATURES.length}
              variants={fadeUp}
              initial="hidden"
              animate={inView ? "show" : "hidden"}
              whileHover={{ y: -5, scale: 1.04 }}
              className="group flex flex-col items-center gap-3 rounded-2xl border-2 border-white bg-white p-5 text-center shadow-sm transition-all duration-200 hover:border-[#EDE9FF] hover:shadow-md"
            >
              <div
                className="flex h-11 w-11 items-center justify-center rounded-xl transition-transform duration-200 group-hover:scale-110"
                style={{ background: f.bg }}
              >
                <f.icon className="h-5 w-5" style={{ color: f.color }} />
              </div>
              <div>
                <p className="text-sm text-[#1C1917] leading-tight" style={{ fontWeight: 700 }}>{f.title}</p>
                <p className="mt-0.5 text-xs text-[#6B7280] leading-snug">{f.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
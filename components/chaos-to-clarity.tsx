"use client"

import { useRef } from "react"
import { motion, useInView, useScroll, useTransform } from "framer-motion"
import { AlertTriangle, Calendar, CheckCircle2, Brain, Sparkles, BookOpen, Clock, Zap } from "lucide-react"

const chaosItems = [
  { icon: AlertTriangle, text: "3 exams tomorrow", color: "#EF4444", bg: "#FEF2F2" },
  { icon: Clock, text: "No time left", color: "#F59E0B", bg: "#FFF4E0" },
  { icon: BookOpen, text: "48 pages unread", color: "#EF4444", bg: "#FEF2F2" },
  { icon: AlertTriangle, text: "Group project overdue", color: "#F59E0B", bg: "#FFF4E0" },
  { icon: BookOpen, text: "Too many tabs open", color: "#EF4444", bg: "#FEF2F2" },
]

const clarityItems = [
  { icon: CheckCircle2, text: "Study plan ready", color: "#10B981", bg: "#E8FFF4" },
  { icon: Brain, text: "Mind map created", color: "#7C3AED", bg: "#EDE9FF" },
  { icon: Sparkles, text: "Exam practice done", color: "#F59E0B", bg: "#FFF4E0" },
  { icon: Calendar, text: "Schedule locked in", color: "#3B82F6", bg: "#E8F4FF" },
  { icon: Zap, text: "Feeling confident", color: "#10B981", bg: "#E8FFF4" },
]

function FloatingCard({ item, delay, direction }: { item: typeof chaosItems[0]; delay: number; direction: "left" | "right" }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: direction === "left" ? -40 : 40, rotate: direction === "left" ? -6 : 6 }}
      whileInView={{ opacity: 1, x: 0, rotate: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.6, delay, type: "spring", stiffness: 120 }}
      whileHover={{ scale: 1.06, y: -4 }}
      className="flex items-center gap-3 rounded-2xl px-5 py-3.5 shadow-lg cursor-default"
      style={{ background: item.bg, border: `1.5px solid ${item.color}22` }}
    >
      <div className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${item.color}18` }}>
        <item.icon className="h-5 w-5" style={{ color: item.color }} />
      </div>
      <span className="text-sm font-700 text-[#1C1917]" style={{ fontWeight: 700 }}>{item.text}</span>
    </motion.div>
  )
}

export function ChaosToClarity() {
  const ref = useRef<HTMLDivElement>(null)
  const isInView = useInView(ref, { once: true, margin: "-80px" })
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] })
  const opacity = useTransform(scrollYProgress, [0, 0.15, 0.85, 1], [0, 1, 1, 0])
  const y = useTransform(scrollYProgress, [0, 0.15], [40, 0])

  return (
    <section className="relative py-24 md:py-36 overflow-hidden" style={{ background: "#FFFDF7" }}>
      {/* Ambient orbs */}
      <div className="orb w-[500px] h-[500px] bg-[#EF4444]/08 top-0 left-[-100px] pointer-events-none" />
      <div className="orb w-[500px] h-[500px] bg-[#10B981]/08 top-0 right-[-100px] pointer-events-none" />

      <motion.div ref={ref} style={{ opacity, y }} className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-20">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6 }}
            className="mb-4 inline-flex items-center gap-2 rounded-full bg-[#EDE9FF] border border-[#7C3AED]/20 px-5 py-2"
          >
            <Brain className="h-4 w-4 text-[#7C3AED]" />
            <span className="text-sm font-700 text-[#7C3AED]" style={{ fontWeight: 700 }}>The QuillGlow Effect</span>
          </motion.div>

          <motion.h2
            initial={{ opacity: 0, y: 24 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.7, delay: 0.1 }}
            className="text-4xl md:text-5xl lg:text-6xl font-black text-[#1C1917] leading-[1.05] mb-5"
          >
            From{" "}
            <span className="relative inline-block">
              <span className="text-[#EF4444]">chaos</span>
              <motion.div
                initial={{ scaleX: 0 }}
                animate={isInView ? { scaleX: 1 } : {}}
                transition={{ delay: 0.6, duration: 0.6, ease: "easeOut" }}
                className="absolute -bottom-1 left-0 right-0 h-1 rounded-full bg-[#EF4444]/40 origin-left"
              />
            </span>
            {" "}to{" "}
            <span className="text-gradient-qg">clarity</span>
          </motion.h2>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-lg text-[#6B7280] max-w-xl mx-auto"
          >
            Students come to QuillGlow overwhelmed. They leave calm, organised, and confident — in seconds.
          </motion.p>
        </div>

        {/* Before / After */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto_1fr] items-center gap-10 lg:gap-6">
          {/* BEFORE */}
          <div className="space-y-3">
            <motion.p
              initial={{ opacity: 0 }}
              animate={isInView ? { opacity: 1 } : {}}
              transition={{ delay: 0.3 }}
              className="text-center text-sm font-800 uppercase tracking-widest text-[#EF4444] mb-6"
              style={{ fontWeight: 800 }}
            >
              Before QuillGlow
            </motion.p>
            {chaosItems.map((item, i) => (
              <FloatingCard key={i} item={item} delay={0.35 + i * 0.1} direction="left" />
            ))}
          </div>

          {/* Divider arrow */}
          <motion.div
            initial={{ opacity: 0, scale: 0 }}
            animate={isInView ? { opacity: 1, scale: 1 } : {}}
            transition={{ delay: 0.8, type: "spring", stiffness: 150 }}
            className="flex flex-col items-center gap-4 self-center py-4"
          >
            <div
              className="h-16 w-16 rounded-full flex items-center justify-center shadow-xl shadow-[#7C3AED]/25"
              style={{ background: "linear-gradient(135deg, #7C3AED, #F59E0B)" }}
            >
              <Sparkles className="h-8 w-8 text-white" />
            </div>
            <div className="hidden lg:flex flex-col items-center gap-1">
              <div className="w-px h-8 bg-gradient-to-b from-[#7C3AED]/40 to-transparent" />
            </div>
          </motion.div>

          {/* AFTER */}
          <div className="space-y-3">
            <motion.p
              initial={{ opacity: 0 }}
              animate={isInView ? { opacity: 1 } : {}}
              transition={{ delay: 0.3 }}
              className="text-center text-sm font-800 uppercase tracking-widest text-[#10B981] mb-6"
              style={{ fontWeight: 800 }}
            >
              After QuillGlow
            </motion.p>
            {clarityItems.map((item, i) => (
              <FloatingCard key={i} item={item} delay={0.5 + i * 0.1} direction="right" />
            ))}
          </div>
        </div>

        {/* Bottom stat */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7, delay: 0.3 }}
          className="mt-20 text-center"
        >
          <div className="inline-flex flex-col items-center gap-3 rounded-3xl border border-[#7C3AED]/15 bg-white/80 px-10 py-7 shadow-xl shadow-[#7C3AED]/08 glass">
            <p className="text-5xl font-black text-gradient-qg">30 seconds</p>
            <p className="text-[#6B7280] font-600 text-lg" style={{ fontWeight: 600 }}>
              from topic to complete study system — AI Study Agent
            </p>
          </div>
        </motion.div>
      </motion.div>
    </section>
  )
}

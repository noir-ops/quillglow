"use client"

import { motion, useScroll, useTransform } from "framer-motion"
import { useRef } from "react"
import { Coffee, Headphones, BookOpen, Sparkles, Moon, Music } from "lucide-react"

const floaters = [
  { icon: Coffee, label: "Deep focus mode", x: "5%", y: "20%", color: "#F59E0B", bg: "#FFF4E0", delay: 0 },
  { icon: Headphones, label: "Lo-fi study beats", x: "80%", y: "15%", color: "#7C3AED", bg: "#EDE9FF", delay: 0.3 },
  { icon: BookOpen, label: "Smart notes", x: "3%", y: "70%", color: "#10B981", bg: "#E8FFF4", delay: 0.6 },
  { icon: Moon, label: "Night mode", x: "82%", y: "68%", color: "#3B82F6", bg: "#E8F4FF", delay: 0.9 },
  { icon: Music, label: "Focus playlist", x: "50%", y: "6%", color: "#EC4899", bg: "#FFF0F6", delay: 0.45 },
  { icon: Sparkles, label: "In the zone", x: "45%", y: "88%", color: "#F59E0B", bg: "#FFF4E0", delay: 0.75 },
]

const moodWords = ["focused", "calm", "motivated", "clear", "ready", "unstoppable"]

export function DreamEnvironment() {
  const ref = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] })
  const y1 = useTransform(scrollYProgress, [0, 1], [40, -40])
  const y2 = useTransform(scrollYProgress, [0, 1], [-30, 30])

  return (
    <section
      ref={ref}
      className="relative py-28 md:py-40 overflow-hidden"
      style={{ background: "linear-gradient(180deg, #FFFDF7 0%, #F3F0FF 50%, #FFFDF7 100%)" }}
    >
      {/* Orbs */}
      <div className="orb w-[600px] h-[600px] bg-[#7C3AED]/12 top-[-80px] left-[30%] animate-float-orb" />
      <div className="orb w-[400px] h-[400px] bg-[#F59E0B]/10 bottom-[-40px] right-[20%] animate-float-orb" style={{ animationDelay: "3s" }} />

      {/* Floating icon chips */}
      {floaters.map((f, i) => (
        <motion.div
          key={i}
          className="absolute hidden md:flex items-center gap-2.5 rounded-full px-4 py-2.5 shadow-lg z-10"
          style={{ left: f.x, top: f.y, background: f.bg, border: `1.5px solid ${f.color}22` }}
          initial={{ opacity: 0, scale: 0.7 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ delay: f.delay + 0.4, type: "spring", stiffness: 180 }}
        >
          <motion.div
            animate={{ y: [-4, 4, -4] }}
            transition={{ duration: 4 + i * 0.5, repeat: Infinity, ease: "easeInOut" }}
          >
            <f.icon className="h-4 w-4" style={{ color: f.color }} />
          </motion.div>
          <span className="text-xs font-700 text-[#1C1917] whitespace-nowrap" style={{ fontWeight: 700 }}>{f.label}</span>
        </motion.div>
      ))}

      <div className="relative z-20 mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 text-center">
        {/* Badge */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="mb-6 inline-flex items-center gap-2 rounded-full bg-[#EDE9FF] border border-[#7C3AED]/20 px-5 py-2"
        >
          <Sparkles className="h-4 w-4 text-[#7C3AED]" />
          <span className="text-sm font-700 text-[#7C3AED]" style={{ fontWeight: 700 }}>Your Dream Study Space</span>
        </motion.div>

        {/* Headline */}
        <motion.h2
          initial={{ opacity: 0, y: 28 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7, delay: 0.1 }}
          className="text-4xl md:text-5xl lg:text-6xl font-black leading-[1.05] text-[#1C1917] mb-6"
        >
          The study environment
          <br />
          <span className="text-gradient-qg">you always wanted</span>
        </motion.h2>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="text-lg text-[#6B7280] max-w-2xl mx-auto mb-16"
        >
          Cozy. Focused. Yours. QuillGlow creates a personalized study atmosphere — smart tools, ambient sound, focus timers, and an AI companion who genuinely knows your progress.
        </motion.p>

        {/* Animated mood words */}
        <motion.div style={{ y: y1 }} className="flex flex-wrap justify-center gap-4 mb-10">
          {moodWords.map((word, i) => (
            <motion.div
              key={word}
              initial={{ opacity: 0, scale: 0.7 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.3 + i * 0.08, type: "spring", stiffness: 200 }}
              whileHover={{ scale: 1.08, y: -3 }}
              className="rounded-full px-6 py-3 text-lg font-800 cursor-default select-none shadow-md"
              style={{
                fontWeight: 800,
                background: i % 3 === 0 ? "#EDE9FF" : i % 3 === 1 ? "#FFF4E0" : "#E8FFF4",
                color: i % 3 === 0 ? "#7C3AED" : i % 3 === 1 ? "#D97706" : "#059669",
                border: `1.5px solid ${i % 3 === 0 ? "#7C3AED" : i % 3 === 1 ? "#F59E0B" : "#10B981"}22`,
              }}
            >
              {word}
            </motion.div>
          ))}
        </motion.div>

        {/* Central glow card */}
        <motion.div style={{ y: y2 }} className="relative inline-block">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, delay: 0.4, type: "spring" }}
            className="glass rounded-3xl p-8 md:p-12 shadow-2xl shadow-[#7C3AED]/15 max-w-lg mx-auto"
            style={{ border: "1.5px solid rgba(124,58,237,0.15)" }}
          >
            <div className="flex items-center gap-4 mb-6">
              {[Coffee, Headphones, BookOpen].map((Icon, i) => (
                <motion.div
                  key={i}
                  animate={{ y: [-4, 4, -4] }}
                  transition={{ duration: 3 + i, repeat: Infinity, ease: "easeInOut", delay: i * 0.6 }}
                  className="h-12 w-12 rounded-2xl flex items-center justify-center"
                  style={{ background: i === 0 ? "#FFF4E0" : i === 1 ? "#EDE9FF" : "#E8FFF4" }}
                >
                  <Icon className="h-6 w-6" style={{ color: i === 0 ? "#F59E0B" : i === 1 ? "#7C3AED" : "#10B981" }} />
                </motion.div>
              ))}
              <div className="flex-1 h-2 rounded-full bg-[#EDE9FF] overflow-hidden">
                <motion.div
                  className="h-full rounded-full"
                  style={{ background: "linear-gradient(90deg, #7C3AED, #10B981)" }}
                  initial={{ width: "0%" }}
                  whileInView={{ width: "82%" }}
                  viewport={{ once: true }}
                  transition={{ duration: 2, delay: 0.8 }}
                />
              </div>
            </div>
            <p className="text-xl font-800 text-[#1C1917] mb-2" style={{ fontWeight: 800 }}>
              Your study session is perfect
            </p>
            <p className="text-[#6B7280] text-sm leading-relaxed">
              82% through your plan. Focus music on. Timer running. Notes auto-saved. You&apos;re doing incredible.
            </p>
          </motion.div>
        </motion.div>
      </div>
    </section>
  )
}

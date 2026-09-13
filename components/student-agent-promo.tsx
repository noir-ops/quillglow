"use client"

import { useRef, useState, useEffect } from "react"
import { motion, useInView, AnimatePresence } from "framer-motion"
import {
  Brain, FileText, Network, ClipboardList, Youtube,
  CalendarDays, TrendingUp, Sparkles, CheckCircle2,
  Star, Flame, Timer,
} from "lucide-react"

const STEPS = [
  { icon: Brain,        label: "Analyses your topic",        color: "#7C3AED" },
  { icon: FileText,     label: "Writes revision notes",      color: "#10B981" },
  { icon: Network,      label: "Builds your mind map",       color: "#3B82F6" },
  { icon: ClipboardList,label: "Generates exam questions",   color: "#F59E0B" },
  { icon: Youtube,      label: "Finds best YouTube videos",  color: "#EF4444" },
  { icon: CalendarDays, label: "Creates review schedule",    color: "#06B6D4" },
  { icon: TrendingUp,   label: "Maps your weaknesses",       color: "#EC4899" },
  { icon: Sparkles,     label: "Delivers your study system", color: "#7C3AED" },
]

const STATS = [
  { value: "4.8 / 5", label: "rating" },
  { value: "8 steps", label: "fully AI" },
  { value: "$4.99",   label: "intro offer" },
]

const TESTIMONIALS = [
  { quote: "Used it the night before chemistry. Walked in confident for the first time ever.", name: "Aisha, A-Level" },
  { quote: "It found my actual weak spots from my mock exams. Felt like it really knew me.", name: "Jordan, Uni Year 2" },
  { quote: "Mind map + exam + videos all in one go? This is the future of studying.", name: "Priya, GCSE" },
]

const BENEFITS = [
  { icon: FileText,     label: "Personalised revision notes",     color: "#10B981", bg: "#E8FFF4" },
  { icon: Network,      label: "Interactive mind map",            color: "#3B82F6", bg: "#E8F4FF" },
  { icon: ClipboardList,label: "Full practice exam + mark scheme", color: "#F59E0B", bg: "#FFF4E0" },
  { icon: Youtube,      label: "Curated YouTube video links",     color: "#EF4444", bg: "#FFF0F0" },
  { icon: CalendarDays, label: "Smart spaced-repetition schedule",color: "#06B6D4", bg: "#E0FEFF" },
  { icon: TrendingUp,   label: "Weakness insights from YOUR data",color: "#EC4899", bg: "#FFF0F8" },
]

export function StudyAgentPromo() {
  const ref = useRef<HTMLElement>(null)
  const inView = useInView(ref, { once: true, margin: "-80px" })
  const [activeStep, setActiveStep] = useState(0)
  const [done, setDone] = useState<number[]>([])
  const [testimIndex, setTestimIndex] = useState(0)
  const [running, setRunning] = useState(false)

  // Auto-run steps when in view
  useEffect(() => {
    if (!inView || running) return
    setRunning(true)
    setDone([])
    setActiveStep(0)
    STEPS.forEach((_, i) => {
      setTimeout(() => {
        setActiveStep(i)
        setDone((prev) => [...prev, i - 1])
      }, i * 700)
    })
    setTimeout(() => {
      setDone(STEPS.map((_, i) => i))
      setActiveStep(-1)
    }, STEPS.length * 700 + 400)
  }, [inView])

  // Rotate testimonials
  useEffect(() => {
    const t = setInterval(() => setTestimIndex((i) => (i + 1) % TESTIMONIALS.length), 4000)
    return () => clearInterval(t)
  }, [])

  return (
    <section ref={ref} id="study-agent" className="relative overflow-hidden py-28 md:py-36" style={{ background: "linear-gradient(180deg, #FFFDF7 0%, #F3EEFF 40%, #FFFDF7 100%)" }}>
      {/* Background orbs */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute top-20 left-1/4 h-[500px] w-[500px] rounded-full bg-[#7C3AED]/10 blur-[120px]" />
        <div className="absolute bottom-20 right-1/4 h-[400px] w-[400px] rounded-full bg-[#F59E0B]/10 blur-[100px]" />
      </div>

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* AI Hub banner */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={inView ? { opacity: 1, scale: 1 } : {}}
          transition={{ duration: 0.5 }}
          className="mb-10 flex justify-center"
        >
          <div className="inline-flex items-center gap-2 rounded-full border-2 border-[#7C3AED]/30 bg-white px-5 py-2.5 shadow-sm">
            <Flame className="h-4 w-4 text-[#EF4444]" />
            <span className="text-sm font-800 text-[#1C1917]">AI Hub</span>
            <span className="rounded-full bg-[#7C3AED] px-3 py-0.5 text-sm font-900 text-white">$4.99</span>
            <Timer className="h-4 w-4 text-[#F59E0B]" />
          </div>
        </motion.div>

        {/* Hero headline */}
        <motion.div
          initial={{ opacity: 0, y: 28 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="mb-6 text-center"
        >
          <h2 className="text-5xl font-900 tracking-tight text-[#1C1917] md:text-6xl lg:text-7xl text-balance leading-[1.05]">
            Your AI builds your{" "}
            <span className="text-gradient-qg">entire study system</span>
            <br />in one click.
          </h2>
        </motion.div>

        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="mx-auto mb-10 max-w-2xl text-center text-xl text-[#6B7280] text-balance"
        >
          Paste a topic. The AI Study Agent runs 8 steps and delivers revision notes, a mind map, a practice exam, YouTube videos, and a personalised review schedule — in under 60 seconds.
        </motion.p>

        {/* Stats row */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5, delay: 0.35 }}
          className="mb-20 flex flex-wrap justify-center gap-6"
        >
          {STATS.map((s) => (
            <div key={s.label} className="flex flex-col items-center">
              <span className="text-2xl font-900 text-[#7C3AED]">{s.value}</span>
              <span className="text-xs text-[#6B7280] uppercase tracking-widest font-600">{s.label}</span>
            </div>
          ))}
        </motion.div>

        {/* Split: live agent + benefits */}
        <div className="grid gap-10 lg:grid-cols-2 lg:gap-16 items-start">
          {/* Live agent card */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={inView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="rounded-3xl border-2 border-[#E9E4FF] bg-white p-6 shadow-xl shadow-[#7C3AED]/8"
          >
            <div className="mb-5 flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-[#7C3AED] flex items-center justify-center">
                <Sparkles className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="font-800 text-[#1C1917]">AI Study Agent</p>
                <p className="text-xs text-[#6B7280]">Running your study system...</p>
              </div>
              <div className="ml-auto flex gap-1">
                <div className="h-2 w-2 rounded-full bg-[#10B981] animate-pulse" />
                <span className="text-xs text-[#10B981] font-600">Live</span>
              </div>
            </div>

            <div className="space-y-3">
              {STEPS.map((step, i) => {
                const isDone = done.includes(i)
                const isActive = activeStep === i
                return (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0.3 }}
                    animate={{ opacity: isDone || isActive ? 1 : 0.35 }}
                    className="flex items-center gap-3 rounded-xl p-3 transition-colors"
                    style={{ background: isActive ? `${step.color}10` : isDone ? "#F9F9F9" : "transparent" }}
                  >
                    {isDone ? (
                      <CheckCircle2 className="h-5 w-5 shrink-0" style={{ color: step.color }} />
                    ) : isActive ? (
                      <div className="h-5 w-5 shrink-0 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: step.color }} />
                    ) : (
                      <div className="h-5 w-5 shrink-0 rounded-full border-2 border-[#E9E4FF]" />
                    )}
                    <step.icon className="h-4 w-4 shrink-0" style={{ color: step.color }} />
                    <span className={`text-sm font-600 ${isDone ? "text-[#1C1917]" : isActive ? "text-[#1C1917]" : "text-[#9CA3AF]"}`}>
                      {step.label}
                    </span>
                    {isActive && (
                      <span className="ml-auto text-xs font-700 rounded-full px-2 py-0.5 text-white" style={{ background: step.color }}>
                        Running
                      </span>
                    )}
                    {isDone && (
                      <span className="ml-auto text-xs text-[#10B981] font-700">Done</span>
                    )}
                  </motion.div>
                )
              })}
            </div>
          </motion.div>

          {/* Benefits + pricing callout */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={inView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.45 }}
            className="flex flex-col gap-6"
          >
            <h3 className="text-2xl font-900 text-[#1C1917]">One run. Six complete outputs.</h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {BENEFITS.map((b) => (
                <div key={b.label} className="flex items-center gap-3 rounded-2xl border-2 border-[#E9E4FF] bg-white p-4">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl" style={{ background: b.bg }}>
                    <b.icon className="h-4.5 w-4.5" style={{ color: b.color }} />
                  </div>
                  <span className="text-sm font-700 text-[#1C1917]">{b.label}</span>
                </div>
              ))}
            </div>

            {/* Testimonial rotator */}
            <div className="rounded-2xl border-2 border-[#E9E4FF] bg-white p-5">
              <div className="flex gap-1 mb-3">
                {[...Array(5)].map((_, i) => <Star key={i} className="h-4 w-4 fill-[#F59E0B] text-[#F59E0B]" />)}
              </div>
              <AnimatePresence mode="wait">
                <motion.div
                  key={testimIndex}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.4 }}
                >
                  <p className="text-sm text-[#1C1917] font-600 italic mb-2">"{TESTIMONIALS[testimIndex].quote}"</p>
                  <p className="text-xs text-[#6B7280]">— {TESTIMONIALS[testimIndex].name}</p>
                </motion.div>
              </AnimatePresence>
              <div className="mt-3 flex gap-1.5 justify-center">
                {TESTIMONIALS.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setTestimIndex(i)}
                    className="h-1.5 rounded-full transition-all duration-200"
                    style={{ width: i === testimIndex ? "20px" : "6px", background: i === testimIndex ? "#7C3AED" : "#E9E4FF" }}
                  />
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
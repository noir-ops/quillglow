"use client"

import { motion, useInView } from "framer-motion"
import { useRef } from "react"
import { Heart, Sparkles, Brain, MessageSquare, Star } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"

const messages = [
  {
    from: "ai",
    text: "I noticed you're spending extra time on quadratic equations. Want me to generate a focused practice set?",
    delay: 0.2,
  },
  {
    from: "user",
    text: "Yes please. I've been stuck on factoring for days.",
    delay: 0.9,
  },
  {
    from: "ai",
    text: "Done! I also pulled in your last exam score — you got 60% on this topic. Let's change that. I've built 10 targeted questions with step-by-step guidance.",
    delay: 1.6,
  },
  {
    from: "user",
    text: "This actually makes sense now. Thank you.",
    delay: 2.4,
  },
  {
    from: "ai",
    text: "That's your brain working hard. You're making real progress — I can see it in your data. You've got this.",
    delay: 3.1,
  },
]

const affirmations = [
  { text: "You're doing better than you think", icon: Star, color: "#F59E0B" },
  { text: "Every session gets you closer", icon: Heart, color: "#EC4899" },
  { text: "Your effort is measurable", icon: Brain, color: "#7C3AED" },
  { text: "QuillGlow remembers everything for you", icon: Sparkles, color: "#10B981" },
]

export function YouAreNotAlone() {
  const ref = useRef<HTMLDivElement>(null)
  const isInView = useInView(ref, { once: true, margin: "-80px" })

  return (
    <section
      className="relative py-28 md:py-40 overflow-hidden"
      style={{ background: "linear-gradient(180deg, #FFFDF7 0%, #FFF4E0 40%, #EDE9FF 100%)" }}
    >
      {/* Ambient orbs */}
      <div className="orb w-[700px] h-[700px] bg-[#7C3AED]/08 top-[-100px] left-[5%] animate-float-orb" />
      <div className="orb w-[500px] h-[500px] bg-[#F59E0B]/10 bottom-[-60px] right-[5%] animate-float-orb" style={{ animationDelay: "2.5s" }} />

      <div ref={ref} className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">

          {/* Left: Messaging */}
          <div>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.6 }}
              className="mb-5 inline-flex items-center gap-2 rounded-full bg-[#EDE9FF] border border-[#7C3AED]/20 px-5 py-2"
            >
              <Heart className="h-4 w-4 text-[#7C3AED]" />
              <span className="text-sm font-700 text-[#7C3AED]" style={{ fontWeight: 700 }}>EchoMind AI Companion</span>
            </motion.div>

            <motion.h2
              initial={{ opacity: 0, y: 28 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.7, delay: 0.1 }}
              className="text-4xl md:text-5xl lg:text-6xl font-black text-[#1C1917] leading-[1.05] mb-6"
            >
              You are{" "}
              <span className="text-gradient-qg">not alone</span>
              <br />
              in this.
            </motion.h2>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="text-lg text-[#6B7280] leading-relaxed mb-10 max-w-lg"
            >
              EchoMind is your AI study companion — emotionally intelligent, deeply personal, and always available. It knows your exam history, your weak spots, and exactly what you need to hear right now.
            </motion.p>

            {/* Affirmations */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-10">
              {affirmations.map((a, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -20 }}
                  animate={isInView ? { opacity: 1, x: 0 } : {}}
                  transition={{ delay: 0.35 + i * 0.1, duration: 0.5 }}
                  className="flex items-center gap-3 rounded-2xl px-4 py-3.5 bg-white/70 shadow-sm"
                  style={{ border: `1.5px solid ${a.color}20` }}
                >
                  <div className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${a.color}15` }}>
                    <a.icon className="h-5 w-5" style={{ color: a.color }} />
                  </div>
                  <p className="text-sm font-700 text-[#1C1917]" style={{ fontWeight: 700 }}>{a.text}</p>
                </motion.div>
              ))}
            </div>

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: 0.8 }}
            >
              <Link href="/auth/signup">
                <Button
                  size="lg"
                  className="rounded-full px-9 font-800 shadow-lg shadow-[#7C3AED]/25"
                  style={{ background: "linear-gradient(135deg, #7C3AED, #A855F7)", fontWeight: 800 }}
                >
                  Meet EchoMind
                  <Sparkles className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </motion.div>
          </div>

          {/* Right: Animated chat */}
          <motion.div
            initial={{ opacity: 0, x: 40 }}
            animate={isInView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.8, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
          >
            {/* Central glow orb */}
            <div className="relative mb-8 flex justify-center">
              <div className="relative">
                <motion.div
                  animate={{ scale: [1, 1.15, 1], opacity: [0.4, 0.7, 0.4] }}
                  transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                  className="absolute inset-[-24px] rounded-full"
                  style={{ background: "radial-gradient(circle, #7C3AED40 0%, transparent 70%)" }}
                />
                <div
                  className="relative h-20 w-20 rounded-full flex items-center justify-center shadow-2xl shadow-[#7C3AED]/35"
                  style={{ background: "linear-gradient(135deg, #7C3AED, #A855F7)" }}
                >
                  <Brain className="h-10 w-10 text-white" />
                </div>
              </div>
            </div>

            {/* Chat messages */}
            <div className="space-y-3 max-w-md mx-auto">
              {messages.map((msg, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 12, x: msg.from === "ai" ? -12 : 12 }}
                  animate={isInView ? { opacity: 1, y: 0, x: 0 } : {}}
                  transition={{ delay: msg.delay, duration: 0.5, ease: "easeOut" }}
                  className={`flex ${msg.from === "user" ? "justify-end" : "justify-start"}`}
                >
                  {msg.from === "ai" && (
                    <div className="h-8 w-8 rounded-full flex items-center justify-center shrink-0 mr-2.5 mt-0.5 shadow-sm" style={{ background: "linear-gradient(135deg, #7C3AED, #A855F7)" }}>
                      <MessageSquare className="h-4 w-4 text-white" />
                    </div>
                  )}
                  <div
                    className="max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm"
                    style={{
                      background: msg.from === "ai" ? "#FFFFFF" : "linear-gradient(135deg, #7C3AED, #A855F7)",
                      color: msg.from === "ai" ? "#1C1917" : "#FFFFFF",
                      border: msg.from === "ai" ? "1.5px solid #EDE9FF" : "none",
                      borderRadius: msg.from === "ai" ? "4px 18px 18px 18px" : "18px 4px 18px 18px",
                      fontWeight: 600,
                    }}
                  >
                    {msg.text}
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}

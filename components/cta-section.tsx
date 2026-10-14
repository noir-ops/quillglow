"use client"

import { useRef } from "react"
import { motion, useInView } from "framer-motion"
import { Button } from "@/components/ui/button"
import { ArrowRight, Sparkles, Star, Brain, BookOpen, Zap, Heart } from "lucide-react"
import Link from "next/link"

const particles = [
  { icon: Star, x: "8%", y: "20%", delay: 0, size: 20, color: "#F59E0B" },
  { icon: Brain, x: "88%", y: "18%", delay: 0.3, size: 24, color: "#A855F7" },
  { icon: BookOpen, x: "5%", y: "72%", delay: 0.6, size: 20, color: "#10B981" },
  { icon: Zap, x: "90%", y: "68%", delay: 0.9, size: 22, color: "#F59E0B" },
  { icon: Heart, x: "50%", y: "8%", delay: 0.45, size: 18, color: "#EC4899" },
  { icon: Sparkles, x: "20%", y: "88%", delay: 0.75, size: 18, color: "#7C3AED" },
  { icon: Star, x: "75%", y: "85%", delay: 1.1, size: 16, color: "#F59E0B" },
]

export function CTASection() {
  const ref = useRef<HTMLElement>(null)
  const isInView = useInView(ref, { once: true, margin: "-80px" })

  return (
    <section ref={ref} className="relative pt-24 md:pt-32 pb-0 overflow-hidden" style={{ background: "#FFFDF7" }}>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, scale: 0.94, y: 24 }}
          animate={isInView ? { opacity: 1, scale: 1, y: 0 } : {}}
          transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
          className="relative overflow-hidden rounded-[40px] px-8 py-20 text-center shadow-2xl md:px-16 md:py-28"
          style={{
            background: "linear-gradient(135deg, #7C3AED 0%, #A855F7 45%, #F59E0B 100%)",
            backgroundSize: "200% 200%",
          }}
        >
          {/* Animated gradient drift */}
          <motion.div
            className="absolute inset-0 rounded-[40px]"
            animate={{ backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"] }}
            transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
            style={{
              background: "linear-gradient(135deg, #7C3AED, #A855F7, #F59E0B, #7C3AED)",
              backgroundSize: "300% 300%",
              opacity: 0.6,
            }}
          />

          {/* Glow blobs */}
          <div className="absolute left-0 top-0 h-80 w-80 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute right-0 bottom-0 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-96 w-96 rounded-full bg-white/05 blur-3xl" />

          {/* Floating icons */}
          {particles.map((p, i) => (
            <motion.div
              key={i}
              className="absolute hidden md:block pointer-events-none"
              style={{ left: p.x, top: p.y }}
              initial={{ opacity: 0, scale: 0 }}
              animate={isInView ? { opacity: 0.7, scale: 1 } : {}}
              transition={{ delay: p.delay + 0.5, type: "spring" }}
            >
              <motion.div
                animate={{ y: [-6, 6, -6], rotate: [-4, 4, -4] }}
                transition={{ duration: 4 + i * 0.5, repeat: Infinity, ease: "easeInOut" }}
              >
                <p.icon size={p.size} className="text-white/60" />
              </motion.div>
            </motion.div>
          ))}

          {/* Content */}
          <div className="relative z-10">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: 0.2 }}
              className="mb-7 inline-flex items-center gap-2.5 rounded-full bg-white/20 border border-white/30 px-6 py-2.5 backdrop-blur-sm"
            >
              <Sparkles className="h-4 w-4 text-white" />
              <span className="text-sm font-800 text-white" style={{ fontWeight: 800 }}>Join 19k+ Students Who Chose Progress</span>
            </motion.div>

            <motion.h2
              initial={{ opacity: 0, y: 28 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: 0.3, duration: 0.7 }}
              className="text-4xl md:text-5xl lg:text-7xl font-black text-white leading-[1.02] mb-7 text-balance"
            >
              Your future is
              <br />
              worth exploring.
            </motion.h2>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: 0.45 }}
              className="mx-auto mb-12 max-w-2xl text-lg text-white/85 text-balance"
            >
              Start free today. Get your complete AI study system in 30 seconds. No credit card. No commitment. Just clarity.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: 0.6 }}
              className="flex flex-col sm:flex-row items-center justify-center gap-4"
            >
              <Link href="/start">
                <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.97 }}>
                  <Button
                    size="lg"
                    className="group rounded-full px-10 text-base font-800 bg-white text-primary shadow-xl hover:bg-transparent hover:text-white"
                    style={{ color: "#7C3AED", fontWeight: 800 }}
                  >
                    Start Here
                    <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
                  </Button>
                </motion.div>
              </Link>
              <Link href="/pricing">
                <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}>
                  <Button
                    size="lg"
                    variant="outline"
                    className="rounded-full px-10 text-base font-800 border-2 border-white/60 bg-white/10 text-white hover:bg-white/20 backdrop-blur-sm"
                    style={{ fontWeight: 800 }}
                  >
                    Genius for $4.99
                    <Sparkles className="ml-2 h-4 w-4" />
                  </Button>
                </motion.div>
              </Link>
            </motion.div>

            <motion.p
              initial={{ opacity: 0 }}
              animate={isInView ? { opacity: 1 } : {}}
              transition={{ delay: 0.9 }}
              className="mt-8 text-sm text-white/60"
            >
              Free forever plan available — upgrade anytime for $4.99
            </motion.p>
          </div>
        </motion.div>
      </div>

    </section>
  )
}
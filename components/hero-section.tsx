"use client"

import { useEffect, useRef, useState } from "react"
import { motion, useMotionValue, useTransform, useSpring } from "framer-motion"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { ArrowRight, BookOpen, Clock, Sparkles, Star, FileText, Layers } from "lucide-react"
import Link from "next/link"

const HEADLINES = [
  "Learn, Prepare. \n Discover, Grow.",
  "Master Your Studies.\nOwn Every Exam.",
  "Studying finally\nfeels possible.",
  "Less pressure.\nMore progress.",
]

const stats = [
  { value: "19k+", label: "students" },
  { value: "4.9", label: "rating", icon: Star },
  { value: "Free", label: "to start" },
]

export function HeroSection() {
  const [headlineIdx, setHeadlineIdx] = useState(0)
  const sectionRef = useRef<HTMLElement>(null)
  const mouseX = useMotionValue(0)
  const mouseY = useMotionValue(0)
  const springX = useSpring(mouseX, { stiffness: 60, damping: 20 })
  const springY = useSpring(mouseY, { stiffness: 60, damping: 20 })
  const bgX = useTransform(springX, [-500, 500], [-18, 18])
  const bgY = useTransform(springY, [-500, 500], [-12, 12])

  // Rotate headlines every 4s
  useEffect(() => {
    const t = setInterval(() => {
      setHeadlineIdx((i) => (i + 1) % HEADLINES.length)
    }, 4000)
    return () => clearInterval(t)
  }, [])

  // Mouse parallax
  useEffect(() => {
    const el = sectionRef.current
    if (!el) return
    const onMove = (e: MouseEvent) => {
      const rect = el.getBoundingClientRect()
      mouseX.set(e.clientX - rect.left - rect.width / 2)
      mouseY.set(e.clientY - rect.top - rect.height / 2)
    }
    el.addEventListener("mousemove", onMove)
    return () => el.removeEventListener("mousemove", onMove)
  }, [mouseX, mouseY])

  return (
    <section
      ref={sectionRef}
      className="relative min-h-screen overflow-hidden flex items-center pt-20"
      style={{ background: "#FFFDF7" }}
    >
      {/* ── Ambient orbs ───────────────────────────────────── */}
      <motion.div
        style={{ x: bgX, y: bgY }}
        className="pointer-events-none absolute inset-0"
      >
        <div className="orb w-[600px] h-[600px] bg-[#7C3AED]/20 top-[-100px] left-[-120px] animate-float-orb" />
        <div className="orb w-[500px] h-[500px] bg-[#F59E0B]/15 bottom-[-80px] right-[-100px] animate-float-orb" style={{ animationDelay: "2s" }} />
        <div className="orb w-[300px] h-[300px] bg-[#10B981]/12 top-[40%] left-[40%] animate-float-orb" style={{ animationDelay: "4s" }} />
      </motion.div>

      {/* ── Floating background icons ───────────────────────── */}
      {[
        { Icon: BookOpen, x: "8%", y: "20%", size: 22, c: "#7C3AED", delay: 0 },
        { Icon: FileText, x: "88%", y: "14%", size: 26, c: "#F59E0B", delay: 0.6 },
        { Icon: Clock, x: "4%", y: "68%", size: 18, c: "#10B981", delay: 1.2 },
        { Icon: Layers, x: "91%", y: "62%", size: 20, c: "#EC4899", delay: 1.8 },
        { Icon: Star, x: "50%", y: "8%", size: 16, c: "#7C3AED", delay: 0.9 },
      ].map(({ Icon, x, y, size, c, delay }, i) => (
        <motion.div
          key={i}
          className="pointer-events-none absolute hidden md:block"
          style={{ left: x, top: y }}
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: 0.5, scale: 1 }}
          transition={{ delay: delay + 0.8, duration: 0.6, type: "spring" }}
        >
          <motion.div
            animate={{ y: [-8, 8, -8], rotate: [-4, 4, -4] }}
            transition={{ duration: 5 + i, repeat: Infinity, ease: "easeInOut" }}
          >
            <Icon size={size} color={c} />
          </motion.div>
        </motion.div>
      ))}

      <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 w-full">
        <div className="flex flex-col items-center gap-12 lg:flex-row lg:items-center lg:gap-20">

          {/* ── Left: Text content ─────────────────────────── */}
          <div className="flex-1 text-center lg:text-left max-w-2xl mx-auto lg:mx-0">

            {/* Headline — rotates */}
            <div className="mb-7 min-h-[180px] sm:min-h-[160px] md:min-h-[200px] lg:min-h-[220px]">
              <motion.h1
                key={headlineIdx}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
                className="text-5xl sm:text-6xl md:text-7xl lg:text-7xl xl:text-8xl font-black leading-[1.05] tracking-tight text-[#1C1917]"
              >
                {HEADLINES[headlineIdx].split("\n").map((line, i) => (
                  <span key={i} className="block">
                    {i === 0 ? (
                      <span className="text-gradient-qg">{line}</span>
                    ) : line}
                  </span>
                ))}
              </motion.h1>
            </div>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.4 }}
              className="mb-10 max-w-lg text-lg leading-relaxed text-[#6B7280] mx-auto lg:mx-0"
            >
              Your second brain for the hardest years of your life. AI-powered tools that transform overwhelming study chaos into calm, confident progress.
            </motion.p>

            {/* CTAs */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.55 }}
              className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start mb-12"
            >
              <Link href="/auth/signup">
                <motion.div
                  whileHover={{ scale: 1.04 }}
                  whileTap={{ scale: 0.97 }}
                >
                  <Button
                    size="lg"
                    className="group rounded-full px-9 text-base font-800 shadow-lg shadow-[#7C3AED]/25 w-full sm:w-auto"
                    style={{ background: "linear-gradient(135deg, #7C3AED, #A855F7)", fontWeight: 800 }}
                  >
                    Start Free — No Card Needed
                    <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </Button>
                </motion.div>
              </Link>
              <Link href="/pricing">
                <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                  <Button
                    size="lg"
                    variant="outline"
                    className="rounded-full px-9 text-base font-700 border-2 border-[#7C3AED]/30 bg-white/60 text-[#7C3AED] hover:bg-[#EDE9FF] w-full sm:w-auto"
                    style={{ fontWeight: 700 }}
                  >
                    Genius for $4.99
                    <Sparkles className="ml-2 h-4 w-4" />
                  </Button>
                </motion.div>
              </Link>
            </motion.div>

            {/* Stats row */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.85, duration: 0.6 }}
              className="flex flex-wrap items-center gap-6 justify-center lg:justify-start"
            >
              {stats.map(({ value, label, icon: Icon }, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-xl font-black text-[#7C3AED]">{value}</span>
                  {Icon && <Icon className="h-4 w-4 text-[#F59E0B] fill-[#F59E0B]" />}
                  <span className="text-sm text-[#6B7280] font-600" style={{ fontWeight: 600 }}>{label}</span>
                  {i < stats.length - 1 && <span className="h-4 w-px bg-[#7C3AED]/20 ml-1" />}
                </div>
              ))}
            </motion.div>
          </div>

          {/* ── Right: Mascot character cluster ────────────── */}
          <motion.div
            initial={{ opacity: 0, x: 60 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 1, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="flex-1 relative hidden lg:flex items-center justify-center"
            style={{ minHeight: 560 }}
          >
            {/* Soft radial glow behind characters */}
            <div
              className="pointer-events-none absolute inset-0 rounded-full"
              style={{
                background: "radial-gradient(ellipse 70% 60% at 50% 55%, rgba(124,58,237,0.13) 0%, transparent 75%)",
              }}
            />

            {/* Main cluster image — fills the panel */}
            <div
              className="relative z-10"
              style={{ width: 480, height: 480 }}
            >
              <Image
                src="/images/mascots/new/hero-cluster.png"
                alt="QuillGlow student mascots celebrating learning"
                fill
                className="object-contain drop-shadow-2xl"
                priority
              />
            </div>

            {/* Owl mascot — top right, static */}
            <div
              className="absolute top-4 right-4 z-20"
            >
              <div className="relative w-28 h-28">
                <Image
                  src="/images/mascots/new/mascot-main.png"
                  alt="Quill the QuillGlow owl mascot"
                  fill
                  className="object-contain drop-shadow-xl"
                />
                {/* Speech bubble */}
                <div
                  className="absolute -top-9 -left-2 whitespace-nowrap rounded-2xl px-3 py-1.5 text-[11px] shadow-lg"
                  style={{
                    background: "#7C3AED",
                    color: "white",
                    fontWeight: 700,
                    borderBottomRightRadius: 4,
                  }}
                >
                  Let&apos;s study! ✨
                  <div
                    className="absolute bottom-[-6px] right-6 w-3 h-3"
                    style={{
                      background: "#7C3AED",
                      clipPath: "polygon(0 0, 100% 0, 50% 100%)",
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Celebrating student — bottom left, static */}
            <div
              className="absolute bottom-8 left-0 z-20"
            >
              <div className="relative w-24 h-24">
                <Image
                  src="/images/mascots/new/student-celebrate.png"
                  alt="Celebrating student character"
                  fill
                  className="object-contain drop-shadow-xl"
                />
              </div>
            </div>

            {/* Reading student — top left, static */}
            <div
              className="absolute top-12 left-6 z-20"
            >
              <div className="relative w-20 h-20">
                <Image
                  src="/images/mascots/new/student-study.png"
                  alt="Student reading with headphones"
                  fill
                  className="object-contain drop-shadow-xl"
                />
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
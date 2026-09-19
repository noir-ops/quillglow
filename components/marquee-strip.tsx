"use client"

import { Brain, BookOpen, Sparkles, Layers, FileText, Zap, Star, Network, Headphones, Award, Calendar, ClipboardCheck } from "lucide-react"

const chips = [
  { icon: Brain, label: "AI Study Agent", color: "#7C3AED", bg: "#EDE9FF" },
  { icon: Sparkles, label: "EchoMind", color: "#F59E0B", bg: "#FFF4E0" },
  { icon: Network, label: "Mind Maps", color: "#3B82F6", bg: "#E8F4FF" },
  { icon: BookOpen, label: "Revision Notes", color: "#10B981", bg: "#E8FFF4" },
  { icon: Layers, label: "Flashcards", color: "#EC4899", bg: "#FFF0F6" },
  { icon: FileText, label: "AI Exams", color: "#7C3AED", bg: "#EDE9FF" },
  { icon: Headphones, label: "Audio Overview", color: "#F59E0B", bg: "#FFF4E0" },
  { icon: Award, label: "Scholarships", color: "#10B981", bg: "#E8FFF4" },
  { icon: Calendar, label: "Study Planner", color: "#3B82F6", bg: "#E8F4FF" },
  { icon: Zap, label: "AI Tutor", color: "#EC4899", bg: "#FFF0F6" },
  { icon: Star, label: "Spaced Repetition", color: "#F59E0B", bg: "#FFF4E0" },
  { icon: ClipboardCheck, label: "Exam Prep", color: "#EF4444", bg: "#FEF2F2" },
]

function Chip({ icon: Icon, label, color, bg }: (typeof chips)[0]) {
  return (
    <div
      className="inline-flex items-center gap-2.5 rounded-full px-5 py-2.5 shrink-0 mx-2"
      style={{ background: bg, border: `1.5px solid ${color}20` }}
    >
      <div className="h-7 w-7 rounded-full flex items-center justify-center" style={{ background: `${color}18` }}>
        <Icon className="h-4 w-4" style={{ color }} />
      </div>
      <span className="text-sm font-700 text-[#1C1917] whitespace-nowrap" style={{ fontWeight: 700 }}>{label}</span>
    </div>
  )
}

export function MarqueeStrip() {
  const doubled = [...chips, ...chips]

  return (
    <section className="relative py-14 overflow-hidden" style={{ background: "#FFFDF7" }}>
      {/* Fade edges */}
      <div className="absolute left-0 top-0 bottom-0 w-24 z-10 pointer-events-none" style={{ background: "linear-gradient(to right, #FFFDF7, transparent)" }} />
      <div className="absolute right-0 top-0 bottom-0 w-24 z-10 pointer-events-none" style={{ background: "linear-gradient(to left, #FFFDF7, transparent)" }} />

      {/* Row 1 — left */}
      <div className="flex overflow-hidden mb-4">
        <div className="flex animate-marquee-l">
          {doubled.map((chip, i) => (
            <Chip key={i} {...chip} />
          ))}
        </div>
      </div>

      {/* Row 2 — right */}
      <div className="flex overflow-hidden">
        <div className="flex animate-marquee-r">
          {[...doubled].reverse().map((chip, i) => (
            <Chip key={i} {...chip} />
          ))}
        </div>
      </div>
    </section>
  )
}
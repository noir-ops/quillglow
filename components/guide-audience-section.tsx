"use client"

import { useRef } from "react"
import { motion, useInView } from "framer-motion"
import { Users, ShieldCheck, Lightbulb, Home, GraduationCap } from "lucide-react"

const AUDIENCES = [
  { icon: Users, audience: "Parents", message: "Your child's education shouldn't be something you have to navigate alone.", color: "#7C3AED", bg: "#EDE9FF" },
  { icon: ShieldCheck, audience: "Guardians", message: "Stay informed. Stay involved. Help them move forward.", color: "#10B981", bg: "#E8FFF4" },
  { icon: Lightbulb, audience: "Mentors", message: "Your guidance could open a door they didn't know existed.", color: "#F59E0B", bg: "#FFF4E0" },
  { icon: Home, audience: "Families", message: "Give them more than support. Give them direction.", color: "#3B82F6", bg: "#E8F4FF" },
  { icon: GraduationCap, audience: "Educators", message: "Extend your guidance beyond the classroom.", color: "#EC4899", bg: "#FFF0F8" },
]

function AudienceCard({ item, delay }: { item: typeof AUDIENCES[0]; delay: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -40, rotate: -4 }}
      whileInView={{ opacity: 1, x: 0, rotate: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.6, delay, type: "spring", stiffness: 120 }}
      whileHover={{ scale: 1.02, y: -3 }}
      className="flex items-center gap-4 rounded-2xl px-5 py-4 shadow-lg cursor-default"
      style={{ background: item.bg, border: `1.5px solid ${item.color}22` }}
    >
      <div className="h-11 w-11 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${item.color}18` }}>
        <item.icon className="h-5 w-5" style={{ color: item.color }} />
      </div>
      <div>
        <p className="text-sm" style={{ fontWeight: 800, color: "#1C1917" }}>{item.audience}</p>
        <p className="text-sm text-[#6B7280] leading-relaxed mt-0.5">{item.message}</p>
      </div>
    </motion.div>
  )
}

export function GuideAudienceSection() {
  const ref = useRef<HTMLDivElement>(null)
  const isInView = useInView(ref, { once: true, margin: "-80px" })

  return (
    <div ref={ref} className="rounded-3xl border-2 border-white bg-white p-8 md:p-10 shadow-lg mb-16 relative overflow-hidden">
      <div aria-hidden className="pointer-events-none absolute -top-20 -right-20 h-64 w-64 rounded-full bg-[#7C3AED]/06 blur-[80px]" />

      <p className="text-[#6B7280] leading-relaxed relative">
        Rather than giving every audience a completely different signup flow, use one{" "}
        <span style={{ fontWeight: 800, color: "#1C1917" }}>Guide account</span> with the appropriate relationship selected during onboarding.
      </p>

      <motion.h3
        initial={{ opacity: 0, y: 16 }}
        animate={isInView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.5 }}
        className="mt-8 text-xl md:text-2xl tracking-tight text-[#1C1917] relative"
        style={{ fontWeight: 800 }}
      >
        How will you Guide?
      </motion.h3>

      <div className="mt-6 space-y-3 relative">
        {AUDIENCES.map((item, i) => (
          <AudienceCard key={item.audience} item={item} delay={0.15 + i * 0.1} />
        ))}
      </div>
    </div>
  )
}
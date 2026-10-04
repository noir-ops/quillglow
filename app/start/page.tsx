import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { GraduationCap, HeartHandshake, Landmark, ArrowRight } from "lucide-react"
import Link from "next/link"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Start Here - QuillGlow",
  description: "Tell us how you'll use QuillGlow and we'll get you set up — as a Learner, a Guide, or an Impact Partner.",
  alternates: {
    canonical: "https://www.quillglow.com/start",
  },
}

const ROLES = [
  {
    icon: GraduationCap,
    title: "I'm a Learner",
    desc: "AI tutoring, flashcards, mind maps, and a real scholarship wallet.",
    color: "#7C3AED",
    bg: "#EDE9FF",
    cta: "Start Free",
    href: "/auth/signup",
  },
  {
    icon: HeartHandshake,
    title: "I'm a Guide",
    desc: "Support a learner — family or mentor — and track their progress.",
    color: "#10B981",
    bg: "#E8FFF4",
    cta: "Create a Guide account",
    href: process.env.NEXT_PUBLIC_GUARDIAN_URL || "https://guide.quillglow.com",
  },
  {
    icon: Landmark,
    title: "I'm an Impact Partner",
    desc: "Fund scholarships, review applicants, and disburse real awards.",
    color: "#F59E0B",
    bg: "#FFF4E0",
    cta: "Become an Impact Partner",
    href: process.env.NEXT_PUBLIC_BENEFACTOR_URL || "https://impact.quillglow.com",
  },
]

export default function StartHerePage() {
  return (
    <div className="min-h-screen bg-[#FFFDF7]">
      <Header />

      <main className="pt-32 pb-24">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 text-center mb-16">
          <h1 className="text-4xl md:text-5xl lg:text-6xl tracking-tight text-[#1C1917] text-balance" style={{ fontWeight: 900 }}>
            How will you use{" "}
            <span className="text-gradient-qg">QuillGlow?</span>
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-lg text-[#6B7280] text-balance">
            Pick the option that fits and we'll take you to the right setup.
          </p>
        </div>

        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 grid gap-6 md:grid-cols-3">
          {ROLES.map((r) => (
            <div key={r.title} className="flex flex-col rounded-3xl border-2 border-white bg-white p-8 shadow-lg">
              <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl" style={{ background: r.bg }}>
                <r.icon className="h-7 w-7" style={{ color: r.color }} />
              </div>
              <h2 className="text-2xl text-[#1C1917]" style={{ fontWeight: 800 }}>{r.title}</h2>
              <p className="mt-3 flex-1 text-[#6B7280] leading-relaxed">{r.desc}</p>
              <Link href={r.href} className="mt-8">
                <div
                  className="flex w-full items-center justify-center gap-2 rounded-2xl px-6 py-3.5 text-white shadow-md transition-transform duration-200 hover:scale-[1.02]"
                  style={{ background: r.color, fontWeight: 800 }}
                >
                  {r.cta}
                  <ArrowRight className="h-4 w-4" />
                </div>
              </Link>
            </div>
          ))}
        </div>

        <p className="mt-16 text-center text-sm text-[#6B7280]">
          Just here to compare plans? <Link href="/pricing" className="underline hover:text-[#7C3AED]" style={{ fontWeight: 700, color: "#7C3AED" }}>See Plans &amp; Pricing</Link>
        </p>
      </main>

      <Footer />
    </div>
  )
}
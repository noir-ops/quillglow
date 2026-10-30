import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { BookOpenCheck, ClipboardCheck, Award, ArrowRight } from "lucide-react"
import Link from "next/link"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Explore QuillGlow - Learn, Prepare, Discover Opportunities",
  description:
    "Explore QuillGlow: build knowledge with AI tutoring, get exam-ready with practice and revision tools, and discover scholarships and opportunities matched to you.",
  alternates: {
    canonical: "https://www.quillglow.com/explore",
  },
}

const DOORS = [
  {
    icon: BookOpenCheck,
    title: "Learn",
    desc: "Build knowledge and master your subjects with an AI tutor, notes, mind maps, flashcards, and a study planner that keeps it all connected.",
    color: "#7C3AED",
    bg: "#EDE9FF",
    href: "/explore/learn",
  },
  {
    icon: ClipboardCheck,
    title: "Prepare",
    desc: "Get ready for the exams and goals that matter — practice exams, revision, and weakness detection across WAEC, IGCSE, JAMB, SAT, and ACT.",
    color: "#10B981",
    bg: "#E8FFF4",
    href: "/explore/prepare",
  },
  {
    icon: Award,
    title: "Opportunities",
    desc: "Discover scholarships, grants, competitions, and STEM programs matched to what you've actually mastered.",
    color: "#F59E0B",
    bg: "#FFF4E0",
    href: "/explore/opportunities",
  },
]

export default function ExplorePage() {
  return (
    <div className="min-h-screen bg-[#FFFDF7]">
      <Header />

      <main className="pt-32 pb-24">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 text-center mb-16">
          <h1 className="text-4xl md:text-5xl lg:text-6xl tracking-tight text-[#1C1917] text-balance" style={{ fontWeight: 900 }}>
            What are you{" "}
            <span className="text-gradient-qg">exploring?</span>
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-[#6B7280] text-balance">
            One platform to move from learning to opportunity. Pick a door to get started.
          </p>
        </div>

        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 grid gap-6 md:grid-cols-3">
          {DOORS.map((d) => (
            <Link key={d.title} href={d.href} className="group block">
              <div className="flex h-full flex-col rounded-3xl border-2 border-white bg-white p-8 shadow-lg transition-all duration-200 hover:-translate-y-1 hover:shadow-xl">
                <div
                  className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl transition-transform duration-200 group-hover:scale-110"
                  style={{ background: d.bg }}
                >
                  <d.icon className="h-7 w-7" style={{ color: d.color }} />
                </div>
                <h2 className="text-2xl text-[#1C1917]" style={{ fontWeight: 800 }}>{d.title}</h2>
                <p className="mt-3 flex-1 text-[#6B7280] leading-relaxed">{d.desc}</p>
                <span
                  className="mt-6 inline-flex items-center gap-1.5 text-sm"
                  style={{ fontWeight: 700, color: d.color }}
                >
                  Explore {d.title}
                  <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
                </span>
              </div>
            </Link>
          ))}
        </div>
      </main>

      <Footer />
    </div>
  )
}
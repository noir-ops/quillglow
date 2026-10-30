import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import {
  ArrowRight, Eye, ClipboardCheck, Award, Lightbulb,
  Users, CalendarCheck, Gift, ShieldCheck, Clock, CheckCircle2, ChevronRight,
} from "lucide-react"
import Link from "next/link"
import type { Metadata } from "next"
import { GuideAudienceSection } from "@/components/guide-audience-section"
import { DashboardIllustration, GraduationIllustration } from "@/components/guide-illustrations"

export const metadata: Metadata = {
  title: "Guide - QuillGlow",
  description:
    "QuillGlow gives parents, guardians, and mentors a clearer way to support the learners who depend on them — from learning and exam prep to scholarships and opportunities.",
  alternates: {
    canonical: "https://www.quillglow.com/guide",
  },
}

const GUARDIAN_URL = process.env.NEXT_PUBLIC_GUARDIAN_URL || "https://guide.quillglow.com"

const WHY_GUIDE = [
  { icon: Eye, title: "Stay Connected to Their Learning", color: "#7C3AED", bg: "#EDE9FF" },
  { icon: ClipboardCheck, title: "Guide Their Preparation", color: "#10B981", bg: "#E8FFF4" },
  { icon: Award, title: "Discover Opportunities Together", color: "#F59E0B", bg: "#FFF4E0" },
]

const GUIDE_BENEFITS = [
  { icon: Eye, title: "Stay informed", desc: "See real-time progress, study plans, and areas that need attention.", color: "#10B981" },
  { icon: CalendarCheck, title: "Guide with clarity", desc: "Help with study plans, revision, exam prep, and academic goals.", color: "#3B82F6" },
  { icon: Gift, title: "Find opportunities", desc: "Discover scholarships, programs, grants, and more — together.", color: "#7C3AED" },
  { icon: ShieldCheck, title: "Make better decisions", desc: "Get the insights you need to choose the best path forward.", color: "#EC4899" },
  { icon: Users, title: "Support multiple learners", desc: "Manage and support more than one learner — all in one place.", color: "#F59E0B" },
  { icon: Clock, title: "Save time, make impact", desc: "Everything you need in one simple, organized dashboard.", color: "#8B5CF6" },
]

function GuideCTA({ label, href = GUARDIAN_URL, variant = "primary" }: { label: string; href?: string; variant?: "primary" | "secondary" }) {
  if (variant === "secondary") {
    return (
      <Link
        href={href}
        target={href.startsWith("http") ? "_blank" : undefined}
        className="inline-flex items-center gap-1.5 text-sm"
        style={{ fontWeight: 700, color: "#10B981" }}
      >
        {label}
        <ArrowRight className="h-4 w-4" />
      </Link>
    )
  }
  return (
    <Link href={href} target={href.startsWith("http") ? "_blank" : undefined}>
      <div
        className="inline-flex items-center gap-2 rounded-2xl px-7 py-3.5 text-white shadow-md transition-transform duration-200 hover:scale-[1.02]"
        style={{ background: "linear-gradient(135deg, #10B981, #34D399)", fontWeight: 800 }}
      >
        {label}
        <ArrowRight className="h-4 w-4" />
      </div>
    </Link>
  )
}

export default function GuidePage() {
  return (
    <div className="min-h-screen bg-[#FFFDF7]">
      <Header />

      <main className="pt-32 pb-24">
        {/* Hero */}
        <section className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 text-center mb-24">
          <h1 className="text-4xl md:text-5xl lg:text-6xl tracking-tight text-[#1C1917] text-balance" style={{ fontWeight: 900 }}>
            Be there for{" "}
            <span className="text-gradient-qg">every step of their journey</span>
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-[#6B7280] text-balance">
            QuillGlow gives parents, guardians, and mentors a clearer way to support the learners who depend on them.
          </p>
          <p className="mx-auto mt-3 max-w-2xl text-lg text-[#6B7280] text-balance">
            From learning and exam preparation to scholarships and educational opportunities, Guides can stay informed, provide direction, and help learners make better decisions — without having to manage everything themselves.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
            <GuideCTA label="Become a Guide" />
            <GuideCTA label="Explore How It Works" href="#guide-and-mentor" variant="secondary" />
          </div>
        </section>

        {/* Guide positioning + Why become a Guide (combined) */}
        <section className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 mb-24">
          <div className="rounded-3xl border-2 border-white bg-white p-8 md:p-10 shadow-lg">
            <h2 className="text-2xl md:text-3xl tracking-tight text-[#1C1917] text-balance" style={{ fontWeight: 900 }}>
              More than a guardian. More than a mentor. Be their Guide.
            </h2>
            <p className="mt-4 text-[#6B7280] leading-relaxed">
              Every learner needs someone who can help them understand where they are, where they want to go, and what they need to do next.
            </p>
            <p className="mt-4 text-[#6B7280] leading-relaxed">
              QuillGlow brings the tools, information, and visibility families and mentors need to provide meaningful guidance throughout a learner&apos;s educational journey.
            </p>
            <p className="mt-4 text-[#1C1917]" style={{ fontWeight: 700 }}>
              Support their journey. Guide their next step. Help them discover what&apos;s possible.
            </p>

            <h3 className="mt-10 text-xl md:text-2xl tracking-tight text-[#1C1917] text-balance" style={{ fontWeight: 800 }}>
              Why become a Guide?
            </h3>
            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              {WHY_GUIDE.map((w) => (
                <div key={w.title} className="rounded-2xl border border-[#7C3AED]/10 bg-[#FFFDF7] p-5">
                  <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: w.bg }}>
                    <w.icon className="h-5 w-5" style={{ color: w.color }} />
                  </div>
                  <p className="text-sm text-[#1C1917]" style={{ fontWeight: 700 }}>{w.title}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Guardian + Mentor (combined) */}
        <section id="guide-and-mentor" className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 mb-24">
          <div className="grid gap-6 md:grid-cols-2">
            <div className="rounded-3xl border-2 border-white bg-white p-8 shadow-lg">
              <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl" style={{ background: "#E8F4FF" }}>
                <Eye className="h-6 w-6" style={{ color: "#3B82F6" }} />
              </div>
              <h3 className="text-xl md:text-2xl tracking-tight text-[#1C1917] text-balance" style={{ fontWeight: 800 }}>
                Know more. Guide better. Stay involved.
              </h3>
              <p className="mt-4 text-[#6B7280] leading-relaxed">
                You don&apos;t have to be an education expert to support a learner effectively.
              </p>
              <p className="mt-4 text-[#6B7280] leading-relaxed">
                QuillGlow gives parents and guardians a clearer view of the educational journey so they can monitor progress, understand academic needs, support preparation, discover scholarships, manage relevant educational funding, evaluate opportunities, and stay informed about important activity.
              </p>
              <p className="mt-4 text-[#1C1917]" style={{ fontWeight: 700 }}>
                Be involved without being intrusive.
              </p>
            </div>

            <div className="rounded-3xl border-2 border-white bg-white p-8 shadow-lg">
              <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl" style={{ background: "#FFF4E0" }}>
                <Lightbulb className="h-6 w-6" style={{ color: "#F59E0B" }} />
              </div>
              <h3 className="text-xl md:text-2xl tracking-tight text-[#1C1917] text-balance" style={{ fontWeight: 800 }}>
                Your experience could change a learner&apos;s direction.
              </h3>
              <p className="mt-4 text-[#6B7280] leading-relaxed">
                Mentorship can provide something technology cannot replace: human guidance and experience.
              </p>
              <p className="mt-4 text-[#6B7280] leading-relaxed">
                Guides can help learners set goals, understand their strengths, identify areas for improvement, navigate examinations, explore opportunities, consider future pathways, and make informed decisions.
              </p>
              <p className="mt-4 text-[#1C1917]" style={{ fontWeight: 700 }}>
                Share what you know. Help someone discover what&apos;s next.
              </p>
            </div>
          </div>
        </section>

        {/* Audience-specific + Final conversion (combined) */}
        <section className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <GuideAudienceSection />
        </section>

        {/* Final section — redesigned */}
        <section className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="relative mb-14">
            <DashboardIllustration className="hidden lg:block absolute right-0 top-1/2 -translate-y-1/2 w-48 xl:w-56" />

            <div className="mx-auto max-w-3xl text-center">
              <span
                className="mb-5 inline-flex items-center gap-2 rounded-full bg-[#EDE9FF] px-4 py-1.5 text-sm"
                style={{ fontWeight: 700, color: "#7C3AED" }}
              >
                <Users className="h-4 w-4" /> For Families, Guardians &amp; Mentors
              </span>
              <h2 className="text-3xl md:text-4xl lg:text-5xl tracking-tight text-[#1C1917] text-balance" style={{ fontWeight: 900 }}>
                Be more than someone who watches their progress. Be someone who{" "}
                <span className="text-gradient-qg">helps shape it.</span>
              </h2>
              <p className="mx-auto mt-5 max-w-2xl text-lg text-[#6B7280] text-balance">
                QuillGlow gives you the tools, insights, and visibility to support learners with confidence — saving you time while making a bigger impact.
              </p>
            </div>
          </div>

          {/* 6-item benefit grid */}
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3 mb-14">
            {GUIDE_BENEFITS.map((b) => (
              <div key={b.title} className="text-center">
                <div
                  className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl"
                  style={{ background: `${b.color}18` }}
                >
                  <b.icon className="h-6 w-6" style={{ color: b.color }} />
                </div>
                <h3 className="text-base text-[#1C1917]" style={{ fontWeight: 800 }}>{b.title}</h3>
                <p className="mt-1.5 text-sm text-[#6B7280] leading-relaxed">{b.desc}</p>
              </div>
            ))}
          </div>

          {/* Guidance banner */}
          <div className="rounded-3xl bg-[#F3EEFF] p-8 md:p-10 mb-12">
            <div className="grid gap-8 md:grid-cols-2 md:items-center">
              <div className="flex items-start gap-4">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#7C3AED] shadow-md">
                  <ShieldCheck className="h-7 w-7 text-white" />
                </div>
                <div>
                  <h3 className="text-xl md:text-2xl tracking-tight text-[#1C1917]" style={{ fontWeight: 800 }}>
                    Your guidance. Their future.
                  </h3>
                  <p className="mt-2 text-[#6B7280] leading-relaxed">
                    You don&apos;t have to be an education expert to make a powerful difference. You just have to be there.
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-between gap-6">
                <div className="space-y-3">
                  {["Monitor without intruding", "Encourage with confidence", "Empower for independence"].map((item) => (
                    <div key={item} className="flex items-center gap-3">
                      <CheckCircle2 className="h-5 w-5 shrink-0" style={{ color: "#7C3AED" }} />
                      <span className="text-[#1C1917]" style={{ fontWeight: 600 }}>{item}</span>
                    </div>
                  ))}
                </div>
                <GraduationIllustration className="hidden sm:block w-24 shrink-0" />
              </div>
            </div>
          </div>

          {/* Final CTA */}
          <div className="text-center pb-16">
            <GuideCTA label="Become a Guide" />
            <p className="mt-4 text-sm text-[#6B7280]">It&apos;s free to get started. Make an impact that lasts.</p>
            <Link
              href="#guide-and-mentor"
              className="mt-4 inline-flex items-center gap-1 text-sm"
              style={{ fontWeight: 700, color: "#7C3AED" }}
            >
              Explore How It Works
              <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  )
}
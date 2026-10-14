import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import {
  Sparkles, Users, DollarSign, Globe2, BarChart3, GraduationCap,
  HandCoins, BookOpen, Wrench, Link2, Briefcase, Award,
  ArrowRight, GitBranch, Send, Search as SearchIcon, CheckCircle2, TrendingUp, Compass,
} from "lucide-react"
import Link from "next/link"
import type { Metadata } from "next"
import { CommunityPartnersDirectory } from "@/components/community-partners-directory"

export const metadata: Metadata = {
  title: "Impact Partners - QuillGlow",
  description:
    "Partner with QuillGlow to reach motivated learners, fund scholarships and educational opportunity, and build measurable impact at scale.",
  alternates: {
    canonical: "https://www.quillglow.com/impact-partners",
  },
}

const BENEFACTOR_URL = process.env.NEXT_PUBLIC_BENEFACTOR_URL || "https://impact.quillglow.com"

const WHY_PARTNER = [
  {
    icon: Users,
    title: "Reach More Learners",
    desc: "Connect your organization, programs, scholarships, and opportunities with learners actively seeking ways to advance their education.",
    color: "#7C3AED",
    bg: "#EDE9FF",
  },
  {
    icon: DollarSign,
    title: "Fund Opportunity",
    desc: "Create or support scholarships and targeted educational initiatives while maintaining visibility into how your support is being used.",
    color: "#10B981",
    bg: "#E8FFF4",
  },
  {
    icon: Globe2,
    title: "Extend Your Impact",
    desc: "Use QuillGlow's infrastructure to reach learners across emerging markets without having to build your own technology platform.",
    color: "#F59E0B",
    bg: "#FFF4E0",
  },
  {
    icon: BarChart3,
    title: "Measure What Matters",
    desc: "Access meaningful impact information — participation, scholarship distribution, learner progress, and outcomes — subject to appropriate privacy controls.",
    color: "#3B82F6",
    bg: "#E8F4FF",
  },
  {
    icon: GraduationCap,
    title: "Build the Next Generation",
    desc: "Support students today who can become tomorrow's professionals, innovators, mentors, entrepreneurs, and community leaders.",
    color: "#EC4899",
    bg: "#FFF0F8",
  },
  {
    icon: Compass,
    title: "Help Expand Access",
    desc: "As an Impact Partner, your organization can help QuillGlow connect more learners with the resources, people, funding, and opportunities they need to succeed. Together, we can make more pathways to education and opportunity accessible to more learners.",
    color: "#6366F1",
    bg: "#EEEEFF",
  },
]

const HOW_YOU_CAN_HELP = [
  { icon: HandCoins, label: "Fund" },
  { icon: Users, label: "Mentor" },
  { icon: BookOpen, label: "Educate" },
  { icon: Wrench, label: "Equip" },
  { icon: Link2, label: "Connect" },
  { icon: Briefcase, label: "Employ" },
]

const HOW_IT_WORKS = [
  { icon: Send, title: "Partner", desc: "Join as an Impact Partner and tell us how you can help.", color: "#7C3AED", bg: "#EDE9FF" },
  { icon: GitBranch, title: "Create / Provide", desc: "Set up scholarships, mentorship, or resources for learners.", color: "#10B981", bg: "#E8FFF4" },
  { icon: SearchIcon, title: "Reach Learners", desc: "QuillGlow matches your opportunity with the right students.", color: "#F59E0B", bg: "#FFF4E0" },
  { icon: TrendingUp, title: "Track Impact", desc: "See participation, distribution, and outcomes as they happen.", color: "#3B82F6", bg: "#E8F4FF" },
]

const SCHOLARSHIP_CAPABILITIES = [
  "Scholarship creation",
  "Eligibility criteria",
  "Application management",
  "Mentor/reviewer workflows",
  "Applicant screening",
  "Scholarship matching",
  "Controlled fund distribution",
  "Recipient progress monitoring",
  "Impact reporting",
]

const CORPORATE_WAYS = [
  "Scholarship sponsorship",
  "Employee mentorship",
  "Educational resources",
  "Technology access",
  "Competitions",
  "Internships",
  "Career programs",
  "STEM initiatives",
  "Community investment",
]

const UNIVERSITY_OPPORTUNITIES = [
  "Scholarship recruitment",
  "Student outreach",
  "Program promotion",
  "Academic partnerships",
  "Talent identification",
  "Recruitment pathways",
]

function PrimaryCTA({ label, href = BENEFACTOR_URL }: { label: string; href?: string }) {
  return (
    <Link href={href} target={href.startsWith("http") ? "_blank" : undefined}>
      <div
        className="inline-flex items-center gap-2 rounded-2xl px-7 py-3.5 text-white shadow-md transition-transform duration-200 hover:scale-[1.02]"
        style={{ background: "linear-gradient(135deg, #7C3AED, #A855F7)", fontWeight: 800 }}
      >
        {label}
        <ArrowRight className="h-4 w-4" />
      </div>
    </Link>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#7C3AED]/20 bg-[#EDE9FF] px-4 py-1.5 text-sm text-[#7C3AED]"
      style={{ fontWeight: 700 }}
    >
      {children}
    </span>
  )
}

export default function ImpactPartnersPage() {
  return (
    <div className="min-h-screen bg-[#FFFDF7]">
      <Header />

      <main className="pt-32 pb-24">
        {/* Hero */}
        <section className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 text-center mb-24">
          <SectionLabel>
            <Sparkles className="h-4 w-4" /> Impact Partners
          </SectionLabel>
          <h1 className="text-4xl md:text-5xl lg:text-6xl tracking-tight text-[#1C1917] text-balance" style={{ fontWeight: 900 }}>
            Turn your resources into{" "}
            <span className="text-gradient-qg">real educational impact</span>
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-[#6B7280] text-balance">
            Partner with QuillGlow to reach motivated learners, support educational opportunity, and build measurable impact at scale.
          </p>
          <p className="mx-auto mt-3 max-w-2xl text-lg text-[#6B7280] text-balance">
            From scholarships and mentorship to learning resources and career opportunities, your organization can help students move from potential to possibility.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
            <PrimaryCTA label="Become an Impact Partner" />
            <a
              href="#partnership-programs"
              className="inline-flex items-center gap-1.5 text-sm"
              style={{ fontWeight: 700, color: "#7C3AED" }}
            >
              Explore Partnership Opportunities
              <ArrowRight className="h-4 w-4" />
            </a>
          </div>
        </section>

        {/* Why Become an Impact Partner */}
        <section className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 mb-24">
          <h2 className="text-center text-3xl md:text-4xl tracking-tight text-[#1C1917] mb-12" style={{ fontWeight: 900 }}>
            Why become an Impact Partner?
          </h2>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {WHY_PARTNER.map((w) => (
              <div key={w.title} className="rounded-3xl border-2 border-white bg-white p-7 shadow-lg">
                <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl" style={{ background: w.bg }}>
                  <w.icon className="h-6 w-6" style={{ color: w.color }} />
                </div>
                <h3 className="text-lg text-[#1C1917]" style={{ fontWeight: 800 }}>{w.title}</h3>
                <p className="mt-2 text-sm text-[#6B7280] leading-relaxed">{w.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Recruitment Statement */}
        <section className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 mb-24 text-center">
          <h2 className="text-3xl md:text-4xl tracking-tight text-[#1C1917] text-balance mb-6" style={{ fontWeight: 900 }}>
            We&apos;re looking for organizations that want to{" "}
            <span className="text-gradient-qg">do more than donate</span>
          </h2>
          <p className="text-lg text-[#6B7280] text-balance">
            We are looking for Impact Partners who believe educational opportunity should be easier to discover, access, fund, and measure.
          </p>
          <p className="mt-4 text-lg text-[#6B7280] text-balance">
            Whether you can provide funding, knowledge, mentorship, technology, educational resources, opportunities, or institutional support, there is a place for you in the ecosystem.
          </p>
          <p className="mt-6 text-xl text-[#1C1917]" style={{ fontWeight: 800 }}>
            Your resources. Our infrastructure. Their opportunity.
          </p>
          <div className="mt-8 flex justify-center">
            <PrimaryCTA label="Become an Impact Partner" />
          </div>
        </section>

        {/* How You Can Help */}
        <section id="partnership-programs" className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 mb-16">
          <h2 className="text-center text-2xl md:text-3xl tracking-tight text-[#1C1917] mb-8" style={{ fontWeight: 900 }}>
            How you can help
          </h2>
          <div className="flex flex-wrap items-center justify-center gap-3">
            {HOW_YOU_CAN_HELP.map((h) => (
              <div
                key={h.label}
                className="inline-flex items-center gap-2 rounded-full border-2 border-white bg-white px-5 py-2.5 shadow-sm"
              >
                <h.icon className="h-4 w-4 text-[#7C3AED]" />
                <span className="text-sm text-[#1C1917]" style={{ fontWeight: 700 }}>{h.label}</span>
              </div>
            ))}
          </div>
        </section>

        {/* How It Works */}
        <section className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 mb-24">
          <h2 className="text-center text-2xl md:text-3xl tracking-tight text-[#1C1917] mb-12" style={{ fontWeight: 900 }}>
            How it works
          </h2>
          <div className="relative grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            <div
              aria-hidden
              className="pointer-events-none absolute top-8 left-[12.5%] right-[12.5%] hidden h-0.5 lg:block"
              style={{ background: "linear-gradient(90deg, #7C3AED33, #10B98133, #F59E0B33, #3B82F633)" }}
            />
            {HOW_IT_WORKS.map((step) => (
              <div key={step.title} className="relative flex flex-col items-center text-center">
                <div
                  className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl shadow-md"
                  style={{ background: step.bg }}
                >
                  <step.icon className="h-7 w-7" style={{ color: step.color }} />
                </div>
                <h3 className="text-base text-[#1C1917]" style={{ fontWeight: 800 }}>{step.title}</h3>
                <p className="mt-1.5 text-sm text-[#6B7280] leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* For Scholarship Partners */}
        <section className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 mb-16">
          <div className="rounded-3xl border-2 border-white bg-white p-8 md:p-10 shadow-lg">
            <SectionLabel>
              <Award className="h-4 w-4" /> For Scholarship Partners
            </SectionLabel>
            <h3 className="text-2xl md:text-3xl tracking-tight text-[#1C1917] text-balance" style={{ fontWeight: 900 }}>
              Create more than a scholarship. Create a pathway.
            </h3>
            <p className="mt-4 text-[#6B7280] leading-relaxed">
              QuillGlow can help organizations move beyond simply distributing funds. Partners can establish scholarship programs with defined eligibility requirements, application workflows, review processes, funding controls, and recipient tracking.
            </p>
            <p className="mt-4 text-[#1C1917]" style={{ fontWeight: 700 }}>
              Your organization provides the opportunity. QuillGlow provides the infrastructure to help deliver it.
            </p>
            <p className="mt-6 text-sm text-[#6B7280]" style={{ fontWeight: 700 }}>Potential capabilities include:</p>
            <ul className="mt-3 grid gap-2 sm:grid-cols-2">
              {SCHOLARSHIP_CAPABILITIES.map((c) => (
                <li key={c} className="flex items-center gap-2 text-sm text-[#1C1917]">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-[#7C3AED]" />
                  {c}
                </li>
              ))}
            </ul>
            <div className="mt-8">
              <PrimaryCTA label="Create a Scholarship Program" />
            </div>
          </div>
        </section>

        {/* For Corporate Partners */}
        <section className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 mb-16">
          <div className="rounded-3xl border-2 border-white bg-white p-8 md:p-10 shadow-lg">
            <SectionLabel>
              <Briefcase className="h-4 w-4" /> For Corporate Partners
            </SectionLabel>
            <h3 className="text-2xl md:text-3xl tracking-tight text-[#1C1917] text-balance" style={{ fontWeight: 900 }}>
              Put your brand behind opportunity.
            </h3>
            <p className="mt-4 text-[#6B7280] leading-relaxed">
              Your organization can support education while building meaningful relationships with the next generation of students and professionals.
            </p>
            <p className="mt-6 text-sm text-[#6B7280]" style={{ fontWeight: 700 }}>Partner through:</p>
            <ul className="mt-3 grid gap-2 sm:grid-cols-2">
              {CORPORATE_WAYS.map((c) => (
                <li key={c} className="flex items-center gap-2 text-sm text-[#1C1917]">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-[#EC4899]" />
                  {c}
                </li>
              ))}
            </ul>
            <div className="mt-8">
              <Link href={BENEFACTOR_URL} target={BENEFACTOR_URL.startsWith("http") ? "_blank" : undefined}>
                <div
                  className="inline-flex items-center gap-2 rounded-2xl px-7 py-3.5 text-white shadow-md transition-transform duration-200 hover:scale-[1.02]"
                  style={{ background: "#EC4899", fontWeight: 800 }}
                >
                  Build a Corporate Partnership
                  <ArrowRight className="h-4 w-4" />
                </div>
              </Link>
            </div>
          </div>
        </section>

        {/* For Universities & Institutions */}
        <section className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 mb-24">
          <div className="rounded-3xl border-2 border-white bg-white p-8 md:p-10 shadow-lg">
            <SectionLabel>
              <GraduationCap className="h-4 w-4" /> For Universities &amp; Institutions
            </SectionLabel>
            <h3 className="text-2xl md:text-3xl tracking-tight text-[#1C1917] text-balance" style={{ fontWeight: 900 }}>
              Find and support the learners who are ready for more.
            </h3>
            <p className="mt-4 text-[#6B7280] leading-relaxed">
              Connect with students who are actively preparing for examinations, pursuing scholarships, developing skills, and planning their educational futures.
            </p>
            <p className="mt-6 text-sm text-[#6B7280]" style={{ fontWeight: 700 }}>Potential partnership opportunities include:</p>
            <ul className="mt-3 grid gap-2 sm:grid-cols-2">
              {UNIVERSITY_OPPORTUNITIES.map((c) => (
                <li key={c} className="flex items-center gap-2 text-sm text-[#1C1917]">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-[#3B82F6]" />
                  {c}
                </li>
              ))}
            </ul>
            <div className="mt-8">
              <Link href={BENEFACTOR_URL} target={BENEFACTOR_URL.startsWith("http") ? "_blank" : undefined}>
                <div
                  className="inline-flex items-center gap-2 rounded-2xl px-7 py-3.5 text-white shadow-md transition-transform duration-200 hover:scale-[1.02]"
                  style={{ background: "#3B82F6", fontWeight: 800 }}
                >
                  Partner With Us
                  <ArrowRight className="h-4 w-4" />
                </div>
              </Link>
            </div>
          </div>
        </section>

        {/* Impact */}
        <section className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 mb-24 text-center">
          <h2 className="text-3xl md:text-4xl tracking-tight text-[#1C1917] mb-4" style={{ fontWeight: 900 }}>
            Impact
          </h2>
          <p className="text-lg text-[#6B7280] text-balance">
            As partnerships grow, this space will showcase measurable outcomes — recipient stories, scholarships distributed, learners supported, and opportunities provided.
          </p>
        </section>

        {/* Final CTA */}
        <section className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 text-center mb-24">
          <h2 className="text-3xl md:text-4xl tracking-tight text-[#1C1917] mb-6" style={{ fontWeight: 900 }}>
            Ready to create impact?
          </h2>
          <PrimaryCTA label="Become an Impact Partner" />
        </section>

        {/* Community & Creator Partners — merged from the original /partners page */}
        <section className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <CommunityPartnersDirectory />
        </section>
      </main>

      <Footer />
    </div>
  )
}
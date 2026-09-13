"use client"

import Link from "next/link"
import { motion } from "framer-motion"
import { Sparkles, Music, MessageCircle, Zap, Mail, Heart } from "lucide-react"
import Image from "next/image"

const NAV = [
  {
    title: "Learn",
    links: [
      { label: "Blog", href: "/blog" },
      { label: "Ambassador", href: "/ambassador" },
      { label: "Shop", href: "/shop" },
      { label: "Partners", href: "/impact-partners" },
      { label: "Pricing", href: "/pricing" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About", href: "/about" },
      { label: "Contact", href: "/contact" },
      { label: "Privacy", href: "/privacy" },
      { label: "Terms", href: "/terms" },
      { label: "FAQ", href: "/faq" },
    ],
  },
]

const SOCIALS = [
  {
    label: "Instagram",
    href: "https://www.instagram.com/quillglow_com/",
    icon: () => (
      <img
        src="/instagram.png"
        alt="Instagram"
        className="w-8 h-8 object-contain"
      />
    ),
    color: "hover:text-pink-500",
    description: "discovery",
  },
  {
    label: "Discord",
    href: "https://discord.gg/vwpSgPRntE",
    icon: () => (
      <img
        src="/discord.png"
        alt="Discord"
        className="w-10 h-10 object-contain"
      />
    ),
    color: "hover:text-blue-500",
    description: "community",
  },
  {
    label: "Youtube",
    href: "https://www.youtube.com/@Quillglow",
    icon: () => (
      <img
        src="/youtube.png"
        alt="Youtube"
        className="w-10 h-10 object-contain"
      />
    ),
    color: "hover:text-amber-500",
    description: "instant help",
  },
  {
    label: "Email",
    href: "mailto:support@quillglow.com",
    icon: () => (
      <img
        src="/email.png"
        alt="Email"
        className="w-10 h-10 object-contain"
      />
    ),
    color: "hover:text-green-500",
    description: "support",
  },
]

function Footer() {
  return (
    <div className="relative z-1 -mt-px">
      {/* --- Begin: Organic hill Duolingo-style blob from testimonials-section.tsx (lines 237-268) --- */}
      <div className="relative w-full" style={{ marginTop: 48 }}>
        <div className="h-[100px] sm:h-[140px] md:h-[180px] w-full">
          <svg
            viewBox="0 0 1440 180"
            xmlns="http://www.w3.org/2000/svg"
            preserveAspectRatio="none"
            className="absolute inset-0 w-full h-full"
            style={{ minHeight: '100px', maxHeight: '180px' }}
          >
            {/* 
              Responsive wave: 
              On mobile (h-100), on sm screens (h-140), on md+ (h-180).
              Use a different path for mobile for a nicer appearance if desired.
            */}
            <path
              d="M0,180 L0,120 C120,150 220,170 360,140 C520,100 570,40 740,80 C910,120 960,180 1150,150 C1300,115 1380,130 1440,100 L1440,180 Z"
              fill="#7C3AED"
              className="block md:hidden"
            />
            <path
              d="M0,180 L0,90 C80,130 160,155 260,140 C340,128 400,72 520,58 C620,46 680,90 760,100 C840,110 900,70 1000,55 C1100,40 1180,85 1280,105 C1340,116 1400,100 1440,88 L1440,180 Z"
              fill="#7C3AED"
              className="hidden md:block"
            />
          </svg>
        </div>
      </div>
      {/* --- End: Organic hill Duolingo-style blob --- */}

      <footer className="bg-primary pt-0 pb-8">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-12 md:grid-cols-2 lg:grid-cols-6">
            {/* Brand */}
            <div className="lg:col-span-4">
              <Link href="/" className="mb-5 inline-flex items-center gap-2.5">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl ">
                  <Image src="/icon.png" alt="QuillGlow Logo" width={40} height={40} />
                </div>
                <span className="text-xl font-900 text-white">QuillGlow</span>
              </Link>
              <p className="mb-6 max-w-sm text-sm leading-relaxed text-white">
                An AI-powered study universe for students — from personalised revision notes and mind maps to live study rooms and emotional reflection. Study smarter. Stress less.
              </p>
              <div className="flex gap-3">
                {SOCIALS.map((s) => (
                  <motion.a
                    key={s.label}
                    href={s.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={s.label}
                    whileHover={{ y: -3, scale: 1.1 }}
                    transition={{ type: "spring", stiffness: 400 }}
                    className="flex h-10 w-10 items-center justify-center rounded-xl border-2 border-[#E9E4FF] bg-white shadow-sm transition-colors duration-200 hover:border-primary/30"
                  >
                    {/* Remove passing className to s.icon (img) */}
                    <span className="h-4.5 w-4.5 flex items-center justify-center">
                      {s.icon()}
                    </span>
                  </motion.a>
                ))}
              </div>
            </div>

            {/* Nav links */}
            {NAV.map((section) => (
              <div key={section.title} className="lg:col-span-1">
                <h3
                  className="mb-4 text-sm font-800 uppercase tracking-widest text-white"
                  aria-hidden={!section.title || undefined}
                  style={!section.title ? { visibility: "hidden" } : undefined}
                >
                  {section.title || "—"}
                </h3>
                <ul className="space-y-3">
                  {section.links.map((link) => (
                    <li key={link.label}>
                      <Link
                        href={link.href}
                        className="text-sm text-white transition-colors duration-150 hover:text-gray-300"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {/* Bottom bar */}
          <div className="mt-16 flex flex-col items-center gap-2 border-t border-[#E9E4FF] pt-8 sm:flex-row sm:justify-center">
            <p className="text-sm text-white">
              © {new Date().getFullYear()} QuillGlow. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}

export default Footer
export { Footer }
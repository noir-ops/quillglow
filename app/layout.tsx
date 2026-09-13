import type React from "react"
import type { Metadata } from "next"
import { Nunito, Geist_Mono } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import "./globals.css"
import { Suspense } from "react"
import { SupportChatbot } from "@/components/support-chatbot"
import { Snowfall } from "@/components/snowfall"

const nunito = Nunito({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
  variable: "--font-sans",
  display: "swap",
})
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-mono" })

export const metadata: Metadata = {
  metadataBase: new URL("https://www.quillglow.com"),
  title: {
    default: "QuillGlow - AI Study Agent & Smart Study App for Students | Revision Notes, Mind Maps & More",
    template: "%s | QuillGlow",
  },
  icons: {
    icon: "/icon.png",
  },
  description:
    "QuillGlow's AI Study Agent builds your entire study system in seconds — personalised revision notes, mind map, practice exam, YouTube videos & review schedule. Trusted by 10,000+ students. Try free or get Genius for $4.99.",
  keywords: [
    "AI study agent",
    "AI study plan generator",
    "personalised revision notes AI",
    "study mind map generator",
    "practice exam generator AI",
    "study app for students",
    "AI-powered study tools",
    "student productivity app",
    "smart note-taking app",
    "AI quiz generator",
    "study timer pomodoro app",
    "spaced repetition study app",
    "EchoMind AI reflection",
    "revision schedule generator",
    "YouTube study video finder",
    "GCSE study app",
    "A-level study app",
    "university study app",
    "study planner app",
    "AI flashcard generator",
    "QuillGlow study agent",
    "best study app 2026",
    "free AI study assistant",
  ],
  authors: [{ name: "QuillGlow" }],
  creator: "QuillGlow",
  publisher: "QuillGlow",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://www.quillglow.com",
    siteName: "QuillGlow",
    title: "QuillGlow — AI Study Agent builds your full study system in seconds",
    description:
      "Type a topic. Get revision notes, mind map, practice exam, YouTube videos & a review schedule — all personalised to your weak areas. Try free or get Genius for $4.99.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "QuillGlow AI Study Agent — Complete personalised study system",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "QuillGlow — AI Study Agent builds your full study system in seconds",
    description:
      "Type a topic. Get revision notes, mind map, practice exam, YouTube videos & review schedule. Free to try — Genius for $4.99.",
    images: ["/og-image.png"],
    creator: "@quillglow",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  verification: {
    google: "your-google-verification-code",
  },
  alternates: {
    canonical: "https://www.quillglow.com",
  },
  generator: "v0.app",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className="scroll-smooth">
      <head>
        {/* Google Tag Manager */}
        <script async src="https://www.googletagmanager.com/gtag/js?id=G-Z00QYNDBJP"></script>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', 'G-Z00QYNDBJP');
            `,
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Organization",
              name: "QuillGlow",
              url: "https://www.quillglow.com",
              logo: "https://www.quillglow.com/logo.png",
              description:
                "AI-powered study app for students with smart note-taking, quiz generation, and productivity tools",
              sameAs: [
                "https://twitter.com/quillglow",
                "https://facebook.com/quillglow",
                "https://instagram.com/quillglow",
              ],
              contactPoint: {
                "@type": "ContactPoint",
                email: "support@quillglow.com",
                contactType: "Customer Support",
              },
            }),
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebApplication",
              name: "QuillGlow",
              url: "https://www.quillglow.com",
              applicationCategory: "EducationalApplication",
              operatingSystem: "Web",
              offers: [
                {
                  "@type": "Offer",
                  name: "Scholar (Free)",
                  price: "0",
                  priceCurrency: "USD",
                  description: "Free forever plan with 1 Study Agent run per day and 3 EchoMind sessions per month",
                },
                {
                  "@type": "Offer",
                  name: "Genius — Intro Offer",
                  price: "4.99",
                  priceCurrency: "USD",
                  description: "Unlimited Study Agent runs, unlimited EchoMind sessions, and all premium features",
                  eligibleCustomerType: "NewCustomer",
                },
              ],
              aggregateRating: {
                "@type": "AggregateRating",
                ratingValue: "4.8",
                ratingCount: "1250",
              },
              featureList: [
                "AI Study Agent — complete study system generator",
                "EchoMind AI reflection companion",
                "Personalised revision notes",
                "Interactive mind maps",
                "AI practice exam generator",
                "YouTube study video finder",
                "Smart spaced repetition review schedule",
                "Pomodoro study timer",
                "AI flashcard generator",
                "Stress relief tools",
              ],
            }),
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Product",
              name: "QuillGlow AI Study Agent",
              url: "https://www.quillglow.com/#study-agent",
              description:
                "The AI Study Agent builds a complete personalised study system in seconds — revision notes, mind map, practice exam, YouTube videos, and a smart review schedule — all tailored to your weak areas.",
              brand: { "@type": "Brand", name: "QuillGlow" },
              offers: {
                "@type": "Offer",
                price: "4.99",
                priceCurrency: "USD",
                availability: "https://schema.org/InStock",
                priceValidUntil: "2026-12-31",
                description: "First-time intro offer for Genius plan",
              },
              aggregateRating: {
                "@type": "AggregateRating",
                ratingValue: "4.9",
                ratingCount: "843",
              },
            }),
          }}
        />
      </head>
      <body className={`font-sans antialiased ${nunito.variable} ${geistMono.variable}`}>
        <Suspense fallback={null}>{children}</Suspense>
        <Analytics />
      </body>
    </html>
  )
}

import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { FAQSection } from "@/components/faq-section"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "FAQ - QuillGlow",
  description: "Answers to common questions about QuillGlow — the Scholar and Genius plans, the AI Study Agent, EchoMind, and more.",
  alternates: {
    canonical: "https://www.quillglow.com/faq",
  },
}

export default function FAQPage() {
  return (
    <div className="min-h-screen bg-[#FFFDF7]">
      <Header />
      <main className="pt-20">
        <FAQSection />
      </main>
      <Footer />
    </div>
  )
}
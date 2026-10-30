"use client"

import { motion } from "framer-motion"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { HelpCircle } from "lucide-react"

const faqs = [
  {
    question: "Is QuillGlow really free?",
    answer:
      "Yes — the Scholar plan is free forever. You get core study tools and monthly AI allowances. Current allowances for each plan are shown on the pricing page and in Settings → Plan & usage. The Genius plan includes higher AI allowances under fair use. See the pricing page for current billing options; existing subscriptions keep their agreed rate while they continue.",
  },
  {
    question: "What is StudyPilot?",
    answer:
      "StudyPilot builds your complete study system in one run: personalised revision notes, flashcards, practice exam, curated YouTube videos, a review schedule, and personalised weakness insights. Each plan's current monthly run allowance is shown on the pricing page and in Settings → Plan & usage.",
  },
  {
    question: "What is EchoMind?",
    answer:
      "EchoMind is an AI reflection companion that helps you truly own what you have studied. Choose a mode: Explain From My Knowledge (you teach the topic back, EchoMind gives feedback), Where I Was Confused (targeted re-explanation for tricky bits), or Future Me — Mastered (visualise yourself as an expert). EchoMind pulls in your real data — exam scores, flashcards, notes — so its feedback is personal, not generic.",
  },
  {
    question: "What AI models power QuillGlow?",
    answer:
      "QuillGlow uses Groq's ultra-fast llama-3.3-70b-versatile model for all AI features — StudyPilot, EchoMind, the multi-source tutor, exam generator, and more. This gives you high-quality, nuanced responses in seconds rather than minutes.",
  },
  {
    question: "How does the personalisation work?",
    answer:
      "When you enable 'Use my past data', QuillGlow reads your actual study history — your tutor conversation memory, past mock exam scores, flashcard decks, EchoMind sessions, and notes — and feeds that context into the AI. This means StudyPilot prioritises your real weak spots, not generic ones.",
  },
  {
    question: "Can I study with friends?",
    answer:
      "Yes — Study Together lets you create private rooms with invite codes, join community channels, share images, and chat with Quilly the AI assistant. It is a live study group that never cancels.",
  },
  {
    question: "Does it work on mobile?",
    answer:
      "QuillGlow is fully responsive and works on any device — phone, tablet, or desktop. Your notes, flashcards, and sessions sync seamlessly.",
  },
  {
    question: "How do I upgrade to Genius?",
    answer:
      "Head to /upgrade or /pricing for current monthly and annual offers. Genius includes higher per-feature AI allowances under fair use. You can cancel renewal; access continues through the paid billing period.",
  },
]

export function FAQSection() {
  return (
    <section className="relative py-28 md:py-36 bg-[#FFFDF7]">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="mb-16 text-center"
        >
          <span className="mb-4 inline-flex items-center gap-2 rounded-full bg-[#EDE9FF] px-4 py-1.5 text-sm font-700 text-[#7C3AED]">
            <HelpCircle className="h-4 w-4" /> FAQ
          </span>
          <h2 className="mt-4 text-4xl font-900 tracking-tight text-[#1C1917] sm:text-5xl text-balance">
            Questions?{" "}
            <span className="text-gradient-qg">We got you.</span>
          </h2>
        </motion.div>

        {/* Accordion */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.15 }}
        >
          <Accordion type="single" collapsible className="space-y-3">
            {faqs.map((faq, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -16 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.05 }}
              >
                <AccordionItem
                  value={`faq-${i}`}
                  className="overflow-hidden rounded-2xl border-2 border-[#E9E4FF] bg-white px-6 transition-colors duration-200 hover:border-[#7C3AED]/30"
                >
                  <AccordionTrigger className="py-5 text-left text-base font-700 text-[#1C1917] hover:no-underline [&[data-state=open]]:text-[#7C3AED]">
                    {faq.question}
                  </AccordionTrigger>
                  <AccordionContent className="pb-5 text-sm leading-relaxed text-[#6B7280]">
                    {faq.answer}
                  </AccordionContent>
                </AccordionItem>
              </motion.div>
            ))}
          </Accordion>
        </motion.div>
      </div>

      {/* JSON-LD FAQ schema */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: faqs.map((f) => ({
              "@type": "Question",
              name: f.question,
              acceptedAnswer: { "@type": "Answer", text: f.answer },
            })),
          }),
        }}
      />
    </section>
  )
}

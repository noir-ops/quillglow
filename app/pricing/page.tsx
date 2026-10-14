import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Check, Sparkles, Zap } from "lucide-react"
import Link from "next/link"
import Header from "@/components/header"
import Footer from "@/components/footer"
import { PLAN_DETAILS } from "@/lib/types/subscription"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Pricing - QuillGlow Study App Plans | Free & Premium Options",
  description:
    "Choose the perfect QuillGlow plan for your study needs. Start free with Scholar plan or upgrade to Genius for higher limits on every AI study tool, quizzes, and features.",
  keywords: [
    "quillglow pricing",
    "study app pricing",
    "student app plans",
    "free study app",
    "premium study tools",
    "student subscription plans",
  ],
  openGraph: {
    title: "Pricing - QuillGlow Study App Plans",
    description: "Start free or upgrade for higher limits. Choose the perfect plan for your study needs.",
    url: "https://www.quillglow.com/pricing",
    type: "website",
  },
  alternates: {
    canonical: "https://www.quillglow.com/pricing",
  },
}

export default function PricingPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1 py-12 md:py-24 px-4">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12 md:mb-16">
            <h1 className="text-3xl md:text-5xl font-bold mb-4">Choose Your Plan</h1>
            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
              Start with Scholar for free, or upgrade to Genius for higher limits on every AI tool
            </p>
          </div>

          {/* Pricing Cards */}
          <div className="grid md:grid-cols-2 gap-6 md:gap-8 max-w-4xl mx-auto">
            {/* Scholar Plan */}
            <Card className="relative">
              <CardHeader>
                <CardTitle className="text-2xl">{PLAN_DETAILS.scholar.name}</CardTitle>
                <CardDescription>{PLAN_DETAILS.scholar.description}</CardDescription>
                <div className="mt-4">
                  <span className="text-4xl font-bold">$0</span>
                  <span className="text-muted-foreground">/month</span>
                </div>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  {PLAN_DETAILS.scholar.features.map((feature, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <Check className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                      <span className="text-sm">{feature}</span>
                    </li>
                  ))}
                  {/* AI Features divider */}
                  <li className="pt-1 mt-1">
                    <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">AI Features</p>
                  </li>
                  <li className="flex items-start gap-2">
                    <Sparkles className="h-5 w-5 text-indigo-500 flex-shrink-0 mt-0.5" />
                    <span className="text-sm">
                      <span className="font-semibold text-indigo-600 dark:text-indigo-400">EchoMind</span>
                      {" — "}
                      <span className="text-muted-foreground">3 sessions per 30 days</span>
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Sparkles className="h-5 w-5 text-violet-500 flex-shrink-0 mt-0.5" />
                    <span className="text-sm">
                      <span className="font-semibold text-violet-600 dark:text-violet-400">WriteReal</span>
                      {" — "}
                      <span className="text-muted-foreground">10 AI checks + 3 each of grammar, humanize and paraphrase a month</span>
                    </span>
                  </li>
                </ul>
              </CardContent>
              <CardFooter>
                <Button asChild className="w-full bg-transparent" variant="outline">
                  <Link href="/auth/signup">Get Started</Link>
                </Button>
              </CardFooter>
            </Card>

            {/* Genius Plan */}
            <Card className="relative border-primary shadow-lg">
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground px-4 py-1 rounded-full text-sm font-medium">
                Most Popular
              </div>
              <CardHeader>
                <CardTitle className="text-2xl">{PLAN_DETAILS.genius.name}</CardTitle>
                <CardDescription>{PLAN_DETAILS.genius.description}</CardDescription>
                <div className="mt-4">
                  <span className="text-4xl font-bold">${PLAN_DETAILS.genius.price}</span>
                  <span className="text-muted-foreground">/month</span>
                </div>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  {PLAN_DETAILS.genius.features.map((feature, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <Check className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                      <span className="text-sm">{feature}</span>
                    </li>
                  ))}
                  {/* AI Features divider */}
                  <li className="pt-1 mt-1">
                    <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">AI Features</p>
                  </li>
                  <li className="flex items-start gap-2">
                    <Sparkles className="h-5 w-5 text-indigo-500 flex-shrink-0 mt-0.5" />
                    <span className="text-sm">
                      <span className="font-semibold text-indigo-600 dark:text-indigo-400">EchoMind</span>
                      {" — "}
                      <span className="font-medium">Up to 300 sessions a month (fair use)</span>
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Zap className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                    <span className="text-sm">
                      <span className="font-semibold">StudyPilot</span>
                      {" — "}
                      <span className="font-medium">Up to 100 runs a month, with deeper output</span>
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Sparkles className="h-5 w-5 text-violet-500 flex-shrink-0 mt-0.5" />
                    <span className="text-sm">
                      <span className="font-semibold text-violet-600 dark:text-violet-400">WriteReal</span>
                      {" — "}
                      <span className="font-medium">Up to 500 uses of each mode a month (fair use)</span>
                    </span>
                  </li>
                </ul>
              </CardContent>
              <CardFooter>
                <Button asChild className="w-full">
                  <Link href="/auth/signup">Start Free Trial</Link>
                </Button>
              </CardFooter>
            </Card>
          </div>

          {/* FAQ Section */}
          <div className="mt-16 md:mt-24 max-w-3xl mx-auto">
            <h2 className="text-2xl md:text-3xl font-bold text-center mb-8">Frequently Asked Questions</h2>
            <div className="space-y-6">
              <div>
                <h3 className="font-semibold mb-2">Can I switch plans anytime?</h3>
                <p className="text-muted-foreground text-sm">
                  Yes! You can upgrade from Scholar to Genius at any time. Your new features will be available
                  immediately.
                </p>
              </div>
              <div>
                <h3 className="font-semibold mb-2">What happens when I reach my limits?</h3>
                <p className="text-muted-foreground text-sm">
                  Each AI tool has its own monthly allowance, shown in Settings → Plan &amp; usage. When you reach one, you
                  can upgrade to Genius for much higher limits, or wait for it to reset on the 1st.
                </p>
              </div>
              <div>
                <h3 className="font-semibold mb-2">Is there a free trial?</h3>
                <p className="text-muted-foreground text-sm">
                  The Scholar plan is completely free forever. You can try all basic features without a credit card.
                </p>
              </div>
              <div>
                <h3 className="font-semibold mb-2 flex items-center gap-2">
                  <Zap className="h-4 w-4 text-primary" />
                  What is StudyPilot?
                </h3>
                <p className="text-muted-foreground text-sm">
                  StudyPilot is QuillGlow&apos;s flagship tool that
                  generates a complete personalised study system in a single run — study plan, revision notes, mind map,
                  practice exam, YouTube videos, and a smart review schedule. It integrates your exam scores, flashcards, and
                  notes for deeply personal output. Scholar includes <span className="font-medium text-foreground">1 full run a month</span>; Genius
                  includes up to 100 runs a month with deeper output (more exam questions and videos).
                </p>
              </div>
              <div>
                <h3 className="font-semibold mb-2 flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-violet-500" />
                  How does WriteReal work on each plan?
                </h3>
                <p className="text-muted-foreground text-sm">
                  WriteReal first detects whether your text reads as AI-generated, then rewrites it through a 3-pass pipeline to make it genuinely human — adjusting sentence burstiness, removing AI-typical phrases, and injecting natural voice. On Scholar you get{" "}
                  <span className="font-medium text-foreground">10 AI checks and 3 each of grammar, humanize and paraphrase a month</span>; on{" "}
                  <span className="font-medium text-foreground">Genius, up to 500 of each (fair use)</span>. Limits reset on the 1st of each month.
                </p>
              </div>
              <div>
                <h3 className="font-semibold mb-2 flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-indigo-500" />
                  How does EchoMind work on each plan?
                </h3>
                <p className="text-muted-foreground text-sm">
                  EchoMind is QuillGlow&apos;s flagship AI reflection companion. Scholar (free) users receive{" "}
                  <span className="font-medium text-foreground">3 EchoMind sessions a month</span>, resetting on the 1st.
                  Genius subscribers get{" "}
                  <span className="font-medium text-foreground">up to 300 sessions a month (fair use)</span>. Continuing a
                  previous session does not count against your limit.
                </p>
              </div>
            </div>
          </div>
        </div>

        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Product",
              name: "QuillGlow Study App",
              description: "AI-powered study app with smart note-taking, quiz generation, and productivity tools",
              offers: [
                {
                  "@type": "Offer",
                  name: "Scholar Plan",
                  price: "0",
                  priceCurrency: "USD",
                  availability: "https://schema.org/InStock",
                  url: "https://www.quillglow.com/pricing",
                },
                {
                  "@type": "Offer",
                  name: "Genius Plan",
                  price: PLAN_DETAILS.genius.price.toString(),
                  priceCurrency: "USD",
                  availability: "https://schema.org/InStock",
                  url: "https://www.quillglow.com/pricing",
                },
              ],
            }),
          }}
        />
      </main>

      <Footer />
    </div>
  )
}

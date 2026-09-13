import { Header } from "@/components/header"
import { HeroSection } from "@/components/hero-section"
import { MarqueeStrip } from "@/components/marquee-strip"
import { ChaosToClarity } from "@/components/chaos-to-clarity"
import { StudyAgentPromo } from "@/components/student-agent-promo"
import { FeaturesSection } from "@/components/features-section"
import { DreamEnvironment } from "@/components/dream-environment"
import { YouAreNotAlone } from "@/components/you-are-not-alone"
import { TestimonialsSection } from "@/components/testimonials-section"
import { AudienceSection } from "@/components/audience-section"
import { HowItWorksSection } from "@/components/how-it-works-section"
import { SproutAISection } from "@/components/sprout-ai-section"
import { CTASection } from "@/components/cta-section"
import { Footer } from "@/components/footer"
import { DiscordBannerPopup } from "@/components/discord-banner-popup"

export default function Home() {
  return (
    <main className="relative overflow-hidden bg-[#FFFDF7]">
      <DiscordBannerPopup />
      <Header />
      <HeroSection />
      <MarqueeStrip />
      <ChaosToClarity />
      <HowItWorksSection />
      <FeaturesSection />
      <StudyAgentPromo />
      <YouAreNotAlone />
      <SproutAISection />
      <DreamEnvironment />
      <AudienceSection />
      <CTASection />
      <TestimonialsSection />
      <Footer />
    </main>
  )
}
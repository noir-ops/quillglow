import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { Sparkles, Target, Users, Zap } from "lucide-react"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "About QuillGlow - AI-Powered Study App for Students",
  description:
    "Learn about QuillGlow's mission to help students study smarter with AI-powered tools including smart note-taking, quiz generation, study timer, and stress relief features.",
  keywords: [
    "about quillglow",
    "student study app",
    "AI study tools",
    "educational technology",
    "student productivity platform",
  ],
  openGraph: {
    title: "About QuillGlow - AI-Powered Study App for Students",
    description: "Learn about QuillGlow's mission to help students study smarter with AI-powered tools.",
    url: "https://www.quillglow.com/about",
    type: "website",
  },
  alternates: {
    canonical: "https://www.quillglow.com/about",
  },
}

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="pt-24 pb-16">
        {/* Hero Section */}
        <section className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-foreground mb-6">About QuillGlow</h1>
            <p className="text-lg sm:text-xl text-muted-foreground leading-relaxed max-w-3xl mx-auto">
              We're on a mission to transform how students learn, organize, and achieve their academic goals through
              intelligent study tools.
            </p>
          </div>

          {/* Mission Section */}
          <div className="mb-16 rounded-2xl border bg-card p-8 sm:p-12">
            <div className="flex items-center gap-3 mb-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary">
                <Target className="h-6 w-6 text-primary-foreground" />
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold text-foreground">Our Mission</h2>
            </div>
            <p className="text-base sm:text-lg text-muted-foreground leading-relaxed mb-4">
              QuillGlow was created to address the challenges students face in managing their study time effectively. We
              believe that with the right tools and AI-powered assistance, every student can achieve their full
              potential.
            </p>
            <p className="text-base sm:text-lg text-muted-foreground leading-relaxed">
              Our platform combines proven study techniques with modern AI technology to create a comprehensive learning
              ecosystem that adapts to each student's unique needs. From smart note-taking to automated quiz generation,
              we provide the tools students need to succeed.
            </p>
          </div>

          {/* Values Section */}
          <div className="mb-16">
            <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-8 text-center">Our Values</h2>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              <div className="rounded-xl border bg-card p-6">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                  <Sparkles className="h-6 w-6 text-primary" />
                </div>
                <h3 className="mb-2 text-lg font-semibold text-foreground">Innovation</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  We leverage cutting-edge AI technology to provide intelligent study assistance and personalized
                  learning experiences.
                </p>
              </div>

              <div className="rounded-xl border bg-card p-6">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                  <Users className="h-6 w-6 text-primary" />
                </div>
                <h3 className="mb-2 text-lg font-semibold text-foreground">Student-Centric</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Every feature is designed with students in mind, focusing on real needs and practical solutions for
                  academic success.
                </p>
              </div>

              <div className="rounded-xl border bg-card p-6">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                  <Zap className="h-6 w-6 text-primary" />
                </div>
                <h3 className="mb-2 text-lg font-semibold text-foreground">Efficiency</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  We help students maximize their study time with smart planning, progress tracking, and data-driven
                  insights.
                </p>
              </div>
            </div>
          </div>

          {/* Story Section */}
          <div className="rounded-2xl border bg-card p-8 sm:p-12">
            <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-6">Our Story</h2>
            <div className="space-y-4 text-base sm:text-lg text-muted-foreground leading-relaxed">
              <p>
                QuillGlow was born from the firsthand experience of struggling with academic organization and time
                management. We recognized that students needed more than just note-taking apps or simple to-do lists.
              </p>
              <p>
                By combining AI-powered features like automated quiz generation, smart note-taking with AI summaries,
                and stress relief tools with proven study methodologies, we've created a platform that truly understands
                and supports the modern student's journey.
              </p>
              <p>
                Today, QuillGlow helps students organize their notes, master their subjects through AI-generated
                quizzes, track their progress with detailed analytics, and maintain their mental health with our stress
                relief features.
              </p>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  )
}

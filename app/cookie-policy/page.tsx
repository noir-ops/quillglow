import { Header } from "@/components/header"
import { Footer } from "@/components/footer"

export default function CookiePolicyPage() {
  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="pt-24 pb-16">
        <article className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <h1 className="text-4xl sm:text-5xl font-bold text-foreground mb-4">Cookie Policy</h1>
          <p className="text-sm text-muted-foreground mb-12">Last updated: October 16, 2025</p>

          <div className="prose prose-slate dark:prose-invert max-w-none">
            <section className="mb-8">
              <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-4">What Are Cookies</h2>
              <p className="text-base text-muted-foreground leading-relaxed mb-4">
                Cookies are small text files that are placed on your device when you visit our website. They help us
                provide you with a better experience by remembering your preferences and understanding how you use our
                service.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-4">How We Use Cookies</h2>
              <p className="text-base text-muted-foreground leading-relaxed mb-4">
                QuillGlow uses cookies for the following purposes:
              </p>

              <h3 className="text-xl font-semibold text-foreground mb-3">Essential Cookies</h3>
              <p className="text-base text-muted-foreground leading-relaxed mb-4">
                These cookies are necessary for the website to function properly. They enable core functionality such
                as:
              </p>
              <ul className="list-disc list-inside space-y-2 text-base text-muted-foreground mb-4">
                <li>Authentication and account access</li>
                <li>Security features</li>
                <li>Session management</li>
                <li>Load balancing</li>
              </ul>

              <h3 className="text-xl font-semibold text-foreground mb-3">Functional Cookies</h3>
              <p className="text-base text-muted-foreground leading-relaxed mb-4">
                These cookies allow us to remember your preferences and provide enhanced features:
              </p>
              <ul className="list-disc list-inside space-y-2 text-base text-muted-foreground mb-4">
                <li>Theme preferences (light/dark mode)</li>
                <li>Language settings</li>
                <li>Dashboard layout preferences</li>
                <li>Recently accessed content</li>
              </ul>

              <h3 className="text-xl font-semibold text-foreground mb-3">Analytics Cookies</h3>
              <p className="text-base text-muted-foreground leading-relaxed mb-4">
                These cookies help us understand how visitors interact with our website:
              </p>
              <ul className="list-disc list-inside space-y-2 text-base text-muted-foreground mb-4">
                <li>Pages visited and features used</li>
                <li>Time spent on the platform</li>
                <li>Navigation patterns</li>
                <li>Error tracking and performance monitoring</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-4">Third-Party Cookies</h2>
              <p className="text-base text-muted-foreground leading-relaxed mb-4">
                We use third-party services that may set their own cookies:
              </p>
              <ul className="list-disc list-inside space-y-2 text-base text-muted-foreground mb-4">
                <li>
                  <strong>Supabase:</strong> For authentication and database services
                </li>
                <li>
                  <strong>Google Gemini AI:</strong> For AI-powered features
                </li>
                <li>
                  <strong>Deepgram:</strong> For voice-to-text transcription
                </li>
              </ul>
              <p className="text-base text-muted-foreground leading-relaxed mb-4">
                These third parties have their own privacy policies and cookie policies.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-4">Managing Cookies</h2>
              <p className="text-base text-muted-foreground leading-relaxed mb-4">
                You can control and manage cookies in several ways:
              </p>

              <h3 className="text-xl font-semibold text-foreground mb-3">Browser Settings</h3>
              <p className="text-base text-muted-foreground leading-relaxed mb-4">
                Most browsers allow you to refuse or accept cookies. You can usually find these settings in your
                browser's "Options" or "Preferences" menu. Note that disabling cookies may affect the functionality of
                QuillGlow.
              </p>

              <h3 className="text-xl font-semibold text-foreground mb-3">Cookie Duration</h3>
              <p className="text-base text-muted-foreground leading-relaxed mb-4">
                We use both session cookies (which expire when you close your browser) and persistent cookies (which
                remain on your device for a set period or until you delete them).
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-4">Updates to This Policy</h2>
              <p className="text-base text-muted-foreground leading-relaxed mb-4">
                We may update this Cookie Policy from time to time. We will notify you of any changes by posting the new
                policy on this page and updating the "Last updated" date.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-4">Contact Us</h2>
              <p className="text-base text-muted-foreground leading-relaxed">
                If you have questions about our use of cookies, please contact us at{" "}
                <a href="mailto:legal@quillglow.com" className="text-primary hover:underline">
                  legal@quillglow.com
                </a>
              </p>
            </section>
          </div>
        </article>
      </main>

      <Footer />
    </div>
  )
}

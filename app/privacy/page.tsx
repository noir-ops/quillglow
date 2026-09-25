import { Header } from "@/components/header"
import { Footer } from "@/components/footer"

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="pt-24 pb-16">
        <article className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <h1 className="text-4xl sm:text-5xl font-bold text-foreground mb-4">Privacy Policy</h1>
          <p className="text-sm text-muted-foreground mb-12">Last updated: March 4, 2026</p>

          <div className="prose prose-slate dark:prose-invert max-w-none">
            <section className="mb-8">
              <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-4">Introduction</h2>
              <p className="text-base text-muted-foreground leading-relaxed mb-4">
                At QuillGlow, your privacy is not an afterthought — it is a core principle. We believe your data
                belongs to you and only you. This Privacy Policy explains exactly what we collect, why we collect it,
                and what we will never do with it.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-4">Information We Collect</h2>
              <p className="text-base text-muted-foreground leading-relaxed mb-4">
                We collect only the minimum information required to create and maintain your account:
              </p>
              <ul className="list-disc list-inside space-y-2 text-base text-muted-foreground mb-4">
                <li>Your <strong className="text-foreground">name</strong></li>
                <li>Your <strong className="text-foreground">email address</strong></li>
                <li>Your <strong className="text-foreground">password</strong> — hashed 8 times before storage, making it virtually impossible to reverse-engineer even in the unlikely event of a breach</li>
              </ul>
              <p className="text-base text-muted-foreground leading-relaxed">
                That is it. Nothing else. We do not collect device information, browser type, IP addresses, location
                data, usage patterns, or any other form of telemetry.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-4">How We Use Your Information</h2>
              <p className="text-base text-muted-foreground leading-relaxed mb-4">
                Your information is used solely to:
              </p>
              <ul className="list-disc list-inside space-y-2 text-base text-muted-foreground mb-4">
                <li>Create and manage your QuillGlow account</li>
                <li>Authenticate you when you log in</li>
                <li>Send essential account-related communications (e.g. password resets)</li>
              </ul>
              <p className="text-base text-muted-foreground leading-relaxed">
                We will never use your data to train AI models, conduct analytics, serve advertising, or for any
                purpose beyond what is listed above.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-4">What We Will Never Do</h2>
              <p className="text-base text-muted-foreground leading-relaxed mb-4">
                We want to be completely transparent. QuillGlow will <strong className="text-foreground">never</strong>:
              </p>
              <ul className="list-disc list-inside space-y-2 text-base text-muted-foreground mb-4">
                <li>Sell, rent, or share your data with third parties</li>
                <li>Collect your IP address or track your location</li>
                <li>Use your data to train AI or machine learning models</li>
                <li>Track your behavior, usage patterns, or feature interactions</li>
                <li>Use your data for advertising or marketing profiling</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-4">Data Storage and Security</h2>
              <p className="text-base text-muted-foreground leading-relaxed mb-4">
                Your account data is stored securely. Passwords are hashed 8 times using a strong cryptographic
                algorithm before being stored, ensuring that even our own team cannot read them. We use Supabase for
                authentication and database management, which provides enterprise-grade security infrastructure.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-4">Your Data Belongs to You</h2>
              <p className="text-base text-muted-foreground leading-relaxed mb-4">
                100% of your data belongs to you. You have the right to:
              </p>
              <ul className="list-disc list-inside space-y-2 text-base text-muted-foreground mb-4">
                <li>Access any personal data we hold about you</li>
                <li>Correct inaccurate information</li>
                <li>Request permanent deletion of your account and all associated data</li>
                <li>Export your data at any time</li>
              </ul>
              <p className="text-base text-muted-foreground leading-relaxed">
                To exercise any of these rights, simply reach out to us and we will act promptly.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-4">Contact Us</h2>
              <p className="text-base text-muted-foreground leading-relaxed">
                If you have any questions about this Privacy Policy or how we handle your data, please contact us at{" "}
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

import { Header } from "@/components/header"
import { Footer } from "@/components/footer"

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="pt-24 pb-16">
        <article className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <h1 className="text-4xl sm:text-5xl font-bold text-foreground mb-4">Terms of Service</h1>
          <p className="text-sm text-muted-foreground mb-12">Last updated: October 16, 2025</p>

          <div className="prose prose-slate dark:prose-invert max-w-none">
            <section className="mb-8">
              <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-4">Agreement to Terms</h2>
              <p className="text-base text-muted-foreground leading-relaxed mb-4">
                By accessing or using QuillGlow, you agree to be bound by these Terms of Service. If you disagree with
                any part of these terms, you may not access the service.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-4">Use of Service</h2>
              <h3 className="text-xl font-semibold text-foreground mb-3">Eligibility</h3>
              <p className="text-base text-muted-foreground leading-relaxed mb-4">
                You must be at least 13 years old to use QuillGlow. By using the service, you represent that you meet
                this age requirement.
              </p>

              <h3 className="text-xl font-semibold text-foreground mb-3">Account Responsibilities</h3>
              <p className="text-base text-muted-foreground leading-relaxed mb-4">You are responsible for:</p>
              <ul className="list-disc list-inside space-y-2 text-base text-muted-foreground mb-4">
                <li>Maintaining the confidentiality of your account credentials</li>
                <li>All activities that occur under your account</li>
                <li>Notifying us immediately of any unauthorized access</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-4">Acceptable Use</h2>
              <p className="text-base text-muted-foreground leading-relaxed mb-4">You agree not to:</p>
              <ul className="list-disc list-inside space-y-2 text-base text-muted-foreground mb-4">
                <li>Use the service for any illegal purpose</li>
                <li>Violate any laws or regulations</li>
                <li>Infringe on intellectual property rights</li>
                <li>Transmit malicious code or viruses</li>
                <li>Attempt to gain unauthorized access to our systems</li>
                <li>Interfere with or disrupt the service</li>
                <li>Use automated systems to access the service without permission</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-4">Intellectual Property</h2>
              <p className="text-base text-muted-foreground leading-relaxed mb-4">
                The service and its original content, features, and functionality are owned by QuillGlow and are
                protected by international copyright, trademark, and other intellectual property laws.
              </p>
              <p className="text-base text-muted-foreground leading-relaxed mb-4">
                You retain ownership of the content you create (notes, flashcards, tasks). By using our service, you
                grant us a license to use this content to provide and improve our services.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-4">AI-Generated Content</h2>
              <p className="text-base text-muted-foreground leading-relaxed mb-4">
                QuillGlow uses AI to generate study plans, flashcards, and task suggestions. While we strive for
                accuracy, AI-generated content may contain errors. You are responsible for verifying the accuracy of
                AI-generated content before relying on it for academic purposes.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-4">Termination</h2>
              <p className="text-base text-muted-foreground leading-relaxed mb-4">
                We may terminate or suspend your account immediately, without prior notice, for any reason, including
                breach of these Terms. Upon termination, your right to use the service will immediately cease.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-4">Limitation of Liability</h2>
              <p className="text-base text-muted-foreground leading-relaxed mb-4">
                QuillGlow shall not be liable for any indirect, incidental, special, consequential, or punitive damages,
                including loss of data or profits, arising from your use of the service.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-4">Changes to Terms</h2>
              <p className="text-base text-muted-foreground leading-relaxed mb-4">
                We reserve the right to modify these terms at any time. We will notify users of any material changes.
                Your continued use of the service after changes constitutes acceptance of the new terms.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-4">Contact Us</h2>
              <p className="text-base text-muted-foreground leading-relaxed">
                If you have questions about these Terms, please contact us at{" "}
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

"use client"

import { useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { motion, AnimatePresence } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import {
  Smartphone,
  CheckCircle2,
  ArrowRight,
  Sparkles,
  Brain,
  Network,
  BookOpenCheck,
  Headphones,
  ChevronRight,
} from "lucide-react"
import { Footer } from "@/components/footer"
import { Header } from "@/components/header"

const FEATURES = [
  { icon: Brain, label: "AI Flashcards" },
  { icon: Network, label: "Mind Maps" },
  { icon: BookOpenCheck, label: "Revision Notes" },
  { icon: Headphones, label: "Audio Overview" },
]

export default function EarlyAccessPage() {
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [os, setOs] = useState("android")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [submitted, setSubmitted] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)

    try {
      const res = await fetch("/api/early-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, play_store_email: email, os }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || "Something went wrong.")
      } else {
        setSubmitted(true)
      }
    } catch {
      setError("Network error. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />

      <main className="pt-14">
        {/* Hero section */}
        <section className="relative overflow-hidden">
          {/* Background gradient */}
          <div className="absolute inset-0 -z-10">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] rounded-full bg-primary/8 blur-3xl" />
            <div className="absolute bottom-0 right-0 w-[400px] h-[400px] rounded-full bg-teal-500/6 blur-3xl" />
          </div>

          <div className="max-w-6xl mx-auto px-4 py-16 md:py-24 grid lg:grid-cols-2 gap-12 items-center">
            {/* Left — copy */}
            <div className="flex flex-col gap-6">
              <div className="inline-flex self-start items-center gap-2 rounded-full border border-primary/30 bg-primary/8 px-4 py-1.5">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                <span className="text-xs font-semibold text-primary uppercase tracking-wide">Android Early Access</span>
              </div>

              <h1 className="text-4xl md:text-5xl font-bold leading-tight tracking-tight text-balance">
                QuillGlow is coming
                <br />
                <span className="text-primary">to your phone.</span>
              </h1>

              <p className="text-lg text-muted-foreground leading-relaxed max-w-lg">
                Be the first to experience AI-powered studying on Android. Get exclusive early access before the public launch — flashcards, mind maps, revision notes, and more, right in your pocket.
              </p>

              {/* Feature pills */}
              <div className="flex flex-wrap gap-2 mt-1">
                {FEATURES.map(({ icon: Icon, label }) => (
                  <span
                    key={label}
                    className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/50 px-3 py-1 text-xs font-medium text-muted-foreground"
                  >
                    <Icon className="h-3.5 w-3.5 text-primary" />
                    {label}
                  </span>
                ))}
              </div>
            </div>

            {/* Right — phone mockup */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              className="flex justify-center lg:justify-end"
            >
              <div className="relative">
                <div className="absolute -inset-8 rounded-full bg-primary/10 blur-3xl" />
                <Image
                  src="/mobile.png"
                  alt="QuillGlow Android app preview"
                  width={380}
                  height={500}
                  className="relative rounded-3xl shadow-2xl object-cover max-h-[460px] w-auto"
                  priority
                />
              </div>
            </motion.div>
          </div>
        </section>

        {/* Form section */}
        <section className="max-w-6xl mx-auto px-4 pb-24">
          <div className="max-w-lg mx-auto lg:mx-0">
            <AnimatePresence mode="wait">
              {submitted ? (
                <motion.div
                  key="success"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.4 }}
                  className="rounded-2xl border border-border bg-card p-8 shadow-sm flex flex-col items-center gap-5 text-center"
                >
                  <div className="h-16 w-16 rounded-full bg-green-500/10 flex items-center justify-center">
                    <CheckCircle2 className="h-8 w-8 text-green-500" />
                  </div>
                  <div className="space-y-2">
                    <h2 className="text-2xl font-bold">You're on the list!</h2>
                    <p className="text-muted-foreground leading-relaxed">
                      Thanks, <span className="text-foreground font-medium">{name}</span>. We'll send an invite to{" "}
                      <span className="text-foreground font-medium">{email}</span> via your Play Store account as soon as Android access opens.
                    </p>
                  </div>
                  <div className="w-full border-t border-border pt-5">
                    <p className="text-sm text-muted-foreground mb-3">In the meantime, use the web app:</p>
                    <Link href="/dashboard">
                      <Button className="w-full gap-2">
                        Open QuillGlow Web <ArrowRight className="h-4 w-4" />
                      </Button>
                    </Link>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="form"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.5 }}
                  className="rounded-2xl border border-border bg-card p-8 shadow-sm"
                >
                  <div className="flex items-center gap-3 mb-6">
                    <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                      <Smartphone className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold">Request Early Access</h2>
                      <p className="text-sm text-muted-foreground">Fill in your details below to join the waitlist.</p>
                    </div>
                  </div>

                  <form onSubmit={handleSubmit} className="space-y-5">
                    {/* Name */}
                    <div className="space-y-1.5">
                      <Label htmlFor="name">Full Name</Label>
                      <Input
                        id="name"
                        type="text"
                        placeholder="e.g. Alex Johnson"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        required
                        disabled={loading}
                        className="h-11"
                      />
                    </div>

                    {/* Email */}
                    <div className="space-y-1.5">
                      <Label htmlFor="email">Play Store Email</Label>
                      <Input
                        id="email"
                        type="email"
                        placeholder="e.g. yourname@gmail.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        disabled={loading}
                        className="h-11"
                      />
                      <p className="text-xs text-muted-foreground">
                        This must be the Gmail account linked to your Google Play Store so we can grant you access.
                      </p>
                    </div>

                    {/* OS */}
                    <div className="space-y-2">
                      <Label>Primary Phone Operating System</Label>
                      <RadioGroup
                        value={os}
                        onValueChange={setOs}
                        className="grid grid-cols-2 gap-3"
                        disabled={loading}
                      >
                        {[
                          { value: "android", label: "Android", available: true },
                          { value: "ios", label: "iOS (iPhone)", available: false },
                        ].map(({ value, label, available }) => (
                          <Label
                            key={value}
                            htmlFor={value}
                            className={`relative flex flex-col gap-1 rounded-xl border-2 p-4 cursor-pointer transition-all ${
                              os === value
                                ? "border-primary bg-primary/5"
                                : "border-border bg-muted/30 hover:border-border/80"
                            } ${!available ? "opacity-60 cursor-not-allowed" : ""}`}
                          >
                            <div className="flex items-center gap-2">
                              <RadioGroupItem
                                value={value}
                                id={value}
                                disabled={!available}
                                className="sr-only"
                              />
                              <div className={`h-4 w-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                                os === value ? "border-primary" : "border-muted-foreground"
                              }`}>
                                {os === value && <div className="h-2 w-2 rounded-full bg-primary" />}
                              </div>
                              <span className="font-medium text-sm">{label}</span>
                            </div>
                            {!available && (
                              <span className="text-xs text-muted-foreground">Coming soon</span>
                            )}
                            {available && (
                              <span className="text-xs text-muted-foreground">Available now</span>
                            )}
                          </Label>
                        ))}
                      </RadioGroup>
                      {os === "ios" && (
                        <p className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2">
                          iOS support is coming soon. We'll notify you when it's available!
                        </p>
                      )}
                    </div>

                    {/* Error */}
                    {error && (
                      <p className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2">
                        {error}
                      </p>
                    )}

                    {/* Submit */}
                    <Button
                      type="submit"
                      className="w-full h-11 gap-2 font-semibold"
                      disabled={loading}
                    >
                      {loading ? (
                        <>
                          <span className="h-4 w-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
                          Submitting...
                        </>
                      ) : (
                        <>
                          Get Early Access
                          <ArrowRight className="h-4 w-4" />
                        </>
                      )}
                    </Button>

                    <p className="text-xs text-center text-muted-foreground">
                      We only use your email to invite you to the Android beta. No spam, ever.
                    </p>
                  </form>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  )
}

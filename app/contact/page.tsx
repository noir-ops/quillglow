"use client"

import type React from "react"

import { useState } from "react"
import { motion } from "framer-motion"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Card } from "@/components/ui/card"
import { Mail, MessageSquare, Clock, CheckCircle2, Loader2 } from "lucide-react"

export default function ContactPage() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    subject: "",
    message: "",
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitStatus, setSubmitStatus] = useState<{
    type: "success" | "error" | null
    message: string
    ticketNumber?: string
  }>({ type: null, message: "" })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setSubmitStatus({ type: null, message: "" })

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      })

      const data = await response.json()

      if (response.ok) {
        setSubmitStatus({
          type: "success",
          message: data.message,
          ticketNumber: data.ticketNumber,
        })
        setFormData({ name: "", email: "", subject: "", message: "" })
      } else {
        setSubmitStatus({
          type: "error",
          message: data.error || "Failed to submit form",
        })
      }
    } catch (error) {
      setSubmitStatus({
        type: "error",
        message: "Network error. Please try again.",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-background to-muted/20">
      <Header />

      <main className="flex-1 container mx-auto px-4 py-12 md:py-20">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12">
            <h1 className="text-4xl md:text-5xl font-bold mb-4">
              Get in <span className="text-primary">Touch</span>
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Have questions or feedback? We'd love to hear from you. Send us a message and we'll respond as soon as
              possible.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 mb-12">
            {/* Contact Info Cards */}
            <Card className="p-6 text-center">
              <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <Mail className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-semibold mb-2">Email Us</h3>
              <p className="text-sm text-muted-foreground">support@quillglow.com</p>
            </Card>

            <Card className="p-6 text-center">
              <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <Clock className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-semibold mb-2">Response Time</h3>
              <p className="text-sm text-muted-foreground">Within 24-48 hours</p>
            </Card>

            <Card className="p-6 text-center">
              <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <MessageSquare className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-semibold mb-2">Ticket System</h3>
              <p className="text-sm text-muted-foreground">Track your inquiry</p>
            <Button
              className="mt-4 w-full border-2 border-blue-400 cursor-pointer"
              variant="secondary"
              onClick={() => window.location.href = "/support"}
              
            >
              My Ticket
            </Button>
            </Card>
          </div>

          {/* Contact Form */}
          <Card className="p-6 md:p-8">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="name">Full Name *</Label>
                  <Input
                    id="name"
                    placeholder="John Doe"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                    disabled={isSubmitting}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email Address *</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="john@example.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    required
                    disabled={isSubmitting}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="subject">Subject *</Label>
                <Input
                  id="subject"
                  placeholder="How can we help you?"
                  value={formData.subject}
                  onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                  required
                  disabled={isSubmitting}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="message">Message *</Label>
                <Textarea
                  id="message"
                  placeholder="Tell us more about your inquiry..."
                  rows={6}
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  required
                  disabled={isSubmitting}
                  className="resize-none"
                />
              </div>

              {/* Status Messages */}
              {submitStatus.type === "success" && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg"
                >
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-medium text-green-500">Message Sent Successfully!</p>
                      <p className="text-sm text-muted-foreground mt-1">{submitStatus.message}</p>
                      {submitStatus.ticketNumber && (
                        <p className="text-sm font-mono mt-2 text-green-500">
                          Ticket Number: {submitStatus.ticketNumber}
                        </p>
                      )}
                    </div>
                  </div>
                </motion.div>
              )}

              {submitStatus.type === "error" && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg"
                >
                  <p className="text-sm text-red-500">{submitStatus.message}</p>
                </motion.div>
              )}

              <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Mail className="h-4 w-4 mr-2" />
                    Send Message
                  </>
                )}
              </Button>

              <p className="text-xs text-center text-muted-foreground">
                By submitting this form, you agree to our{" "}
                <a href="/privacy" className="text-primary hover:underline">
                  Privacy Policy
                </a>
                . We'll only use your information to respond to your inquiry.
              </p>
            </form>
          </Card>

          {/* FAQ Section */}
          <div className="mt-12 text-center">
            <h2 className="text-2xl font-bold mb-4">Frequently Asked Questions</h2>
            <p className="text-muted-foreground mb-6">
              Check out our{" "}
              <a href="/about" className="text-primary hover:underline">
                About page
              </a>{" "}
              for more information about QuillGlow and how it works.
            </p>
          </div>
        </motion.div>
      </main>

      <Footer />
    </div>
  )
}

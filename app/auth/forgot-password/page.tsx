"use client"

import type React from "react"

import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import Link from "next/link"
import { useState } from "react"
import { motion } from "framer-motion"
import { Mail, ArrowLeft } from "lucide-react"

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    const supabase = createClient()
    setIsLoading(true)
    setError(null)

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/reset-password`,
      })
      if (error) throw error
      setSuccess(true)
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : "An error occurred")
    } finally {
      setIsLoading(false)
    }
  }

  if (success) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center p-6 bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-md"
        >
          <Card className="border-2">
            <CardHeader className="space-y-4 text-center">
              <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
                <Mail className="w-8 h-8 text-primary" />
              </div>
              <CardTitle className="text-2xl font-bold">Check Your Email</CardTitle>
              <CardDescription>
                We've sent a password reset link to <strong>{email}</strong>. Click the link in the email to reset your
                password.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-center text-sm text-muted-foreground">
                Didn't receive the email? Check your spam folder or try again.
              </p>
              <Link href="/auth/login">
                <Button variant="outline" className="w-full bg-transparent">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Login
                </Button>
              </Link>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen w-full items-center justify-center p-6 bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        <Card className="border-2">
          <CardHeader className="space-y-1">
            <CardTitle className="text-3xl font-bold text-center">Forgot Password?</CardTitle>
            <CardDescription className="text-center">
              Enter your email address and we'll send you a link to reset your password
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleResetPassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="student@example.com"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-11"
                />
              </div>
              {error && (
                <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-sm text-red-500">
                  {error}
                </motion.p>
              )}
              <Button type="submit" className="w-full h-11 text-base" disabled={isLoading}>
                {isLoading ? "Sending..." : "Send Reset Link"}
              </Button>
              <Link href="/auth/login">
                <Button variant="ghost" className="w-full" type="button">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Login
                </Button>
              </Link>
            </form>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}

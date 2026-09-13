"use client"

import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { 
  Users, 
  Gift, 
  Award, 
  Share2, 
  CheckCircle, 
  Loader2,
  Copy,
  ExternalLink,
  GraduationCap,
  Sparkles,
  Trophy,
  Crown,
} from "lucide-react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"

const MILESTONES = [
  { count: 15, reward: "Genius Plan for 2 Months", icon: Gift, color: "text-blue-600 bg-blue-100" },
  { count: 50, reward: "Genius Plan 3 Months + Certificate", icon: Award, color: "text-purple-600 bg-purple-100" },
  { count: 100, reward: "Genius Plan 6 Months + Certificate", icon: Trophy, color: "text-amber-600 bg-amber-100" },
  { count: 500, reward: "Lifetime Genius + Certificate + Gift", icon: Crown, color: "text-rose-600 bg-rose-100" },
]

export default function AmbassadorPage() {
  const [user, setUser] = useState<any>(null)
  const [ambassador, setAmbassador] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState({
    name: "",
    email: "",
    university: "",
    country: "",
    message: "",
  })

  useEffect(() => {
    checkStatus()
  }, [])

  const checkStatus = async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    setUser(user)

    if (user) {
      setForm(prev => ({ ...prev, email: user.email || "" }))
      
      // Check if already ambassador
      const res = await fetch("/api/ambassador/register")
      const data = await res.json()
      if (data.ambassador) {
        setAmbassador(data.ambassador)
      }
    }
    setLoading(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) {
      toast.error("Please sign in to become an ambassador")
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch("/api/ambassador/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })
      
      const data = await res.json()
      
      if (!res.ok) {
        toast.error(data.error || "Failed to register")
        return
      }

      setAmbassador(data.ambassador)
      toast.success("Welcome to the Ambassador Program!")
    } catch (error) {
      toast.error("Something went wrong")
    } finally {
      setSubmitting(false)
    }
  }

  const copyLink = () => {
    if (ambassador?.referral_link) {
      navigator.clipboard.writeText(ambassador.referral_link)
      toast.success("Referral link copied!")
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-purple-50">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  // Already an ambassador - show success state
  if (ambassador) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 py-12 px-4">
        <div className="max-w-2xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Card className="border-2 border-green-200 bg-white/80 backdrop-blur">
              <CardHeader className="text-center pb-2">
                <div className="mx-auto w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mb-4">
                  <CheckCircle className="h-8 w-8 text-green-600" />
                </div>
                <CardTitle className="text-2xl">You are a QuillGlow Ambassador!</CardTitle>
                <CardDescription>Share your referral link to earn rewards</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="p-4 rounded-xl bg-gradient-to-r from-blue-50 to-purple-50 border">
                  <Label className="text-sm text-muted-foreground mb-2 block">Your Referral Link</Label>
                  <div className="flex gap-2">
                    <Input 
                      value={ambassador.referral_link} 
                      readOnly 
                      className="bg-white font-mono text-sm"
                    />
                    <Button variant="outline" size="icon" onClick={copyLink}>
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Referral Code: <span className="font-mono font-semibold">{ambassador.referral_code}</span>
                  </p>
                </div>

                <div className="flex gap-3">
                  <Link href="/ambassador/dashboard" className="flex-1">
                    <Button className="w-full" size="lg">
                      <Users className="h-4 w-4 mr-2" />
                      View Dashboard
                    </Button>
                  </Link>
                  <Link href="/ambassador/leaderboard" className="flex-1">
                    <Button variant="outline" className="w-full" size="lg">
                      <Trophy className="h-4 w-4 mr-2" />
                      Leaderboard
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      {/* Hero Section */}
      <section className="py-16 px-4">
        <div className="max-w-5xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <Badge className="bg-primary/10 text-primary border-primary/20 px-4 py-1.5">
              <Sparkles className="h-3.5 w-3.5 mr-1.5" />
              Campus Ambassador Program
            </Badge>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-foreground text-balance">
              Become a QuillGlow
              <span className="text-primary block">Campus Ambassador</span>
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto text-balance">
              Represent QuillGlow at your university, help fellow students succeed, and earn exclusive rewards including free Genius plans and certificates.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Milestones Section */}
      <section className="py-12 px-4 bg-white/50">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-8">Reward Milestones</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {MILESTONES.map((milestone, i) => (
              <motion.div
                key={milestone.count}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
              >
                <Card className="h-full border-2 hover:border-primary/30 transition-colors">
                  <CardContent className="pt-6 text-center">
                    <div className={`w-12 h-12 rounded-full ${milestone.color} flex items-center justify-center mx-auto mb-3`}>
                      <milestone.icon className="h-6 w-6" />
                    </div>
                    <div className="text-3xl font-bold text-foreground mb-1">{milestone.count}</div>
                    <div className="text-sm text-muted-foreground mb-2">Referrals</div>
                    <p className="text-sm font-medium text-foreground">{milestone.reward}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Registration Form */}
      <section className="py-16 px-4">
        <div className="max-w-xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card className="border-2">
              <CardHeader>
                <CardTitle className="text-2xl flex items-center gap-2">
                  <GraduationCap className="h-6 w-6 text-primary" />
                  Apply Now
                </CardTitle>
                <CardDescription>
                  {user ? "Fill in your details to become an ambassador" : "Sign in to apply for the ambassador program"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {!user ? (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground mb-4">You need to be signed in to apply</p>
                    <Link href="/auth/login">
                      <Button size="lg">
                        Sign In to Apply
                        <ExternalLink className="h-4 w-4 ml-2" />
                      </Button>
                    </Link>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Full Name *</Label>
                      <Input
                        id="name"
                        placeholder="Your full name"
                        value={form.name}
                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="email">Email Address *</Label>
                      <Input
                        id="email"
                        type="email"
                        placeholder="student@university.edu"
                        value={form.email}
                        onChange={(e) => setForm({ ...form, email: e.target.value })}
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="university">University / College *</Label>
                      <Input
                        id="university"
                        placeholder="Your university or college name"
                        value={form.university}
                        onChange={(e) => setForm({ ...form, university: e.target.value })}
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="country">Country *</Label>
                      <Input
                        id="country"
                        placeholder="Your country"
                        value={form.country}
                        onChange={(e) => setForm({ ...form, country: e.target.value })}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="message">Why do you want to be an ambassador? (Optional)</Label>
                      <Textarea
                        id="message"
                        placeholder="Tell us about yourself..."
                        value={form.message}
                        onChange={(e) => setForm({ ...form, message: e.target.value })}
                        rows={3}
                      />
                    </div>

                    <Button type="submit" className="w-full" size="lg" disabled={submitting}>
                      {submitting ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Submitting...
                        </>
                      ) : (
                        <>
                          <Share2 className="h-4 w-4 mr-2" />
                          Become an Ambassador
                        </>
                      )}
                    </Button>
                  </form>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </section>
    </div>
  )
}

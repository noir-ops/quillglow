"use client"

import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { 
  Users, 
  Gift, 
  Award, 
  Trophy,
  Crown,
  Copy,
  CheckCircle,
  Clock,
  Loader2,
  Share2,
  Download,
  ExternalLink,
  ArrowLeft,
} from "lucide-react"
import Link from "next/link"
import { toast } from "sonner"
import { format } from "date-fns"

const MILESTONES = [
  { count: 15, reward: "Genius Plan for 2 Months", icon: Gift, color: "bg-blue-500" },
  { count: 50, reward: "Genius 3 Months + Certificate", icon: Award, color: "bg-purple-500" },
  { count: 100, reward: "Genius 6 Months + Certificate", icon: Trophy, color: "bg-amber-500" },
  { count: 500, reward: "Lifetime Genius + Certificate + Gift", icon: Crown, color: "bg-rose-500" },
]

export default function AmbassadorDashboardPage() {
  const [stats, setStats] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchStats()
  }, [])

  const fetchStats = async () => {
    try {
      const res = await fetch("/api/ambassador/stats")
      const data = await res.json()
      
      if (res.ok) {
        setStats(data)
      } else {
        toast.error(data.error || "Failed to load stats")
      }
    } catch (error) {
      toast.error("Failed to load dashboard")
    } finally {
      setLoading(false)
    }
  }

  const copyLink = () => {
    if (stats?.ambassador?.referral_link) {
      navigator.clipboard.writeText(stats.ambassador.referral_link)
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

  if (!stats || !stats.ambassador) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-purple-50">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <p className="text-muted-foreground mb-4">You are not registered as an ambassador yet.</p>
            <Link href="/ambassador">
              <Button>Become an Ambassador</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  const { ambassador, referrals, rewards, certificates, currentTier, nextMilestone } = stats
  const verifiedCount = ambassador.verified_referrals || 0
  const totalCount = ambassador.total_referrals || 0
  const progressToNext = nextMilestone 
    ? Math.min(100, (verifiedCount / nextMilestone.count) * 100)
    : 100

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 py-8 px-4">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/ambassador">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold">Ambassador Dashboard</h1>
              <p className="text-muted-foreground">Welcome back, {ambassador.name}</p>
            </div>
          </div>
          <Link href="/ambassador/leaderboard">
            <Button variant="outline">
              <Trophy className="h-4 w-4 mr-2" />
              Leaderboard
            </Button>
          </Link>
        </div>

        {/* Referral Link Card */}
        <Card className="border-2 border-primary/20 bg-gradient-to-r from-primary/5 to-purple-500/5">
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row md:items-center gap-4">
              <div className="flex-1">
                <p className="text-sm text-muted-foreground mb-1">Your Referral Link</p>
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
              </div>
              <div className="flex gap-2">
                <Button onClick={copyLink}>
                  <Share2 className="h-4 w-4 mr-2" />
                  Share Link
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                  <Users className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{totalCount}</p>
                  <p className="text-sm text-muted-foreground">Total Referrals</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{verifiedCount}</p>
                  <p className="text-sm text-muted-foreground">Verified</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
                  <Clock className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{totalCount - verifiedCount}</p>
                  <p className="text-sm text-muted-foreground">Pending</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
                  <Award className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">Tier {currentTier}</p>
                  <p className="text-sm text-muted-foreground">Reward Level</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Progress to Next Milestone */}
        {nextMilestone && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Progress to Next Milestone</CardTitle>
              <CardDescription>
                {verifiedCount} / {nextMilestone.count} verified referrals
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Progress value={progressToNext} className="h-3 mb-3" />
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  {nextMilestone.count - verifiedCount} more to unlock
                </span>
                <Badge variant="outline">{nextMilestone.reward}</Badge>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Milestones Overview */}
        <Card>
          <CardHeader>
            <CardTitle>Reward Milestones</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {MILESTONES.map((milestone, i) => {
                const reached = verifiedCount >= milestone.count
                const Icon = milestone.icon
                return (
                  <div
                    key={milestone.count}
                    className={`p-4 rounded-xl border-2 text-center transition-all ${
                      reached 
                        ? "border-green-300 bg-green-50" 
                        : "border-border bg-muted/30"
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-full mx-auto mb-2 flex items-center justify-center ${
                      reached ? milestone.color + " text-white" : "bg-muted text-muted-foreground"
                    }`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <p className="text-xl font-bold">{milestone.count}</p>
                    <p className="text-xs text-muted-foreground mb-2">Referrals</p>
                    <p className="text-xs font-medium">{milestone.reward}</p>
                    {reached && (
                      <Badge className="mt-2 bg-green-500">Unlocked</Badge>
                    )}
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>

        {/* Tabs for Referrals, Rewards, Certificates */}
        <Tabs defaultValue="referrals">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="referrals">Referrals ({referrals.length})</TabsTrigger>
            <TabsTrigger value="rewards">Rewards ({rewards.length})</TabsTrigger>
            <TabsTrigger value="certificates">Certificates ({certificates.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="referrals">
            <Card>
              <CardContent className="pt-6">
                {referrals.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Users className="h-12 w-12 mx-auto mb-3 opacity-30" />
                    <p>No referrals yet. Share your link to get started!</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {referrals.map((ref: any) => (
                      <div key={ref.id} className="flex items-center justify-between p-3 rounded-lg border">
                        <div>
                          <p className="font-medium">{ref.referred_email || "User"}</p>
                          <p className="text-xs text-muted-foreground">
                            Referred on {format(new Date(ref.created_at), "MMM d, yyyy")}
                          </p>
                        </div>
                        <Badge variant={ref.status === "verified" ? "default" : "secondary"}>
                          {ref.status === "verified" ? (
                            <><CheckCircle className="h-3 w-3 mr-1" /> Verified</>
                          ) : (
                            <><Clock className="h-3 w-3 mr-1" /> Pending</>
                          )}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="rewards">
            <Card>
              <CardContent className="pt-6">
                {rewards.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Gift className="h-12 w-12 mx-auto mb-3 opacity-30" />
                    <p>No rewards earned yet. Keep inviting friends!</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {rewards.map((reward: any) => (
                      <div key={reward.id} className="flex items-center justify-between p-3 rounded-lg border bg-gradient-to-r from-amber-50 to-orange-50">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
                            <Gift className="h-5 w-5 text-amber-600" />
                          </div>
                          <div>
                            <p className="font-medium">{reward.reward_description}</p>
                            <p className="text-xs text-muted-foreground">
                              Milestone: {reward.milestone} referrals
                            </p>
                          </div>
                        </div>
                        <Badge className="bg-green-500">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Claimed
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="certificates">
            <Card>
              <CardContent className="pt-6">
                {certificates.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Award className="h-12 w-12 mx-auto mb-3 opacity-30" />
                    <p>Certificates are awarded at 50, 100, and 500 referrals</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {certificates.map((cert: any) => {
                      const certData = cert.certificateData || cert.certificate_data || {}
                      const uniqueId = certData.unique_id || cert.id
                      return (
                        <div key={cert.id} className="flex items-center justify-between p-4 rounded-lg border bg-gradient-to-r from-purple-50 to-pink-50">
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-lg bg-purple-100 flex items-center justify-center">
                              <Award className="h-6 w-6 text-purple-600" />
                            </div>
                            <div>
                              <p className="font-semibold">{certData.title || "Ambassador Certificate"}</p>
                              <p className="text-sm text-muted-foreground">
                                {cert.milestone} Referrals Milestone
                              </p>
                              <p className="text-xs text-muted-foreground font-mono">
                                ID: {uniqueId}
                              </p>
                            </div>
                          </div>
                          <Link href={`/ambassador/certificate/${uniqueId}`}>
                            <Button variant="outline" size="sm">
                              <ExternalLink className="h-4 w-4 mr-1" />
                              View
                            </Button>
                          </Link>
                        </div>
                      )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}

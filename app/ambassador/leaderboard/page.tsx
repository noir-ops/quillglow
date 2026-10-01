"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Loader2, Trophy, Users, TrendingUp, Medal, Crown, Award } from "lucide-react"
import { cn } from "@/lib/utils"
import Link from "next/link"

interface LeaderboardEntry {
  rank: number
  name: string
  institution: string
  referrals: number
  tier: string
}

const TIER_CONFIG: Record<string, { color: string; bg: string; icon: React.ReactNode }> = {
  starter: { color: "text-gray-600", bg: "bg-gray-100", icon: <Award className="h-4 w-4" /> },
  bronze: { color: "text-amber-700", bg: "bg-amber-100", icon: <Medal className="h-4 w-4" /> },
  silver: { color: "text-slate-600", bg: "bg-slate-200", icon: <Medal className="h-4 w-4" /> },
  gold: { color: "text-yellow-600", bg: "bg-yellow-100", icon: <Trophy className="h-4 w-4" /> },
  platinum: { color: "text-indigo-600", bg: "bg-indigo-100", icon: <Crown className="h-4 w-4" /> },
  diamond: { color: "text-cyan-600", bg: "bg-cyan-100", icon: <Crown className="h-4 w-4" /> },
}

export default function LeaderboardPage() {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [stats, setStats] = useState({ totalAmbassadors: 0, totalReferrals: 0 })
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState("all")

  useEffect(() => {
    fetchLeaderboard()
  }, [period])

  async function fetchLeaderboard() {
    setLoading(true)
    try {
      const res = await fetch(`/api/ambassador/leaderboard?period=${period}&limit=50`)
      const data = await res.json()
      setLeaderboard(data.leaderboard || [])
      setStats(data.stats || { totalAmbassadors: 0, totalReferrals: 0 })
    } catch (error) {
      console.error("Failed to fetch leaderboard:", error)
    } finally {
      setLoading(false)
    }
  }

  const top3 = leaderboard.slice(0, 3)
  const rest = leaderboard.slice(3)

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white">
        <div className="container mx-auto px-4 py-12 sm:py-16">
          <div className="text-center max-w-2xl mx-auto">
            <Badge className="bg-white/20 text-white mb-4">Ambassador Program</Badge>
            <h1 className="text-3xl sm:text-4xl font-bold">Leaderboard</h1>
            <p className="mt-3 text-indigo-100">
              Celebrating our top ambassadors who are spreading the word about QuillGlow
            </p>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-4 mt-8 max-w-md mx-auto">
            <Card className="bg-white/10 border-white/20 text-white">
              <CardContent className="p-4 text-center">
                <Users className="h-6 w-6 mx-auto mb-2 opacity-80" />
                <p className="text-2xl font-bold">{stats.totalAmbassadors}</p>
                <p className="text-xs text-indigo-200">Active Ambassadors</p>
              </CardContent>
            </Card>
            <Card className="bg-white/10 border-white/20 text-white">
              <CardContent className="p-4 text-center">
                <TrendingUp className="h-6 w-6 mx-auto mb-2 opacity-80" />
                <p className="text-2xl font-bold">{stats.totalReferrals}</p>
                <p className="text-xs text-indigo-200">Total Referrals</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        {/* Period Filter */}
        <div className="flex justify-center mb-8">
          <Tabs value={period} onValueChange={setPeriod}>
            <TabsList>
              <TabsTrigger value="all">All Time</TabsTrigger>
              <TabsTrigger value="month">This Month</TabsTrigger>
              <TabsTrigger value="week">This Week</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : leaderboard.length === 0 ? (
          <Card className="max-w-md mx-auto text-center py-12">
            <CardContent>
              <Trophy className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold">No ambassadors yet</h3>
              <p className="text-muted-foreground mt-2">Be the first to join our ambassador program!</p>
              <Link href="/ambassador">
                <Button className="mt-4">Become an Ambassador</Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Top 3 Podium */}
            <div className="grid grid-cols-3 gap-2 sm:gap-4 max-w-2xl mx-auto mb-8">
              {/* 2nd Place */}
              <div className="pt-8">
                {top3[1] && (
                  <Card className="border-slate-300 bg-gradient-to-b from-slate-50 to-white text-center">
                    <CardContent className="p-4">
                      <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-slate-200 flex items-center justify-center mx-auto mb-2 text-2xl sm:text-3xl font-bold text-slate-600">
                        2
                      </div>
                      <h3 className="font-semibold text-sm sm:text-base truncate">{top3[1].name}</h3>
                      <p className="text-xs text-muted-foreground truncate">{top3[1].institution}</p>
                      <Badge className={cn("mt-2", TIER_CONFIG[top3[1].tier]?.bg, TIER_CONFIG[top3[1].tier]?.color)}>
                        {top3[1].referrals} referrals
                      </Badge>
                    </CardContent>
                  </Card>
                )}
              </div>

              {/* 1st Place */}
              <div>
                {top3[0] && (
                  <Card className="border-yellow-400 border-2 bg-gradient-to-b from-yellow-50 to-white text-center shadow-lg">
                    <CardContent className="p-4">
                      <Crown className="h-6 w-6 sm:h-8 sm:w-8 mx-auto text-yellow-500 mb-2" />
                      <div className="w-14 h-14 sm:w-20 sm:h-20 rounded-full bg-gradient-to-br from-yellow-400 to-amber-500 flex items-center justify-center mx-auto mb-2 text-3xl sm:text-4xl font-bold text-white shadow-md">
                        1
                      </div>
                      <h3 className="font-bold text-sm sm:text-lg truncate">{top3[0].name}</h3>
                      <p className="text-xs text-muted-foreground truncate">{top3[0].institution}</p>
                      <Badge className="mt-2 bg-yellow-500 text-white">
                        {top3[0].referrals} referrals
                      </Badge>
                    </CardContent>
                  </Card>
                )}
              </div>

              {/* 3rd Place */}
              <div className="pt-12">
                {top3[2] && (
                  <Card className="border-amber-300 bg-gradient-to-b from-amber-50 to-white text-center">
                    <CardContent className="p-4">
                      <div className="w-10 h-10 sm:w-14 sm:h-14 rounded-full bg-amber-200 flex items-center justify-center mx-auto mb-2 text-xl sm:text-2xl font-bold text-amber-700">
                        3
                      </div>
                      <h3 className="font-semibold text-sm sm:text-base truncate">{top3[2].name}</h3>
                      <p className="text-xs text-muted-foreground truncate">{top3[2].institution}</p>
                      <Badge className={cn("mt-2", TIER_CONFIG[top3[2].tier]?.bg, TIER_CONFIG[top3[2].tier]?.color)}>
                        {top3[2].referrals} referrals
                      </Badge>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>

            {/* Rest of Leaderboard */}
            {rest.length > 0 && (
              <Card className="max-w-2xl mx-auto">
                <CardHeader>
                  <CardTitle className="text-lg">Rankings</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="divide-y">
                    {rest.map((entry) => {
                      const tierConfig = TIER_CONFIG[entry.tier] || TIER_CONFIG.starter
                      return (
                        <div key={entry.rank} className="flex items-center gap-4 px-4 py-3 hover:bg-muted/50 transition-colors">
                          <span className="w-8 text-center font-bold text-muted-foreground">
                            {entry.rank}
                          </span>
                          <div className={cn("p-1.5 rounded-full", tierConfig.bg, tierConfig.color)}>
                            {tierConfig.icon}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{entry.name}</p>
                            <p className="text-xs text-muted-foreground truncate">{entry.institution}</p>
                          </div>
                          <Badge variant="secondary" className="shrink-0">
                            {entry.referrals} referrals
                          </Badge>
                        </div>
                      )
                    })}
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}

        {/* CTA */}
        <div className="text-center mt-12">
          <p className="text-muted-foreground mb-4">Want to see your name on the leaderboard?</p>
          <Link href="/ambassador">
            <Button size="lg">Join the Ambassador Program</Button>
          </Link>
        </div>
      </div>
    </div>
  )
}

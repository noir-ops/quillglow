"use client"

import { motion } from "framer-motion"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Trophy, Medal, Award, Crown, Zap, TrendingUp } from "lucide-react"

interface LeaderboardEntry {
  id: string
  display_name: string
  avatar_url: string | null
  xp: number
  level: number
  streak_days: number
  rank: number
}

interface LeaderboardTableProps {
  leaderboard: LeaderboardEntry[]
  currentUserId: string
  currentUserRank: number
}

export function LeaderboardTable({ leaderboard, currentUserId, currentUserRank }: LeaderboardTableProps) {
  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Crown className="h-6 w-6 text-yellow-500" />
      case 2:
        return <Medal className="h-6 w-6 text-gray-400" />
      case 3:
        return <Award className="h-6 w-6 text-orange-600" />
      default:
        return null
    }
  }

  const getRankBadge = (rank: number) => {
    if (rank === 1) return "bg-gradient-to-r from-yellow-400 to-orange-500 text-white"
    if (rank === 2) return "bg-gradient-to-r from-gray-300 to-gray-400 text-gray-900"
    if (rank === 3) return "bg-gradient-to-r from-orange-400 to-red-500 text-white"
    return "bg-muted text-muted-foreground"
  }

  return (
    <div className="space-y-6">
      <Card className="border-2 bg-white/80 backdrop-blur">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-2xl">
                <Trophy className="h-6 w-6 text-primary" />
                Global Leaderboard
              </CardTitle>
              <CardDescription>Top students ranked by XP</CardDescription>
            </div>
            <div className="text-right">
              <p className="text-sm text-muted-foreground">Your Rank</p>
              <p className="text-3xl font-bold text-primary">#{currentUserRank}</p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {leaderboard.map((entry, index) => {
              const isCurrentUser = entry.id === currentUserId

              return (
                <motion.div
                  key={entry.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.03 }}
                  className={`flex items-center gap-4 rounded-lg border-2 p-4 transition-all ${
                    isCurrentUser
                      ? "border-primary bg-primary/5"
                      : "border-transparent bg-white hover:border-primary/20"
                  }`}
                >
                  {/* Rank */}
                  <div className="flex w-16 items-center justify-center">
                    {entry.rank <= 3 ? (
                      getRankIcon(entry.rank)
                    ) : (
                      <span className="text-2xl font-bold text-muted-foreground">#{entry.rank}</span>
                    )}
                  </div>

                  {/* Avatar and Name */}
                  <Avatar className="h-12 w-12 border-2 border-primary">
                    <AvatarImage src={entry.avatar_url || undefined} />
                    <AvatarFallback className="bg-primary text-primary-foreground">
                      {entry.display_name.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>

                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold">{entry.display_name}</p>
                      {isCurrentUser && (
                        <Badge variant="secondary" className="text-xs">
                          You
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <TrendingUp className="h-3 w-3" />
                        Level {entry.level}
                      </span>
                      <span>•</span>
                      <span>{entry.streak_days} day streak</span>
                    </div>
                  </div>

                  {/* XP */}
                  <div className="text-right">
                    <div className="flex items-center gap-2">
                      <Zap className="h-5 w-5 text-yellow-500" />
                      <span className="text-xl font-bold">{entry.xp.toLocaleString()}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">XP</p>
                  </div>
                </motion.div>
              )
            })}
          </div>

          {leaderboard.length === 0 && (
            <div className="py-12 text-center text-muted-foreground">
              No leaderboard data available yet. Complete quests to appear on the leaderboard!
            </div>
          )}
        </CardContent>
      </Card>

      {/* Top 3 Podium */}
      {leaderboard.length >= 3 && (
        <Card className="border-2 bg-white/80 backdrop-blur">
          <CardHeader>
            <CardTitle>Top 3 Champions</CardTitle>
            <CardDescription>The best of the best</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-end justify-center gap-4">
              {/* 2nd Place */}
              {leaderboard[1] && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="flex flex-col items-center"
                >
                  <Avatar className="mb-3 h-16 w-16 border-4 border-gray-400">
                    <AvatarImage src={leaderboard[1].avatar_url || undefined} />
                    <AvatarFallback className="bg-gray-400 text-white text-xl">
                      {leaderboard[1].display_name.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex h-32 w-32 flex-col items-center justify-center rounded-t-lg bg-gradient-to-br from-gray-300 to-gray-400">
                    <Medal className="mb-2 h-8 w-8 text-white" />
                    <p className="text-3xl font-bold text-white">2</p>
                  </div>
                  <p className="mt-2 text-center text-sm font-semibold">{leaderboard[1].display_name}</p>
                  <p className="text-xs text-muted-foreground">{leaderboard[1].xp} XP</p>
                </motion.div>
              )}

              {/* 1st Place */}
              {leaderboard[0] && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className="flex flex-col items-center"
                >
                  <Avatar className="mb-3 h-20 w-20 border-4 border-yellow-500">
                    <AvatarImage src={leaderboard[0].avatar_url || undefined} />
                    <AvatarFallback className="bg-yellow-500 text-white text-2xl">
                      {leaderboard[0].display_name.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex h-40 w-32 flex-col items-center justify-center rounded-t-lg bg-gradient-to-br from-yellow-400 to-orange-500">
                    <Crown className="mb-2 h-10 w-10 text-white" />
                    <p className="text-4xl font-bold text-white">1</p>
                  </div>
                  <p className="mt-2 text-center text-sm font-semibold">{leaderboard[0].display_name}</p>
                  <p className="text-xs text-muted-foreground">{leaderboard[0].xp} XP</p>
                </motion.div>
              )}

              {/* 3rd Place */}
              {leaderboard[2] && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="flex flex-col items-center"
                >
                  <Avatar className="mb-3 h-16 w-16 border-4 border-orange-600">
                    <AvatarImage src={leaderboard[2].avatar_url || undefined} />
                    <AvatarFallback className="bg-orange-600 text-white text-xl">
                      {leaderboard[2].display_name.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex h-24 w-32 flex-col items-center justify-center rounded-t-lg bg-gradient-to-br from-orange-400 to-red-500">
                    <Award className="mb-2 h-8 w-8 text-white" />
                    <p className="text-3xl font-bold text-white">3</p>
                  </div>
                  <p className="mt-2 text-center text-sm font-semibold">{leaderboard[2].display_name}</p>
                  <p className="text-xs text-muted-foreground">{leaderboard[2].xp} XP</p>
                </motion.div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

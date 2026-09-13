"use client"

import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Sparkles, LogOut, Trophy, Zap, LayoutDashboard, User } from "lucide-react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { useRouter, usePathname } from "next/navigation"

interface DashboardHeaderProps {
  profile: {
    display_name: string
    avatar_url: string | null
    xp: number
    level: number
    streak_days: number
  } | null
}

export function DashboardHeader({ profile }: DashboardHeaderProps) {
  const router = useRouter()
  const pathname = usePathname()

  const handleSignOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push("/")
    router.refresh()
  }

  return (
    <motion.header
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="border-b border-white/20 bg-white/50 backdrop-blur-lg"
    >
      <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/dashboard" className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary">
                <Sparkles className="h-6 w-6 text-primary-foreground" />
              </div>
              <span className="text-xl font-bold">QuillGlow</span>
            </Link>

            <nav className="hidden items-center gap-2 md:flex">
              <Link href="/dashboard">
                <Button variant={pathname === "/dashboard" ? "default" : "ghost"} size="sm" className="gap-2">
                  <LayoutDashboard className="h-4 w-4" />
                  Dashboard
                </Button>
              </Link>
              <Link href="/leaderboard">
                <Button variant={pathname === "/leaderboard" ? "default" : "ghost"} size="sm" className="gap-2">
                  <Trophy className="h-4 w-4" />
                  Leaderboard
                </Button>
              </Link>
              <Link href="/profile">
                <Button variant={pathname === "/profile" ? "default" : "ghost"} size="sm" className="gap-2">
                  <User className="h-4 w-4" />
                  Profile
                </Button>
              </Link>
            </nav>
          </div>

          <div className="flex items-center gap-4">
            {profile && (
              <>
                <div className="hidden items-center gap-6 md:flex">
                  <div className="flex items-center gap-2 rounded-full bg-gradient-to-r from-yellow-400 to-orange-500 px-4 py-2 text-sm font-semibold text-white">
                    <Zap className="h-4 w-4" />
                    {profile.xp} XP
                  </div>
                  <div className="flex items-center gap-2 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 px-4 py-2 text-sm font-semibold text-white">
                    <Trophy className="h-4 w-4" />
                    Level {profile.level}
                  </div>
                </div>

                <Link href="/profile">
                  <div className="flex items-center gap-3 cursor-pointer">
                    <div className="hidden text-right md:block">
                      <p className="text-sm font-semibold">{profile.display_name}</p>
                      <p className="text-xs text-muted-foreground">{profile.streak_days} day streak</p>
                    </div>
                    <Avatar className="h-10 w-10 border-2 border-primary">
                      <AvatarImage src={profile.avatar_url || undefined} />
                      <AvatarFallback className="bg-primary text-primary-foreground">
                        {profile.display_name.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  </div>
                </Link>
              </>
            )}

            <Button variant="ghost" size="icon" onClick={handleSignOut}>
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </div>
    </motion.header>
  )
}

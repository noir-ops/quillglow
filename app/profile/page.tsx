"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { AppLayout } from "@/components/dashboard/app-layout"
import { OpportunityProfileCard } from "@/components/sprout/opportunity-profile-card"
import { createBrowserClient } from "@/lib/supabase/client"
import {
  Mail,
  Calendar,
  Trophy,
  Target,
  BookOpen,
  Brain,
  Flame,
  Edit3,
  Save,
  X,
  Camera,
  Loader2,
  CheckCircle2,
} from "lucide-react"

interface Profile {
  id: string
  display_name: string
  avatar_url: string | null
  bio: string | null
  xp: number
  level: number
  streak_days: number
  created_at: string
}

interface Stats {
  totalNotes: number
  totalFlashcards: number
  totalStudyPlans: number
  totalTasks: number
  completedTasks: number
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [stats, setStats] = useState<Stats | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [displayName, setDisplayName] = useState("")
  const [bio, setBio] = useState("")
  const [isSaving, setIsSaving] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [userEmail, setUserEmail] = useState("")

  const supabase = createBrowserClient()
  const router = useRouter()

  useEffect(() => {
    async function fetchData() {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        router.push("/auth/login")
        return
      }

      setUserEmail(user.email || "")

      // Fetch profile
      const { data: profileData } = await supabase.from("profiles").select("*").eq("id", user.id).single()

      if (profileData) {
        setProfile(profileData)
        setDisplayName(profileData.display_name)
        setBio(profileData.bio || "")
      }

      // Fetch stats
      const [notesRes, flashcardsRes, plansRes, tasksRes] = await Promise.all([
        supabase.from("notes").select("id", { count: "exact" }).eq("user_id", user.id),
        supabase.from("flashcard_decks").select("id", { count: "exact" }).eq("user_id", user.id),
        supabase.from("study_plans").select("id", { count: "exact" }).eq("user_id", user.id),
        supabase.from("tasks").select("id, completed").eq("user_id", user.id),
      ])

      const tasks = tasksRes.data || []
      setStats({
        totalNotes: notesRes.count || 0,
        totalFlashcards: flashcardsRes.count || 0,
        totalStudyPlans: plansRes.count || 0,
        totalTasks: tasks.length,
        completedTasks: tasks.filter((t) => t.completed).length,
      })

      setIsLoading(false)
    }

    fetchData()
  }, [supabase, router])

  const handleSave = async () => {
    if (!profile) return
    setIsSaving(true)

    try {
      const response = await fetch("/api/profile/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ display_name: displayName, bio }),
      })

      if (response.ok) {
        setProfile({ ...profile, display_name: displayName, bio })
        setIsEditing(false)
      }
    } catch (error) {
      console.error("Error updating profile:", error)
    } finally {
      setIsSaving(false)
    }
  }

  const handleCancel = () => {
    setDisplayName(profile?.display_name || "")
    setBio(profile?.bio || "")
    setIsEditing(false)
  }

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    )
  }

  if (!profile) return null

  const memberSince = new Date(profile.created_at).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  })

  return (
    <AppLayout>
      <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">My Profile</h1>
            <p className="text-muted-foreground mt-1">Manage your account and view your progress</p>
          </div>
        </div>

        {/* Profile Card */}
        <Card>
          <CardContent className="p-6">
            <div className="flex flex-col sm:flex-row gap-6">
              {/* Avatar Section */}
              <div className="flex flex-col items-center gap-4">
                <div className="relative group">
                  <Avatar className="h-28 w-28 border-4 border-primary/20">
                    <AvatarImage src={profile.avatar_url || undefined} />
                    <AvatarFallback className="bg-primary text-primary-foreground text-3xl font-bold">
                      {profile.display_name.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <button className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                    <Camera className="h-6 w-6 text-white" />
                  </button>
                </div>
                <Badge variant="secondary" className="text-xs">
                  <Flame className="h-3 w-3 mr-1 text-orange-500" />
                  {profile.streak_days} day streak
                </Badge>
              </div>

              {/* Info Section */}
              <div className="flex-1 space-y-4">
                {isEditing ? (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="displayName">Display Name</Label>
                      <Input
                        id="displayName"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        placeholder="Your name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="bio">Bio</Label>
                      <Textarea
                        id="bio"
                        value={bio}
                        onChange={(e) => setBio(e.target.value)}
                        placeholder="Tell us about yourself..."
                        rows={3}
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={handleSave} disabled={isSaving}>
                        {isSaving ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Save className="h-4 w-4 mr-2" />
                        )}
                        Save Changes
                      </Button>
                      <Button variant="outline" onClick={handleCancel}>
                        <X className="h-4 w-4 mr-2" />
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-start justify-between">
                      <div>
                        <h2 className="text-2xl font-bold">{profile.display_name}</h2>
                        {profile.bio && <p className="text-muted-foreground mt-1">{profile.bio}</p>}
                      </div>
                      <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
                        <Edit3 className="h-4 w-4 mr-2" />
                        Edit
                      </Button>
                    </div>

                    <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Mail className="h-4 w-4" />
                        {userEmail}
                      </div>
                      <div className="flex items-center gap-1">
                        <Calendar className="h-4 w-4" />
                        Member since {memberSince}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4 text-center">
              <BookOpen className="h-8 w-8 mx-auto mb-2 text-blue-500" />
              <p className="text-2xl font-bold">{stats?.totalNotes || 0}</p>
              <p className="text-xs text-muted-foreground">Notes</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <Brain className="h-8 w-8 mx-auto mb-2 text-purple-500" />
              <p className="text-2xl font-bold">{stats?.totalFlashcards || 0}</p>
              <p className="text-xs text-muted-foreground">Flashcard Decks</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <Target className="h-8 w-8 mx-auto mb-2 text-emerald-500" />
              <p className="text-2xl font-bold">{stats?.totalStudyPlans || 0}</p>
              <p className="text-xs text-muted-foreground">Study Plans</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-green-500" />
              <p className="text-2xl font-bold">
                {stats?.completedTasks || 0}/{stats?.totalTasks || 0}
              </p>
              <p className="text-xs text-muted-foreground">Tasks Completed</p>
            </CardContent>
          </Card>
        </div>

        {/* Task Completion Progress */}
        {stats && stats.totalTasks > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Trophy className="h-5 w-5 text-yellow-500" />
                Task Completion Rate
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>
                    {stats.completedTasks} of {stats.totalTasks} tasks completed
                  </span>
                  <span className="font-medium">{Math.round((stats.completedTasks / stats.totalTasks) * 100)}%</span>
                </div>
                <Progress value={(stats.completedTasks / stats.totalTasks) * 100} className="h-2" />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Scholarship matching profile — separate from display identity above.
            Feeds the Opportunities page's eligibility matching. */}
        <OpportunityProfileCard />
      </div>
    </AppLayout>
  )
}

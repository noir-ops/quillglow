"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Pencil, Save, X } from "lucide-react"
import { useRouter } from "next/navigation"

interface ProfileCardProps {
  profile: {
    id: string
    display_name: string
    avatar_url: string | null
    bio: string | null
    xp: number
    level: number
    streak_days: number
  } | null
}

export function ProfileCard({ profile }: ProfileCardProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [displayName, setDisplayName] = useState(profile?.display_name || "")
  const [bio, setBio] = useState(profile?.bio || "")
  const [isSaving, setIsSaving] = useState(false)
  const router = useRouter()

  const handleSave = async () => {
    setIsSaving(true)
    try {
      const response = await fetch("/api/profile/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ display_name: displayName, bio }),
      })

      if (response.ok) {
        setIsEditing(false)
        router.refresh()
      }
    } catch (error) {
      console.error("[v0] Error updating profile:", error)
    } finally {
      setIsSaving(false)
    }
  }

  const handleCancel = () => {
    setDisplayName(profile?.display_name || "")
    setBio(profile?.bio || "")
    setIsEditing(false)
  }

  if (!profile) return null

  return (
    <Card className="border-2 bg-white/80 backdrop-blur">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Profile</CardTitle>
          {!isEditing ? (
            <Button variant="ghost" size="icon" onClick={() => setIsEditing(true)}>
              <Pencil className="h-4 w-4" />
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button variant="ghost" size="icon" onClick={handleCancel}>
                <X className="h-4 w-4" />
              </Button>
              <Button variant="default" size="icon" onClick={handleSave} disabled={isSaving}>
                <Save className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex flex-col items-center">
          <Avatar className="h-24 w-24 border-4 border-primary">
            <AvatarImage src={profile.avatar_url || undefined} />
            <AvatarFallback className="bg-primary text-primary-foreground text-3xl">
              {profile.display_name.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
        </div>

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
          </div>
        ) : (
          <div className="space-y-4">
            <div className="text-center">
              <h3 className="text-2xl font-bold">{profile.display_name}</h3>
              {profile.bio && <p className="mt-2 text-sm text-muted-foreground">{profile.bio}</p>}
            </div>

            <div className="grid grid-cols-3 gap-4 rounded-lg bg-gradient-to-br from-blue-50 to-purple-50 p-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-primary">{profile.level}</p>
                <p className="text-xs text-muted-foreground">Level</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-primary">{profile.xp}</p>
                <p className="text-xs text-muted-foreground">XP</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-primary">{profile.streak_days}</p>
                <p className="text-xs text-muted-foreground">Streak</p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

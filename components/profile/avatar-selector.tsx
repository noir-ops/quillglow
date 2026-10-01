"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Lock, Check } from "lucide-react"
import { useRouter } from "next/navigation"

interface AvatarOption {
  id: string
  name: string
  image_url: string
  unlock_requirement: string
}

interface AvatarSelectorProps {
  avatars: AvatarOption[]
  currentAvatar: string | null
  userLevel: number
}

export function AvatarSelector({ avatars, currentAvatar, userLevel }: AvatarSelectorProps) {
  const [selectedAvatar, setSelectedAvatar] = useState(currentAvatar)
  const router = useRouter()

  const isUnlocked = (requirement: string) => {
    if (requirement === "default") return true
    if (requirement.startsWith("level_")) {
      const requiredLevel = Number.parseInt(requirement.split("_")[1])
      return userLevel >= requiredLevel
    }
    return false
  }

  const handleSelectAvatar = async (avatarUrl: string, requirement: string) => {
    if (!isUnlocked(requirement)) return

    try {
      const response = await fetch("/api/profile/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ avatar_url: avatarUrl }),
      })

      if (response.ok) {
        setSelectedAvatar(avatarUrl)
        router.refresh()
      }
    } catch (error) {
      console.error("[v0] Error updating avatar:", error)
    }
  }

  return (
    <Card className="border-2 bg-white/80 backdrop-blur">
      <CardHeader>
        <CardTitle>Avatars</CardTitle>
        <CardDescription>Unlock avatars by leveling up</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4">
          {avatars.map((avatar, index) => {
            const unlocked = isUnlocked(avatar.unlock_requirement)
            const isSelected = selectedAvatar === avatar.image_url

            return (
              <motion.button
                key={avatar.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.05 }}
                onClick={() => handleSelectAvatar(avatar.image_url, avatar.unlock_requirement)}
                disabled={!unlocked}
                className={`relative rounded-lg border-2 p-4 transition-all ${
                  isSelected
                    ? "border-primary bg-primary/10"
                    : unlocked
                      ? "border-border bg-white hover:border-primary/50"
                      : "border-border bg-gray-100 opacity-50 cursor-not-allowed"
                }`}
              >
                <div className="flex flex-col items-center gap-2">
                  <div className="relative">
                    <Avatar className="h-16 w-16 border-2 border-primary">
                      <AvatarImage src={avatar.image_url || "/placeholder.svg"} />
                      <AvatarFallback>{avatar.name.charAt(0)}</AvatarFallback>
                    </Avatar>
                    {!unlocked && (
                      <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50">
                        <Lock className="h-6 w-6 text-white" />
                      </div>
                    )}
                    {isSelected && (
                      <div className="absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full bg-primary">
                        <Check className="h-4 w-4 text-primary-foreground" />
                      </div>
                    )}
                  </div>
                  <p className="text-xs font-semibold text-center">{avatar.name}</p>
                  {!unlocked && (
                    <Badge variant="secondary" className="text-xs">
                      {avatar.unlock_requirement.replace("_", " ")}
                    </Badge>
                  )}
                </div>
              </motion.button>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}

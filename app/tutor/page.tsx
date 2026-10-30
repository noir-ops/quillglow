"use client"

import { useState, useEffect } from "react"
import { AppLayout } from "@/components/dashboard/app-layout"
import { TutorOnboarding } from "@/components/tutor/tutor-onboarding"
import { TutorChat } from "@/components/tutor/tutor-chat"
import { TutorSettings } from "@/components/tutor/tutor-settings"
import { Loader2 } from "lucide-react"

interface TutorProfile {
  id: string
  user_id: string
  learning_style: string
  difficulty: string
  goal: string
  subjects: string[]
  exams: string[]
  ask_followups: boolean
  keep_short: boolean
  onboarding_completed: boolean
}

export default function TutorPage() {
  const [profile, setProfile] = useState<TutorProfile | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [showSettings, setShowSettings] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }
    checkMobile()
    window.addEventListener("resize", checkMobile)
    return () => window.removeEventListener("resize", checkMobile)
  }, [])

  const fetchProfile = async () => {
    try {
      const response = await fetch("/api/tutor/profile")
      const data = await response.json()
      setProfile(data.profile || null)
    } catch (error) {
      console.error("Error fetching tutor profile:", error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchProfile()
  }, [])

  const handleOnboardingComplete = async (profileData: Omit<TutorProfile, "id" | "user_id">) => {
    try {
      const response = await fetch("/api/tutor/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profileData),
      })
      const data = await response.json()
      if (data.profile) {
        setProfile(data.profile)
      }
    } catch (error) {
      console.error("Error saving tutor profile:", error)
    }
  }

  const handleSettingsSave = async (updatedProfile: Partial<TutorProfile>) => {
    try {
      const response = await fetch("/api/tutor/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...profile, ...updatedProfile }),
      })
      const data = await response.json()
      if (data.profile) {
        setProfile(data.profile)
        setShowSettings(false)
      }
    } catch (error) {
      console.error("Error updating tutor profile:", error)
    }
  }

  if (isLoading) {
    const loadingContent = (
      <div className="flex items-center justify-center h-screen bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )

    if (isMobile) {
      return loadingContent
    }

    return <AppLayout>{loadingContent}</AppLayout>
  }

  // Show onboarding if no profile or not completed
  if (!profile || !profile.onboarding_completed) {
    return <TutorOnboarding onComplete={handleOnboardingComplete} />
  }

  if (showSettings) {
    const settingsContent = (
      <TutorSettings profile={profile} onSave={handleSettingsSave} onCancel={() => setShowSettings(false)} />
    )

    if (isMobile) {
      return <div className="h-screen bg-background">{settingsContent}</div>
    }

    return <AppLayout>{settingsContent}</AppLayout>
  }

  const chatContent = (
    <div className="h-screen">
      <TutorChat profile={profile} onOpenSettings={() => setShowSettings(true)} showBackButton={isMobile} />
    </div>
  )

  if (isMobile) {
    return chatContent
  }

  return (
    <AppLayout>
      <div className="h-[calc(100vh-3.5rem)] md:h-screen">
        <TutorChat profile={profile} onOpenSettings={() => setShowSettings(true)} showBackButton={false} />
      </div>
    </AppLayout>
  )
}

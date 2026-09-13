"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Loader2, Users, BookOpen, Clock, GraduationCap, MessageSquare } from "lucide-react"
import { toast } from "sonner"
import { useRouter } from "next/navigation"

const SUBJECTS = [
  "Mathematics",
  "Physics",
  "Chemistry",
  "Biology",
  "Computer Science",
  "English",
  "History",
  "Geography",
  "Economics",
  "Psychology",
  "Business",
  "Art",
  "Music",
  "Languages",
  "Other",
]

const STUDY_METHODS = [
  "Anki/Flashcards",
  "Pomodoro Technique",
  "Active Recall",
  "Feynman Technique",
  "Past Papers",
  "Mind Mapping",
  "Summarizing",
  "Group Discussion",
]

const GOALS = ["Exam Prep", "Homework Help", "Revision", "Focus Session", "Learn New Topic", "Practice Problems"]

const LEVELS = ["High School", "College", "University", "Graduate", "Other"]

export function FindStudyBuddy() {
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [searching, setSearching] = useState(false)
  const [matches, setMatches] = useState<any[]>([])
  const [myRequestId, setMyRequestId] = useState<string | null>(null)
  const router = useRouter()

  const [preferences, setPreferences] = useState({
    subjects: [] as string[],
    study_methods: [] as string[],
    goal: "",
    level: "",
    timezone: "",
    availability: "",
  })

  const toggleSelection = (category: "subjects" | "study_methods", value: string) => {
    setPreferences((prev) => ({
      ...prev,
      [category]: prev[category].includes(value)
        ? prev[category].filter((item) => item !== value)
        : [...prev[category], value],
    }))
  }

  const handleFindMatches = async () => {
    if (preferences.subjects.length === 0 || preferences.study_methods.length === 0 || !preferences.goal) {
      toast.error("Please select at least one subject, study method, and goal")
      return
    }

    setSearching(true)

    try {
      const response = await fetch("/api/matchmaking/find-buddies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(preferences),
      })

      const data = await response.json()

      if (response.ok) {
        setMatches(data.matches)
        setMyRequestId(data.request_id)
        if (data.matches.length === 0) {
          toast.info("No matches found yet. Try adjusting your preferences or check back later!")
        } else {
          toast.success(`Found ${data.matches.length} potential study buddies!`)
        }
      } else {
        toast.error(data.error || "Failed to find matches")
      }
    } catch (error) {
      console.error("[v0] Error finding matches:", error)
      toast.error("Failed to find matches")
    } finally {
      setSearching(false)
    }
  }

  const handleStartSession = async (theirRequestId: string) => {
    if (!myRequestId) return

    setLoading(true)

    try {
      const response = await fetch("/api/matchmaking/start-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          their_request_id: theirRequestId,
          my_request_id: myRequestId,
        }),
      })

      const data = await response.json()

      if (response.ok) {
        toast.success("Study session created!")
        router.push(`/study-together/${data.room_id}`)
      } else {
        toast.error(data.error || "Failed to create session")
      }
    } catch (error) {
      console.error("[v0] Error starting session:", error)
      toast.error("Failed to create session")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background p-4 sm:p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold">Find Your Study Buddy</h1>
          <p className="text-muted-foreground">Match with students who share your study goals and preferences</p>
        </div>

        {/* Preferences Form */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Your Study Preferences
            </CardTitle>
            <CardDescription>Tell us what you're looking for in a study buddy</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Subjects */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <BookOpen className="w-4 h-4" />
                Subjects (select at least one)
              </Label>
              <div className="flex flex-wrap gap-2">
                {SUBJECTS.map((subject) => (
                  <Badge
                    key={subject}
                    variant={preferences.subjects.includes(subject) ? "default" : "outline"}
                    className="cursor-pointer"
                    onClick={() => toggleSelection("subjects", subject)}
                  >
                    {subject}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Study Methods */}
            <div className="space-y-2">
              <Label>Study Methods (select at least one)</Label>
              <div className="flex flex-wrap gap-2">
                {STUDY_METHODS.map((method) => (
                  <Badge
                    key={method}
                    variant={preferences.study_methods.includes(method) ? "default" : "outline"}
                    className="cursor-pointer"
                    onClick={() => toggleSelection("study_methods", method)}
                  >
                    {method}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Goal */}
            <div className="space-y-2">
              <Label>Study Goal</Label>
              <div className="flex flex-wrap gap-2">
                {GOALS.map((goal) => (
                  <Badge
                    key={goal}
                    variant={preferences.goal === goal ? "default" : "outline"}
                    className="cursor-pointer"
                    onClick={() => setPreferences((prev) => ({ ...prev, goal }))}
                  >
                    {goal}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Level */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <GraduationCap className="w-4 h-4" />
                Level (optional)
              </Label>
              <div className="flex flex-wrap gap-2">
                {LEVELS.map((level) => (
                  <Badge
                    key={level}
                    variant={preferences.level === level ? "default" : "outline"}
                    className="cursor-pointer"
                    onClick={() => setPreferences((prev) => ({ ...prev, level }))}
                  >
                    {level}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Timezone & Availability */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  Timezone (optional)
                </Label>
                <Input
                  placeholder="e.g., EST, GMT, PST"
                  value={preferences.timezone}
                  onChange={(e) => setPreferences((prev) => ({ ...prev, timezone: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Availability (optional)</Label>
                <Input
                  placeholder="e.g., Evenings, Weekends"
                  value={preferences.availability}
                  onChange={(e) => setPreferences((prev) => ({ ...prev, availability: e.target.value }))}
                />
              </div>
            </div>

            <Button onClick={handleFindMatches} disabled={searching} className="w-full" size="lg">
              {searching ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Finding Matches...
                </>
              ) : (
                <>
                  <Users className="w-4 h-4 mr-2" />
                  Find Study Buddies
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Matches */}
        {matches.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-2xl font-semibold">Suggested Matches</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {matches.map((match) => (
                <Card key={match.id}>
                  <CardHeader>
                    <div className="flex items-start gap-3">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-semibold text-lg shrink-0">
                        {match.user_public_profile?.avatar_url ? (
                          <img
                            src={match.user_public_profile.avatar_url || "/placeholder.svg"}
                            alt={match.user_public_profile.display_name}
                            className="w-full h-full rounded-full object-cover"
                          />
                        ) : (
                          match.user_public_profile?.display_name?.charAt(0).toUpperCase()
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-lg">{match.user_public_profile?.display_name}</CardTitle>
                        {match.user_public_profile?.bio && (
                          <p className="text-sm text-muted-foreground line-clamp-2">{match.user_public_profile.bio}</p>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <p className="text-sm font-medium mb-1">Subjects:</p>
                      <div className="flex flex-wrap gap-1">
                        {match.subjects.map((subject: string) => (
                          <Badge key={subject} variant="secondary" className="text-xs">
                            {subject}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="text-sm font-medium mb-1">Study Methods:</p>
                      <div className="flex flex-wrap gap-1">
                        {match.study_methods.map((method: string) => (
                          <Badge key={method} variant="outline" className="text-xs">
                            {method}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-medium">Goal:</span>
                      <span className="text-muted-foreground">{match.goal}</span>
                    </div>
                    {match.level && (
                      <div className="flex items-center gap-2 text-sm">
                        <span className="font-medium">Level:</span>
                        <span className="text-muted-foreground">{match.level}</span>
                      </div>
                    )}
                    <Button onClick={() => handleStartSession(match.id)} disabled={loading} className="w-full">
                      <MessageSquare className="w-4 h-4 mr-2" />
                      Start Study Session
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

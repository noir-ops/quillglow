"use client"

import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { BookOpen, Beaker, Globe, Calculator, Sparkles, Play } from "lucide-react"
import Link from "next/link"
import { useQuestGeneration } from "@/lib/hooks/use-quest-generation"

const subjects = [
  { name: "Math", icon: Calculator, color: "from-blue-500 to-cyan-500" },
  { name: "Science", icon: Beaker, color: "from-green-500 to-emerald-500" },
  { name: "History", icon: Globe, color: "from-purple-500 to-pink-500" },
  { name: "English", icon: BookOpen, color: "from-orange-500 to-red-500" },
]

export function QuestBrowser() {
  const [quests, setQuests] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedSubject, setSelectedSubject] = useState("all")
  const { generateQuest, isGenerating } = useQuestGeneration()

  useEffect(() => {
    fetchQuests()
  }, [selectedSubject])

  const fetchQuests = async () => {
    setIsLoading(true)
    try {
      const url = selectedSubject === "all" ? "/api/quests/list" : `/api/quests/list?subject=${selectedSubject}`

      const response = await fetch(url)
      const data = await response.json()
      setQuests(data.quests || [])
    } catch (error) {
      console.error("[v0] Error fetching quests:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleGenerateQuest = async (subject: string, difficulty: "easy" | "medium" | "hard") => {
    const quest = await generateQuest(subject, difficulty, 5)
    if (quest) {
      fetchQuests()
    }
  }

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case "easy":
        return "bg-green-500"
      case "medium":
        return "bg-yellow-500"
      case "hard":
        return "bg-red-500"
      default:
        return "bg-gray-500"
    }
  }

  return (
    <Card className="border-2 bg-white/80 backdrop-blur">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-2xl">
          <Sparkles className="h-6 w-6 text-primary" />
          Available Quests
        </CardTitle>
        <CardDescription>Choose a quest to start your learning adventure</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="all" onValueChange={setSelectedSubject}>
          <TabsList className="mb-6 grid w-full grid-cols-5">
            <TabsTrigger value="all">All</TabsTrigger>
            {subjects.map((subject) => (
              <TabsTrigger key={subject.name} value={subject.name}>
                {subject.name}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="all" className="space-y-4">
            {isLoading ? (
              <div className="py-12 text-center text-muted-foreground">Loading quests...</div>
            ) : quests.length === 0 ? (
              <div className="py-12 text-center">
                <p className="mb-4 text-muted-foreground">No quests available yet.</p>
                <div className="flex flex-wrap justify-center gap-2">
                  {subjects.map((subject) => (
                    <Button
                      key={subject.name}
                      onClick={() => handleGenerateQuest(subject.name, "medium")}
                      disabled={isGenerating}
                      size="sm"
                    >
                      Generate {subject.name} Quest
                    </Button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {quests.map((quest, index) => (
                  <motion.div
                    key={quest.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                  >
                    <Card className="border hover:border-primary transition-colors">
                      <CardHeader>
                        <div className="flex items-start justify-between">
                          <CardTitle className="text-lg">{quest.title}</CardTitle>
                          <Badge className={getDifficultyColor(quest.difficulty)}>{quest.difficulty}</Badge>
                        </div>
                        <CardDescription className="line-clamp-2">{quest.description}</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <BookOpen className="h-4 w-4" />
                              {quest.subject}
                            </span>
                            <span className="flex items-center gap-1">
                              <Sparkles className="h-4 w-4" />
                              {quest.xp_reward} XP
                            </span>
                          </div>
                          <Link href={`/quest/${quest.id}`}>
                            <Button size="sm">
                              <Play className="mr-2 h-4 w-4" />
                              Start
                            </Button>
                          </Link>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>
            )}
          </TabsContent>

          {subjects.map((subject) => (
            <TabsContent key={subject.name} value={subject.name} className="space-y-4">
              {isLoading ? (
                <div className="py-12 text-center text-muted-foreground">Loading quests...</div>
              ) : quests.length === 0 ? (
                <div className="py-12 text-center">
                  <p className="mb-4 text-muted-foreground">No {subject.name} quests available yet.</p>
                  <Button onClick={() => handleGenerateQuest(subject.name, "medium")} disabled={isGenerating}>
                    <Sparkles className="mr-2 h-4 w-4" />
                    Generate {subject.name} Quest
                  </Button>
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  {quests.map((quest, index) => (
                    <motion.div
                      key={quest.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                    >
                      <Card className="border hover:border-primary transition-colors">
                        <CardHeader>
                          <div className="flex items-start justify-between">
                            <CardTitle className="text-lg">{quest.title}</CardTitle>
                            <Badge className={getDifficultyColor(quest.difficulty)}>{quest.difficulty}</Badge>
                          </div>
                          <CardDescription className="line-clamp-2">{quest.description}</CardDescription>
                        </CardHeader>
                        <CardContent>
                          <div className="flex items-center justify-between">
                            <span className="flex items-center gap-1 text-sm text-muted-foreground">
                              <Sparkles className="h-4 w-4" />
                              {quest.xp_reward} XP
                            </span>
                            <Link href={`/quest/${quest.id}`}>
                              <Button size="sm">
                                <Play className="mr-2 h-4 w-4" />
                                Start
                              </Button>
                            </Link>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  ))}
                </div>
              )}
            </TabsContent>
          ))}
        </Tabs>
      </CardContent>
    </Card>
  )
}

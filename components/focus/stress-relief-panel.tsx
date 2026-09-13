"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { ChatMarkdown } from "@/components/chat/chat-markdown"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Play, Pause, RotateCcw, Send, Sparkles, ImageIcon, X, ArrowLeft, Gamepad2 } from "lucide-react"
import { cn } from "@/lib/utils"
import Link from "next/link"

const backgrounds = [
  {
    id: "ocean",
    name: "Ocean Waves",
    gradient: "from-blue-400 via-cyan-300 to-teal-400",
    image: "/calm-ocean-waves-sunset.jpg",
  },
  {
    id: "forest",
    name: "Forest Path",
    gradient: "from-green-400 via-emerald-300 to-teal-400",
    image: "/peaceful-forest-path-sunlight.jpg",
  },
  {
    id: "sunset",
    name: "Sunset Sky",
    gradient: "from-orange-300 via-pink-300 to-purple-400",
    image: "/peaceful-sunset-sky-clouds.jpg",
  },
  {
    id: "mountains",
    name: "Mountain View",
    gradient: "from-indigo-300 via-purple-300 to-pink-300",
    image: "/calm-mountain-landscape.jpg",
  },
  {
    id: "lavender",
    name: "Lavender Field",
    gradient: "from-purple-300 via-violet-300 to-pink-300",
    image: "/lavender-field-peaceful.jpg",
  },
  {
    id: "gradient",
    name: "Calm Gradient",
    gradient: "from-blue-200 via-purple-200 to-pink-200",
    image: null,
  },
]

interface Message {
  role: "user" | "assistant"
  content: string
}

export function StressReliefPanel() {
  const [selectedBg, setSelectedBg] = useState(backgrounds[0])
  const [showBgSelector, setShowBgSelector] = useState(false)
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content:
        "Hi there 🌸 I'm here to help you relax and unwind. Take a deep breath... How are you feeling right now?",
    },
  ])
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [timerMinutes, setTimerMinutes] = useState(5)
  const [timeLeft, setTimeLeft] = useState(5 * 60)
  const [isTimerRunning, setIsTimerRunning] = useState(false)
  const [showBreathing, setShowBreathing] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Timer logic
  useEffect(() => {
    let interval: NodeJS.Timeout
    if (isTimerRunning && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            setIsTimerRunning(false)
            return 0
          }
          return prev - 1
        })
      }, 1000)
    }
    return () => clearInterval(interval)
  }, [isTimerRunning, timeLeft])

  // Auto-scroll chat
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, "0")}`
  }

  const handleTimerStart = () => {
    if (timeLeft === 0) {
      setTimeLeft(timerMinutes * 60)
    }
    setIsTimerRunning(true)
  }

  const handleTimerReset = () => {
    setIsTimerRunning(false)
    setTimeLeft(timerMinutes * 60)
  }

  const handleSendMessage = async () => {
    if (!input.trim() || isLoading) return

    const userMessage = input.trim()
    setInput("")
    setMessages((prev) => [...prev, { role: "user", content: userMessage }])
    setIsLoading(true)

    try {
      const response = await fetch("/api/stress-relief-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...messages, { role: "user", content: userMessage }],
        }),
      })

      if (!response.ok) throw new Error("Failed to get response")

      const data = await response.json()
      setMessages((prev) => [...prev, { role: "assistant", content: data.message }])
    } catch (error) {
      console.error("Chat error:", error)
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "I'm here for you. Let's take a moment to breathe together.",
        },
      ])
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Background */}
      <div className="fixed inset-0 -z-10">
        {selectedBg.image ? (
          <div
            className="absolute inset-0 bg-cover bg-center transition-all duration-1000"
            style={{ backgroundImage: `url(${selectedBg.image})` }}
          >
            <div className="absolute inset-0 bg-black/20 backdrop-blur-[2px]" />
          </div>
        ) : (
          <div className={cn("absolute inset-0 bg-gradient-to-br transition-all duration-1000", selectedBg.gradient)} />
        )}
      </div>

      {/* Breathing Animation Overlay */}
      {showBreathing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="text-center">
            <div className="relative mx-auto mb-8">
              <div className="h-32 w-32 animate-[ping_4s_ease-in-out_infinite] rounded-full bg-white/30" />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="h-24 w-24 animate-[pulse_4s_ease-in-out_infinite] rounded-full bg-white/50" />
              </div>
            </div>
            <p className="mb-2 text-2xl font-light text-white">Breathe In...</p>
            <p className="mb-8 text-lg text-white/80">Hold... Breathe Out...</p>
            <Button
              onClick={() => setShowBreathing(false)}
              variant="outline"
              className="border-white/30 bg-white/10 text-white backdrop-blur-sm hover:bg-white/20"
            >
              Close
            </Button>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="relative z-10 flex min-h-screen flex-col p-4 md:p-8">
        {/* Header */}
        <div className="mb-6 text-center">
          <div className="mb-4 flex justify-center">
            <Link href="/dashboard">
              <Button
                variant="outline"
                size="sm"
                className="border-white/30 bg-white/10 text-white backdrop-blur-sm hover:bg-white/20"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to App
              </Button>
            </Link>
          </div>
          <h1 className="mb-2 text-3xl font-light text-white drop-shadow-lg md:text-4xl">Take a Moment for Yourself</h1>
          <p className="text-sm text-white/90 drop-shadow md:text-base">Breathe, relax, and let go of stress</p>
        </div>

        {/* Controls Bar */}
        <div className="mb-6 flex flex-wrap items-center justify-center gap-3">
          <Button
            onClick={() => setShowBgSelector(!showBgSelector)}
            variant="outline"
            size="sm"
            className="border-white/30 bg-white/10 text-white backdrop-blur-sm hover:bg-white/20"
          >
            <ImageIcon className="mr-2 h-4 w-4" />
            Change Scene
          </Button>
          <Button
            onClick={() => setShowBreathing(true)}
            variant="outline"
            size="sm"
            className="border-white/30 bg-white/10 text-white backdrop-blur-sm hover:bg-white/20"
          >
            <Sparkles className="mr-2 h-4 w-4" />
            Breathing Exercise
          </Button>
          <Link href="/zen-runner">
            <Button
              variant="outline"
              size="sm"
              className="border-white/30 bg-white/10 text-white backdrop-blur-sm hover:bg-white/20"
            >
              <Gamepad2 className="mr-2 h-4 w-4" />
              Zen Runner Game
            </Button>
          </Link>
        </div>

        {/* Background Selector */}
        {showBgSelector && (
          <Card className="mx-auto mb-6 w-full max-w-2xl border-white/20 bg-white/10 p-4 backdrop-blur-md">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-medium text-white">Choose Your Scene</h3>
              <Button
                onClick={() => setShowBgSelector(false)}
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 text-white hover:bg-white/20"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
              {backgrounds.map((bg) => (
                <button
                  key={bg.id}
                  onClick={() => {
                    setSelectedBg(bg)
                    setShowBgSelector(false)
                  }}
                  className={cn(
                    "group relative overflow-hidden rounded-lg border-2 transition-all",
                    selectedBg.id === bg.id ? "border-white shadow-lg" : "border-white/30 hover:border-white/60",
                  )}
                >
                  {bg.image ? (
                    <img src={bg.image || "/placeholder.svg"} alt={bg.name} className="h-20 w-full object-cover" />
                  ) : (
                    <div className={cn("h-20 w-full bg-gradient-to-br", bg.gradient)} />
                  )}
                  <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                    <span className="text-sm font-medium text-white">{bg.name}</span>
                  </div>
                </button>
              ))}
            </div>
          </Card>
        )}

        {/* Main Grid */}
        <div className="mx-auto grid w-full max-w-6xl flex-1 gap-4 md:grid-cols-2 md:gap-6">
          {/* Timer Card */}
          <Card className="flex flex-col border-white/20 bg-white/10 p-6 backdrop-blur-md md:p-8">
            <h2 className="mb-4 text-center text-xl font-medium text-white">Break Timer</h2>
            <div className="mb-6 flex-1 flex items-center justify-center">
              <div className="relative">
                <svg className="h-48 w-48 -rotate-90 transform md:h-56 md:w-56">
                  <circle cx="50%" cy="50%" r="45%" stroke="rgba(255,255,255,0.2)" strokeWidth="8" fill="none" />
                  <circle
                    cx="50%"
                    cy="50%"
                    r="45%"
                    stroke="white"
                    strokeWidth="8"
                    fill="none"
                    strokeDasharray={`${2 * Math.PI * 45} ${2 * Math.PI * 45}`}
                    strokeDashoffset={2 * Math.PI * 45 * (1 - timeLeft / (timerMinutes * 60))}
                    strokeLinecap="round"
                    className="transition-all duration-1000"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-4xl font-light text-white md:text-5xl">{formatTime(timeLeft)}</span>
                </div>
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-center gap-2">
                <Button
                  onClick={() => setTimerMinutes(Math.max(1, timerMinutes - 1))}
                  disabled={isTimerRunning}
                  variant="outline"
                  size="sm"
                  className="border-white/30 bg-white/10 text-white backdrop-blur-sm hover:bg-white/20 disabled:opacity-50"
                >
                  -
                </Button>
                <span className="min-w-[80px] text-center text-white">{timerMinutes} min</span>
                <Button
                  onClick={() => setTimerMinutes(timerMinutes + 1)}
                  disabled={isTimerRunning}
                  variant="outline"
                  size="sm"
                  className="border-white/30 bg-white/10 text-white backdrop-blur-sm hover:bg-white/20 disabled:opacity-50"
                >
                  +
                </Button>
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={isTimerRunning ? () => setIsTimerRunning(false) : handleTimerStart}
                  className="flex-1 bg-white/20 text-white backdrop-blur-sm hover:bg-white/30"
                >
                  {isTimerRunning ? (
                    <>
                      <Pause className="mr-2 h-4 w-4" />
                      Pause
                    </>
                  ) : (
                    <>
                      <Play className="mr-2 h-4 w-4" />
                      Start
                    </>
                  )}
                </Button>
                <Button
                  onClick={handleTimerReset}
                  variant="outline"
                  className="border-white/30 bg-white/10 text-white backdrop-blur-sm hover:bg-white/20"
                >
                  <RotateCcw className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </Card>

          {/* AI Chat Card */}
          <Card className="flex flex-col border-white/20 bg-white/10 backdrop-blur-md">
            <div className="border-b border-white/20 p-4">
              <h2 className="text-center text-xl font-medium text-white">Stress Relief Coach</h2>
              <p className="text-center text-sm text-white/80">Share what's on your mind</p>
            </div>
            <ScrollArea ref={scrollRef} className="flex-1 p-4">
              <div className="space-y-4">
                {messages.map((message, index) => (
                  <div key={index} className={cn("flex", message.role === "user" ? "justify-end" : "justify-start")}>
                    <div
                      className={cn(
                        "max-w-[85%] rounded-2xl px-4 py-2.5 text-sm md:text-base",
                        message.role === "user"
                          ? "bg-white/90 text-gray-800"
                          : "bg-white/20 text-white backdrop-blur-sm",
                      )}
                    >
                      {message.role === "assistant" ? (
                        <ChatMarkdown content={message.content} className="text-white [&_strong]:text-white" />
                      ) : (
                        message.content
                      )}
                    </div>
                  </div>
                ))}
                {isLoading && (
                  <div className="flex justify-start">
                    <div className="max-w-[85%] rounded-2xl bg-white/20 px-4 py-2.5 text-white backdrop-blur-sm">
                      <div className="flex gap-1">
                        <div className="h-2 w-2 animate-bounce rounded-full bg-white [animation-delay:-0.3s]" />
                        <div className="h-2 w-2 animate-bounce rounded-full bg-white [animation-delay:-0.15s]" />
                        <div className="h-2 w-2 animate-bounce rounded-full bg-white" />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>
            <div className="border-t border-white/20 p-4">
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  handleSendMessage()
                }}
                className="flex gap-2"
              >
                <Input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Type your thoughts..."
                  disabled={isLoading}
                  className="flex-1 border-white/30 bg-white/10 text-white placeholder:text-white/60 backdrop-blur-sm focus-visible:ring-white/50"
                />
                <Button
                  type="submit"
                  disabled={isLoading || !input.trim()}
                  className="bg-white/20 text-white backdrop-blur-sm hover:bg-white/30 disabled:opacity-50"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </form>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}

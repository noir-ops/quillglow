"use client"

import { useEffect, useState } from "react"
import { BookOpen, Brain, Lightbulb, Sparkles } from "lucide-react"

interface LoadingScreenProps {
  message?: string
  variant?: "default" | "brain" | "book" | "lightbulb"
}

export function LoadingScreen({ message, variant = "default" }: LoadingScreenProps) {
  const [dots, setDots] = useState("")

  useEffect(() => {
    const interval = setInterval(() => {
      setDots((prev) => (prev.length >= 3 ? "" : prev + "."))
    }, 500)
    return () => clearInterval(interval)
  }, [])

  const icons = {
    default: Sparkles,
    brain: Brain,
    book: BookOpen,
    lightbulb: Lightbulb,
  }

  const Icon = icons[variant]

  return (
    <div className="flex flex-col items-center justify-center gap-6 p-8">
      {/* Animated icon */}
      <div className="relative">
        {/* Pulsing glow */}
        <div className="absolute inset-0 blur-xl bg-primary/20 animate-pulse" />

        {/* Main icon */}
        <div className="relative w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
          <Icon className="w-8 h-8 text-primary animate-pulse" />
        </div>

        {/* Orbiting dots */}
        <div className="absolute inset-0 animate-spin">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-2 h-2 bg-primary rounded-full" />
        </div>
        <div className="absolute inset-0 animate-spin" style={{ animationDelay: "0.5s" }}>
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-2 h-2 bg-primary/60 rounded-full" />
        </div>
        <div className="absolute inset-0 animate-spin" style={{ animationDelay: "1s" }}>
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-2 h-2 bg-primary/30 rounded-full" />
        </div>
      </div>

      {/* Loading text */}
      <div className="text-center space-y-2">
        <p className="text-sm font-medium text-foreground">
          {message || "Loading"}
          <span className="inline-block w-8 text-left">{dots}</span>
        </p>
        <div className="flex gap-1 justify-center">
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className="w-2 h-2 bg-primary rounded-full animate-bounce"
              style={{ animationDelay: `${i * 0.15}s` }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

// Fullscreen variant
export function FullScreenLoading({ message, variant }: LoadingScreenProps) {
  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50">
      <LoadingScreen message={message} variant={variant} />
    </div>
  )
}

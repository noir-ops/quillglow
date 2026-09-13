"use client"

import { useEffect, useState } from "react"
import { Sparkles } from "lucide-react"

export default function Loading() {
  const [messageIndex, setMessageIndex] = useState(0)

  const messages = [
    "Preparing your workspace...",
    "Loading your notes...",
    "Getting things ready...",
    "Almost there...",
  ]

  useEffect(() => {
    const interval = setInterval(() => {
      setMessageIndex((prev) => (prev + 1) % messages.length)
    }, 2000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="fixed inset-0 bg-background flex items-center justify-center overflow-hidden">
      {/* Animated background particles */}
      <div className="absolute inset-0 overflow-hidden">
        {[...Array(20)].map((_, i) => (
          <div
            key={i}
            className="absolute w-1 h-1 bg-primary/20 rounded-full animate-float"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 3}s`,
              animationDuration: `${3 + Math.random() * 4}s`,
            }}
          />
        ))}
      </div>

      {/* Main content */}
      <div className="relative z-10 flex flex-col items-center gap-8">
        {/* Animated quill icon */}
        <div className="relative">
          {/* Glow effect */}
          <div className="absolute inset-0 blur-2xl bg-primary/30 animate-pulse" />

          {/* Quill icon with sparkles */}
          <div className="relative">
            <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center animate-bounce-slow">
              <Sparkles className="w-10 h-10 text-primary animate-spin-slow" />
            </div>

            {/* Orbiting sparkles */}
            <div className="absolute inset-0 animate-spin-slow">
              <Sparkles className="absolute -top-2 left-1/2 -translate-x-1/2 w-4 h-4 text-primary/60" />
            </div>
            <div className="absolute inset-0 animate-spin-slow" style={{ animationDelay: "1s" }}>
              <Sparkles className="absolute top-1/2 -right-2 -translate-y-1/2 w-4 h-4 text-primary/60" />
            </div>
            <div className="absolute inset-0 animate-spin-slow" style={{ animationDelay: "2s" }}>
              <Sparkles className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-4 text-primary/60" />
            </div>
          </div>
        </div>

        {/* Brand name */}
        <div className="flex flex-col items-center gap-2">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-primary via-primary/80 to-primary bg-clip-text text-transparent animate-gradient">
            QuillGlow
          </h1>

          {/* Loading bar */}
          <div className="w-48 h-1 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-primary/50 via-primary to-primary/50 animate-loading-bar" />
          </div>
        </div>

        {/* Rotating messages */}
        <p className="text-sm text-muted-foreground animate-fade-in" key={messageIndex}>
          {messages[messageIndex]}
        </p>
      </div>

      <style jsx>{`
        @keyframes float {
          0%, 100% {
            transform: translateY(0) translateX(0);
            opacity: 0;
          }
          50% {
            opacity: 1;
          }
          100% {
            transform: translateY(-100vh) translateX(20px);
          }
        }
        
        @keyframes bounce-slow {
          0%, 100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-10px);
          }
        }
        
        @keyframes spin-slow {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
        
        @keyframes loading-bar {
          0% {
            transform: translateX(-100%);
          }
          100% {
            transform: translateX(100%);
          }
        }
        
        @keyframes gradient {
          0%, 100% {
            background-position: 0% 50%;
          }
          50% {
            background-position: 100% 50%;
          }
        }
        
        @keyframes fade-in {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        .animate-float {
          animation: float linear infinite;
        }
        
        .animate-bounce-slow {
          animation: bounce-slow 2s ease-in-out infinite;
        }
        
        .animate-spin-slow {
          animation: spin-slow 8s linear infinite;
        }
        
        .animate-loading-bar {
          animation: loading-bar 1.5s ease-in-out infinite;
        }
        
        .animate-gradient {
          background-size: 200% 200%;
          animation: gradient 3s ease infinite;
        }
        
        .animate-fade-in {
          animation: fade-in 0.5s ease-out;
        }
      `}</style>
    </div>
  )
}

"use client"

import { useEffect, useState } from "react"
import { Leaf } from "lucide-react"

const BULB_STYLES = [
  { base: "#ef4444", glow: "rgba(239,68,68,0.9)", highlight: "#fca5a5" }, // Red
  { base: "#3b82f6", glow: "rgba(59,130,246,0.9)", highlight: "#93c5fd" }, // Blue
  { base: "#eab308", glow: "rgba(234,179,8,0.9)", highlight: "#fde047" }, // Yellow
  { base: "#22c55e", glow: "rgba(34,197,94,0.9)", highlight: "#86efac" }, // Green
  { base: "#f97316", glow: "rgba(249,115,22,0.9)", highlight: "#fdba74" }, // Orange
  { base: "#ec4899", glow: "rgba(236,72,153,0.9)", highlight: "#f9a8d4" }, // Pink
]

interface Bulb {
  id: number
  colorIndex: number
  x: number
  y: number
  rotation: number
}

export function ChristmasLights() {
  const [bulbs, setBulbs] = useState<Bulb[]>([])
  const [glowingBulbs, setGlowingBulbs] = useState<Set<number>>(new Set())

  useEffect(() => {
    const newBulbs: Bulb[] = []
    const totalBulbs = 24

    for (let i = 0; i < totalBulbs; i++) {
      const progress = i / (totalBulbs - 1)
      const x = 2 + progress * 96
      // Create a double drape pattern like real string lights
      const drape1 = Math.sin(progress * Math.PI * 3) * 12
      const drape2 = Math.cos(progress * Math.PI * 2) * 5
      const y = 45 + drape1 + drape2
      const rotation = Math.sin(progress * Math.PI * 4) * 15

      newBulbs.push({
        id: i,
        colorIndex: i % BULB_STYLES.length,
        x,
        y,
        rotation,
      })
    }
    setBulbs(newBulbs)

    const interval = setInterval(() => {
      setGlowingBulbs(() => {
        const newGlowing = new Set<number>()
        for (let i = 0; i < 10; i++) {
          newGlowing.add(Math.floor(Math.random() * totalBulbs))
        }
        return newGlowing
      })
    }, 600)

    return () => clearInterval(interval)
  }, [])

  return (
    <div className="absolute inset-x-0 top-0 h-20 overflow-hidden pointer-events-none">
      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
        <defs>
          <linearGradient id="wireGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#374151" />
            <stop offset="50%" stopColor="#4b5563" />
            <stop offset="100%" stopColor="#374151" />
          </linearGradient>
        </defs>
        {/* Main wire with realistic drape */}
        <path
          d="M -2,50 Q 15,30 30,55 T 50,45 T 70,55 T 85,40 Q 95,35 102,50"
          fill="none"
          stroke="url(#wireGradient)"
          strokeWidth="0.4"
          className="dark:opacity-60"
        />
      </svg>

      {bulbs.map((bulb) => {
        const style = BULB_STYLES[bulb.colorIndex]
        const isGlowing = glowingBulbs.has(bulb.id)

        return (
          <div
            key={bulb.id}
            className="absolute transition-all duration-300"
            style={{
              left: `${bulb.x}%`,
              top: `${bulb.y}%`,
              transform: `translate(-50%, -50%) rotate(${bulb.rotation}deg)`,
              filter: isGlowing ? `drop-shadow(0 0 8px ${style.glow}) drop-shadow(0 0 12px ${style.glow})` : "none",
            }}
          >
            <svg viewBox="0 0 20 32" className="w-3 h-5 sm:w-4 sm:h-6">
              {/* Socket/Cap */}
              <rect x="6" y="0" width="8" height="6" rx="1" fill="#374151" />
              <rect x="7" y="1" width="6" height="2" rx="0.5" fill="#4b5563" />

              {/* Bulb with 3D gradient effect */}
              <defs>
                <radialGradient id={`bulbGrad${bulb.id}`} cx="30%" cy="30%" r="70%">
                  <stop offset="0%" stopColor={style.highlight} />
                  <stop offset="50%" stopColor={style.base} />
                  <stop offset="100%" stopColor={style.base} stopOpacity="0.8" />
                </radialGradient>
                {isGlowing && (
                  <filter id={`glow${bulb.id}`}>
                    <feGaussianBlur stdDeviation="1" result="coloredBlur" />
                    <feMerge>
                      <feMergeNode in="coloredBlur" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                )}
              </defs>

              {/* Main bulb shape - classic Christmas light */}
              <path
                d="M10 6 C5 6 3 10 3 14 C3 20 6 26 10 28 C14 26 17 20 17 14 C17 10 15 6 10 6"
                fill={`url(#bulbGrad${bulb.id})`}
                filter={isGlowing ? `url(#glow${bulb.id})` : undefined}
                opacity={isGlowing ? 1 : 0.85}
              />

              {/* Highlight reflection */}
              <ellipse cx="7" cy="12" rx="2" ry="3" fill="white" opacity={isGlowing ? 0.6 : 0.3} />
            </svg>
          </div>
        )
      })}

      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center">
        <Leaf className="w-5 h-5 sm:w-6 sm:h-6 text-green-600 -rotate-45 -mr-2" fill="currentColor" />
        <div className="flex gap-0.5 z-10">
          <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-gradient-to-br from-red-400 to-red-600 shadow-sm" />
          <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-gradient-to-br from-red-400 to-red-600 shadow-sm -mt-1" />
          <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-gradient-to-br from-red-400 to-red-600 shadow-sm" />
        </div>
        <Leaf className="w-5 h-5 sm:w-6 sm:h-6 text-green-600 rotate-45 -ml-2" fill="currentColor" />
      </div>
    </div>
  )
}

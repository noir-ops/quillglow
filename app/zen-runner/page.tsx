"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Play, Pause, RotateCcw, Volume2, VolumeX, Trophy } from "lucide-react"
import Link from "next/link"

interface Obstacle {
  x: number
  width: number
  height: number
  passed: boolean
}

interface Cloud {
  x: number
  y: number
  size: number
  speed: number
}

interface Tree {
  x: number
  height: number
  type: "small" | "medium" | "large"
}

interface Bird {
  x: number
  y: number
  wingUp: boolean
  speed: number
}

export default function ZenRunnerPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animationRef = useRef<number | null>(null)
  const lastTimeRef = useRef<number>(0)

  const [isRunning, setIsRunning] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [isGameOver, setIsGameOver] = useState(false)
  const [score, setScore] = useState(0)
  const [bestScore, setBestScore] = useState(0)
  const [soundEnabled, setSoundEnabled] = useState(false)

  // Game state refs (for animation loop)
  const gameStateRef = useRef({
    playerY: 0,
    playerVelocityY: 0,
    isJumping: false,
    obstacles: [] as Obstacle[],
    clouds: [] as Cloud[],
    trees: [] as Tree[],
    birds: [] as Bird[],
    groundOffset: 0,
    speed: 5,
    obstacleTimer: 0,
    birdTimer: 0,
    score: 0,
  })

  const GRAVITY = 0.6
  const JUMP_FORCE = -14
  const GROUND_HEIGHT = 80
  const PLAYER_WIDTH = 40
  const PLAYER_HEIGHT = 60

  // Load best score from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("quillglow-zen-runner-best")
    if (saved) {
      setBestScore(Number.parseInt(saved, 10))
    }
  }, [])

  // Initialize clouds and trees
  const initEnvironment = useCallback((canvas: HTMLCanvasElement) => {
    const state = gameStateRef.current
    state.clouds = []
    state.trees = []
    state.birds = []

    // Create initial clouds
    for (let i = 0; i < 6; i++) {
      state.clouds.push({
        x: Math.random() * canvas.width,
        y: 50 + Math.random() * 150,
        size: 30 + Math.random() * 40,
        speed: 0.3 + Math.random() * 0.5,
      })
    }

    // Create initial trees
    for (let i = 0; i < 8; i++) {
      const types: ("small" | "medium" | "large")[] = ["small", "medium", "large"]
      state.trees.push({
        x: i * 200 + Math.random() * 100,
        height: 60 + Math.random() * 80,
        type: types[Math.floor(Math.random() * 3)],
      })
    }
  }, [])

  // Get canvas dimensions
  const getCanvasDimensions = useCallback(() => {
    return {
      width: window.innerWidth,
      height: window.innerHeight,
    }
  }, [])

  // Draw cloud
  const drawCloud = (ctx: CanvasRenderingContext2D, x: number, y: number, size: number) => {
    ctx.fillStyle = "rgba(255, 255, 255, 0.8)"
    ctx.beginPath()
    ctx.arc(x, y, size * 0.5, 0, Math.PI * 2)
    ctx.arc(x + size * 0.4, y - size * 0.2, size * 0.4, 0, Math.PI * 2)
    ctx.arc(x + size * 0.8, y, size * 0.45, 0, Math.PI * 2)
    ctx.arc(x + size * 0.4, y + size * 0.15, size * 0.35, 0, Math.PI * 2)
    ctx.fill()
  }

  // Draw tree
  const drawTree = (ctx: CanvasRenderingContext2D, x: number, groundY: number, height: number, type: string) => {
    const trunkWidth = type === "large" ? 20 : type === "medium" ? 14 : 10
    const trunkHeight = height * 0.4
    const foliageRadius = height * 0.4

    // Trunk
    ctx.fillStyle = "#8B7355"
    ctx.fillRect(x - trunkWidth / 2, groundY - trunkHeight, trunkWidth, trunkHeight)

    // Foliage (multiple circles for natural look)
    const foliageColors = ["#4ADE80", "#22C55E", "#16A34A"]
    ctx.fillStyle = foliageColors[0]
    ctx.beginPath()
    ctx.arc(x, groundY - trunkHeight - foliageRadius * 0.5, foliageRadius, 0, Math.PI * 2)
    ctx.fill()

    ctx.fillStyle = foliageColors[1]
    ctx.beginPath()
    ctx.arc(x - foliageRadius * 0.5, groundY - trunkHeight - foliageRadius * 0.3, foliageRadius * 0.7, 0, Math.PI * 2)
    ctx.fill()

    ctx.fillStyle = foliageColors[2]
    ctx.beginPath()
    ctx.arc(x + foliageRadius * 0.5, groundY - trunkHeight - foliageRadius * 0.3, foliageRadius * 0.7, 0, Math.PI * 2)
    ctx.fill()
  }

  // Draw bird
  const drawBird = (ctx: CanvasRenderingContext2D, x: number, y: number, wingUp: boolean) => {
    ctx.strokeStyle = "#374151"
    ctx.lineWidth = 2
    ctx.lineCap = "round"

    // Body
    ctx.beginPath()
    ctx.moveTo(x - 8, y)
    ctx.lineTo(x + 8, y)
    ctx.stroke()

    // Wings
    ctx.beginPath()
    if (wingUp) {
      ctx.moveTo(x - 4, y)
      ctx.lineTo(x, y - 6)
      ctx.lineTo(x + 4, y)
    } else {
      ctx.moveTo(x - 4, y)
      ctx.lineTo(x, y + 4)
      ctx.lineTo(x + 4, y)
    }
    ctx.stroke()
  }

  // Draw pencil player
  const drawPlayer = (ctx: CanvasRenderingContext2D, x: number, y: number, isJumping: boolean) => {
    const tilt = isJumping ? -15 : 5

    ctx.save()
    ctx.translate(x + PLAYER_WIDTH / 2, y + PLAYER_HEIGHT / 2)
    ctx.rotate((tilt * Math.PI) / 180)

    // Pencil body (yellow)
    const gradient = ctx.createLinearGradient(-PLAYER_WIDTH / 2, 0, PLAYER_WIDTH / 2, 0)
    gradient.addColorStop(0, "#FCD34D")
    gradient.addColorStop(0.5, "#FBBF24")
    gradient.addColorStop(1, "#F59E0B")
    ctx.fillStyle = gradient
    ctx.fillRect(-PLAYER_WIDTH / 2 + 8, -PLAYER_HEIGHT / 2 + 10, PLAYER_WIDTH - 16, PLAYER_HEIGHT - 20)

    // Pencil tip
    ctx.fillStyle = "#FEF3C7"
    ctx.beginPath()
    ctx.moveTo(-PLAYER_WIDTH / 2 + 8, PLAYER_HEIGHT / 2 - 10)
    ctx.lineTo(0, PLAYER_HEIGHT / 2 + 5)
    ctx.lineTo(PLAYER_WIDTH / 2 - 8, PLAYER_HEIGHT / 2 - 10)
    ctx.closePath()
    ctx.fill()

    // Graphite tip
    ctx.fillStyle = "#374151"
    ctx.beginPath()
    ctx.moveTo(-3, PLAYER_HEIGHT / 2)
    ctx.lineTo(0, PLAYER_HEIGHT / 2 + 5)
    ctx.lineTo(3, PLAYER_HEIGHT / 2)
    ctx.closePath()
    ctx.fill()

    // Eraser
    ctx.fillStyle = "#F472B6"
    ctx.fillRect(-PLAYER_WIDTH / 2 + 8, -PLAYER_HEIGHT / 2 + 10, PLAYER_WIDTH - 16, 12)

    // Metal band
    ctx.fillStyle = "#9CA3AF"
    ctx.fillRect(-PLAYER_WIDTH / 2 + 8, -PLAYER_HEIGHT / 2 + 22, PLAYER_WIDTH - 16, 6)

    // Glow effect
    ctx.shadowColor = "#FBBF24"
    ctx.shadowBlur = 15
    ctx.strokeStyle = "rgba(251, 191, 36, 0.5)"
    ctx.lineWidth = 2
    ctx.strokeRect(-PLAYER_WIDTH / 2 + 6, -PLAYER_HEIGHT / 2 + 8, PLAYER_WIDTH - 12, PLAYER_HEIGHT - 14)

    ctx.restore()
  }

  // Draw book obstacle
  const drawObstacle = (ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number) => {
    // Book cover
    const colors = ["#818CF8", "#A78BFA", "#C084FC", "#60A5FA", "#34D399"]
    const color = colors[Math.floor(x / 100) % colors.length]

    ctx.fillStyle = color
    ctx.fillRect(x, y, width, height)

    // Book spine shadow
    ctx.fillStyle = "rgba(0,0,0,0.2)"
    ctx.fillRect(x, y, 5, height)

    // Book pages
    ctx.fillStyle = "#FEF9EF"
    ctx.fillRect(x + 5, y + 3, width - 10, height - 6)

    // Page lines
    ctx.strokeStyle = "#E5E7EB"
    ctx.lineWidth = 1
    for (let i = 0; i < 3; i++) {
      ctx.beginPath()
      ctx.moveTo(x + 8, y + 8 + i * 10)
      ctx.lineTo(x + width - 8, y + 8 + i * 10)
      ctx.stroke()
    }
  }

  // Main game loop
  const gameLoop = useCallback(
    (timestamp: number) => {
      if (!canvasRef.current) return

      const canvas = canvasRef.current
      const ctx = canvas.getContext("2d")
      if (!ctx) return

      const deltaTime = timestamp - lastTimeRef.current
      lastTimeRef.current = timestamp

      const state = gameStateRef.current
      const { width, height } = getCanvasDimensions()

      canvas.width = width
      canvas.height = height

      const groundY = height - GROUND_HEIGHT

      // Clear canvas with gradient sky
      const skyGradient = ctx.createLinearGradient(0, 0, 0, height)
      skyGradient.addColorStop(0, "#C7D2FE") // Soft indigo
      skyGradient.addColorStop(0.4, "#E0E7FF") // Lighter
      skyGradient.addColorStop(0.7, "#FDF4FF") // Soft pink
      skyGradient.addColorStop(1, "#FCE7F3") // Pink at horizon
      ctx.fillStyle = skyGradient
      ctx.fillRect(0, 0, width, height)

      // Update and draw clouds
      state.clouds.forEach((cloud) => {
        cloud.x -= cloud.speed
        if (cloud.x < -100) {
          cloud.x = width + 50
          cloud.y = 50 + Math.random() * 150
        }
        drawCloud(ctx, cloud.x, cloud.y, cloud.size)
      })

      // Update and draw trees (background)
      state.trees.forEach((tree) => {
        tree.x -= state.speed * 0.3
        if (tree.x < -100) {
          tree.x = width + 100 + Math.random() * 200
        }
        drawTree(ctx, tree.x, groundY, tree.height, tree.type)
      })

      // Update and draw birds
      state.birdTimer += deltaTime
      if (state.birdTimer > 3000 && state.birds.length < 5) {
        state.birds.push({
          x: width + 50,
          y: 80 + Math.random() * 150,
          wingUp: true,
          speed: 2 + Math.random() * 2,
        })
        state.birdTimer = 0
      }

      state.birds = state.birds.filter((bird) => {
        bird.x -= bird.speed
        bird.wingUp = Math.sin(Date.now() / 100 + bird.x) > 0
        drawBird(ctx, bird.x, bird.y, bird.wingUp)
        return bird.x > -20
      })

      // Draw ground
      const groundGradient = ctx.createLinearGradient(0, groundY, 0, height)
      groundGradient.addColorStop(0, "#86EFAC")
      groundGradient.addColorStop(0.3, "#4ADE80")
      groundGradient.addColorStop(1, "#22C55E")
      ctx.fillStyle = groundGradient
      ctx.fillRect(0, groundY, width, GROUND_HEIGHT)

      // Ground detail line
      ctx.strokeStyle = "#16A34A"
      ctx.lineWidth = 3
      ctx.beginPath()
      ctx.moveTo(0, groundY)
      ctx.lineTo(width, groundY)
      ctx.stroke()

      // Grass tufts
      ctx.strokeStyle = "#15803D"
      ctx.lineWidth = 2
      for (let i = 0; i < width; i += 30) {
        const offset = (state.groundOffset + i) % 30
        ctx.beginPath()
        ctx.moveTo(offset, groundY)
        ctx.lineTo(offset - 3, groundY - 8)
        ctx.moveTo(offset, groundY)
        ctx.lineTo(offset + 3, groundY - 6)
        ctx.stroke()
      }

      if (!isPaused && isRunning && !isGameOver) {
        // Update ground offset
        state.groundOffset = (state.groundOffset + state.speed) % 30

        // Apply gravity
        state.playerVelocityY += GRAVITY
        state.playerY += state.playerVelocityY

        // Ground collision
        if (state.playerY >= groundY - PLAYER_HEIGHT) {
          state.playerY = groundY - PLAYER_HEIGHT
          state.playerVelocityY = 0
          state.isJumping = false
        }

        // Spawn obstacles
        state.obstacleTimer += deltaTime
        const spawnInterval = state.score > 1000 ? 1200 : 1800
        if (state.obstacleTimer > spawnInterval) {
          const obstacleHeight = 40 + Math.random() * 30
          state.obstacles.push({
            x: width + 50,
            width: 35 + Math.random() * 20,
            height: obstacleHeight,
            passed: false,
          })
          state.obstacleTimer = 0
        }

        // Update obstacles
        state.obstacles = state.obstacles.filter((obstacle) => {
          obstacle.x -= state.speed
          return obstacle.x > -100
        })

        // Check collisions and scoring
        const playerX = 80
        state.obstacles.forEach((obstacle) => {
          // Score when passing
          if (!obstacle.passed && obstacle.x + obstacle.width < playerX) {
            obstacle.passed = true
            state.score += 10
            setScore(state.score)
          }

          // Collision detection
          const obstacleY = groundY - obstacle.height
          if (
            playerX + PLAYER_WIDTH - 10 > obstacle.x &&
            playerX + 10 < obstacle.x + obstacle.width &&
            state.playerY + PLAYER_HEIGHT - 5 > obstacleY
          ) {
            setIsGameOver(true)
            setIsRunning(false)

            // Update best score
            if (state.score > bestScore) {
              setBestScore(state.score)
              localStorage.setItem("quillglow-zen-runner-best", state.score.toString())
            }
          }
        })

        // Increase speed gradually (more after 1000)
        if (state.score > 1000) {
          state.speed = Math.min(12, 6 + (state.score - 1000) / 500)
        } else {
          state.speed = Math.min(6, 5 + state.score / 1000)
        }

        // Score tick
        state.score += 0.1
        setScore(Math.floor(state.score))
      }

      // Draw obstacles
      state.obstacles.forEach((obstacle) => {
        drawObstacle(ctx, obstacle.x, groundY - obstacle.height, obstacle.width, obstacle.height)
      })

      // Draw player
      drawPlayer(ctx, 80, state.playerY, state.isJumping)

      // Continue loop
      if (isRunning && !isGameOver) {
        animationRef.current = requestAnimationFrame(gameLoop)
      }
    },
    [isPaused, isRunning, isGameOver, bestScore, getCanvasDimensions],
  )

  // Start game loop
  useEffect(() => {
    if (isRunning && !isGameOver) {
      lastTimeRef.current = performance.now()
      animationRef.current = requestAnimationFrame(gameLoop)
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [isRunning, isGameOver, gameLoop])

  // Handle resize
  useEffect(() => {
    const handleResize = () => {
      if (canvasRef.current) {
        const { width, height } = getCanvasDimensions()
        canvasRef.current.width = width
        canvasRef.current.height = height
      }
    }

    window.addEventListener("resize", handleResize)
    handleResize()

    return () => window.removeEventListener("resize", handleResize)
  }, [getCanvasDimensions])

  // Jump handler
  const handleJump = useCallback(() => {
    if (isGameOver) {
      handleRestart()
      return
    }

    if (!isRunning) {
      handleStart()
      return
    }

    const state = gameStateRef.current
    if (!state.isJumping && !isPaused) {
      state.playerVelocityY = JUMP_FORCE
      state.isJumping = true
    }
  }, [isGameOver, isRunning, isPaused])

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        e.preventDefault()
        handleJump()
      } else if (e.code === "KeyP" && isRunning && !isGameOver) {
        setIsPaused((p) => !p)
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [handleJump, isRunning, isGameOver])

  // Start game
  const handleStart = () => {
    const canvas = canvasRef.current
    if (!canvas) return

    const { height } = getCanvasDimensions()
    const groundY = height - GROUND_HEIGHT

    gameStateRef.current = {
      playerY: groundY - PLAYER_HEIGHT,
      playerVelocityY: 0,
      isJumping: false,
      obstacles: [],
      clouds: gameStateRef.current.clouds,
      trees: gameStateRef.current.trees,
      birds: [],
      groundOffset: 0,
      speed: 5,
      obstacleTimer: 0,
      birdTimer: 0,
      score: 0,
    }

    initEnvironment(canvas)
    setScore(0)
    setIsGameOver(false)
    setIsPaused(false)
    setIsRunning(true)
  }

  // Restart game
  const handleRestart = () => {
    handleStart()
  }

  // Initial render
  useEffect(() => {
    const canvas = canvasRef.current
    if (canvas) {
      const { width, height } = getCanvasDimensions()
      canvas.width = width
      canvas.height = height

      const groundY = height - GROUND_HEIGHT
      gameStateRef.current.playerY = groundY - PLAYER_HEIGHT

      initEnvironment(canvas)

      // Initial draw
      const ctx = canvas.getContext("2d")
      if (ctx) {
        // Draw initial scene
        const skyGradient = ctx.createLinearGradient(0, 0, 0, height)
        skyGradient.addColorStop(0, "#C7D2FE")
        skyGradient.addColorStop(0.4, "#E0E7FF")
        skyGradient.addColorStop(0.7, "#FDF4FF")
        skyGradient.addColorStop(1, "#FCE7F3")
        ctx.fillStyle = skyGradient
        ctx.fillRect(0, 0, width, height)

        gameStateRef.current.clouds.forEach((cloud) => {
          drawCloud(ctx, cloud.x, cloud.y, cloud.size)
        })

        gameStateRef.current.trees.forEach((tree) => {
          drawTree(ctx, tree.x, groundY, tree.height, tree.type)
        })

        const groundGradient = ctx.createLinearGradient(0, groundY, 0, height)
        groundGradient.addColorStop(0, "#86EFAC")
        groundGradient.addColorStop(0.3, "#4ADE80")
        groundGradient.addColorStop(1, "#22C55E")
        ctx.fillStyle = groundGradient
        ctx.fillRect(0, groundY, width, GROUND_HEIGHT)

        drawPlayer(ctx, 80, groundY - PLAYER_HEIGHT, false)
      }
    }
  }, [getCanvasDimensions, initEnvironment])

  return (
    <div className="fixed inset-0 overflow-hidden bg-gradient-to-b from-indigo-100 via-purple-50 to-pink-100">
      {/* Game Canvas */}
      <canvas
        ref={canvasRef}
        onClick={handleJump}
        onTouchStart={(e) => {
          e.preventDefault()
          handleJump()
        }}
        className="absolute inset-0 cursor-pointer touch-none"
      />

      {/* UI Overlay */}
      <div className="pointer-events-none absolute inset-0 flex flex-col">
        {/* Top Bar */}
        <div className="pointer-events-auto flex items-start justify-between p-3 sm:p-4">
          {/* Back Button */}
          <Link href="/timer?tab=calm">
            <Button
              variant="outline"
              size="sm"
              className="border-white/50 bg-white/80 shadow-lg backdrop-blur-sm hover:bg-white"
            >
              <ArrowLeft className="mr-1 h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Back</span>
            </Button>
          </Link>

          {/* Score Display */}
          <div className="flex flex-col items-end gap-2">
            <div className="rounded-xl border border-white/50 bg-white/80 px-3 py-1.5 shadow-lg backdrop-blur-sm sm:px-4 sm:py-2">
              <div className="text-xs text-muted-foreground sm:text-sm">Score</div>
              <div className="text-xl font-bold text-primary sm:text-2xl">{score}</div>
            </div>
            <div className="flex items-center gap-1.5 rounded-lg border border-white/50 bg-white/80 px-2 py-1 shadow-lg backdrop-blur-sm sm:gap-2 sm:px-3 sm:py-1.5">
              <Trophy className="h-3 w-3 text-amber-500 sm:h-4 sm:w-4" />
              <span className="text-xs font-medium sm:text-sm">{bestScore}</span>
            </div>
          </div>
        </div>

        {/* Center Content */}
        <div className="flex flex-1 items-center justify-center">
          {/* Start Screen */}
          {!isRunning && !isGameOver && (
            <div className="pointer-events-auto text-center">
              <div className="mb-4 rounded-2xl border border-white/50 bg-white/90 p-6 shadow-2xl backdrop-blur-sm sm:mb-6 sm:p-8">
                <h1 className="mb-2 bg-gradient-to-r from-primary to-purple-500 bg-clip-text text-2xl font-bold text-transparent sm:text-4xl">
                  QuillGlow Zen Runner
                </h1>
                <p className="mb-4 text-sm text-muted-foreground sm:mb-6 sm:text-base">
                  A calm little break between study sessions
                </p>
                <Button onClick={handleStart} size="lg" className="gap-2 text-base sm:text-lg">
                  <Play className="h-5 w-5" />
                  Start Game
                </Button>
                <p className="mt-4 text-xs text-muted-foreground sm:text-sm">Tap anywhere or press SPACE to jump</p>
              </div>
            </div>
          )}

          {/* Paused Overlay */}
          {isPaused && isRunning && (
            <div className="pointer-events-auto text-center">
              <div className="rounded-2xl border border-white/50 bg-white/90 p-6 shadow-2xl backdrop-blur-sm sm:p-8">
                <h2 className="mb-4 text-xl font-bold text-foreground sm:text-2xl">Paused</h2>
                <Button onClick={() => setIsPaused(false)} size="lg" className="gap-2">
                  <Play className="h-5 w-5" />
                  Resume
                </Button>
              </div>
            </div>
          )}

          {/* Game Over */}
          {isGameOver && (
            <div className="pointer-events-auto text-center">
              <div className="rounded-2xl border border-white/50 bg-white/90 p-6 shadow-2xl backdrop-blur-sm sm:p-8">
                <h2 className="mb-2 text-xl font-bold text-foreground sm:text-2xl">Game Over</h2>
                <p className="mb-1 text-2xl font-bold text-primary sm:text-3xl">{score}</p>
                {score >= bestScore && score > 0 && (
                  <p className="mb-3 text-xs font-medium text-amber-500 sm:text-sm">New Best Score!</p>
                )}
                <p className="mb-4 text-xs text-muted-foreground sm:text-sm">Best: {bestScore}</p>
                <Button onClick={handleRestart} size="lg" className="gap-2">
                  <RotateCcw className="h-5 w-5" />
                  Play Again
                </Button>
                <p className="mt-3 text-xs text-muted-foreground">Tap anywhere or press SPACE</p>
              </div>
            </div>
          )}
        </div>

        {/* Bottom Controls */}
        {isRunning && !isGameOver && (
          <div className="pointer-events-auto flex justify-center gap-2 p-3 sm:gap-3 sm:p-4">
            <Button
              onClick={() => setIsPaused((p) => !p)}
              variant="outline"
              size="sm"
              className="border-white/50 bg-white/80 shadow-lg backdrop-blur-sm hover:bg-white"
            >
              {isPaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
            </Button>
            <Button
              onClick={() => setSoundEnabled((s) => !s)}
              variant="outline"
              size="sm"
              className="border-white/50 bg-white/80 shadow-lg backdrop-blur-sm hover:bg-white"
            >
              {soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
            </Button>
          </div>
        )}

        {/* Instructions hint */}
        {isRunning && !isPaused && !isGameOver && (
          <div className="absolute bottom-16 left-1/2 -translate-x-1/2 text-center sm:bottom-20">
            <p className="text-xs text-muted-foreground/70 sm:text-sm">Tap to jump over the books!</p>
          </div>
        )}
      </div>
    </div>
  )
}

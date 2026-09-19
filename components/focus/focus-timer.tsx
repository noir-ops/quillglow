"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { Play, Pause, RotateCcw, Volume2, VolumeX, CheckCircle2, Clock, Timer, Home, Settings, X, Waves, CloudRain, Wind, Coffee, Droplets, ChevronDown, Sparkles, ChevronUp, ListTodo, Eye, EyeOff, Circle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createBrowserClient } from "@/lib/supabase/client"
import Link from "next/link"

type TimerMode = "focus" | "shortBreak" | "longBreak"
type PomodoroTheme = "default" | "darkCalm" | "softGradient"
type AmbientSoundType = "off" | "whiteNoise" | "brownNoise" | "pinkNoise" | "rain" | "lightRain" | "cafe" | "wind" | "ocean"

interface Task {
  id: string
  title: string
  description: string | null
  subject: string | null
  priority: string
  completed: boolean
}

interface PomodoroPreferences {
  focusDuration: number
  breakDuration: number
  longBreakDuration: number
  theme: PomodoroTheme
}

interface AmbientSoundSettings {
  soundType: AmbientSoundType
  volume: number
  enabled: boolean
}

const AMBIENT_SOUNDS: { type: AmbientSoundType; label: string; icon: string }[] = [
  { type: "off", label: "Silence", icon: "off" },
  { type: "whiteNoise", label: "White Noise", icon: "waves" },
  { type: "brownNoise", label: "Brown Noise", icon: "waves" },
  { type: "pinkNoise", label: "Pink Noise", icon: "waves" },
  { type: "rain", label: "Rain", icon: "rain" },
  { type: "lightRain", label: "Light Rain", icon: "droplets" },
  { type: "cafe", label: "Cafe Ambience", icon: "coffee" },
  { type: "wind", label: "Wind / Nature", icon: "wind" },
  { type: "ocean", label: "Ocean Waves", icon: "ocean" },
]

const STORAGE_KEY = "quillglow_pomodoro_preferences"
const AMBIENT_SOUND_KEY = "quillglow_ambient_sound_settings"
const TASK_PANEL_KEY = "quillglow_task_panel_visible"

const DEFAULT_AMBIENT_SOUND: AmbientSoundSettings = {
  soundType: "off",
  volume: 30,
  enabled: false,
}

const DEFAULT_PREFERENCES: PomodoroPreferences = {
  focusDuration: 25,
  breakDuration: 5,
  longBreakDuration: 15,
  theme: "default",
}

const BACKGROUND_IMAGES = [
  "/timer-background-1.jpg",
  "/timer-background-2.jpg",
  "/timer-background-3.jpg",
  "/timer-background-4.jpg",
]

const THEME_STYLES: Record<PomodoroTheme, { overlay: string }> = {
  default: { overlay: "bg-gradient-to-t from-black/60 via-black/20 to-black/40" },
  darkCalm: { overlay: "" },
  softGradient: { overlay: "bg-black/10" },
}

export function FocusTimer() {
  const [mode, setMode] = useState<TimerMode>("focus")
  const [timeLeft, setTimeLeft] = useState(25 * 60)
  const [isRunning, setIsRunning] = useState(false)
  const [currentTime, setCurrentTime] = useState(new Date())
  const [tasks, setTasks] = useState<Task[]>([])
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [sessionsCompleted, setSessionsCompleted] = useState(0)
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null)
  const [sessionStartTime, setSessionStartTime] = useState<number | null>(null)
  const supabase = createBrowserClient()

  const [showSettings, setShowSettings] = useState(false)
  const [preferences, setPreferences] = useState<PomodoroPreferences>(DEFAULT_PREFERENCES)

  // Task panel visibility (collapsible)
  const [taskPanelVisible, setTaskPanelVisible] = useState(true)
  // Show all tasks or just active + "up next"
  const [showAllTasks, setShowAllTasks] = useState(false)

  // For default theme cycling backgrounds
  const [bgIndex, setBgIndex] = useState(0)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  // Ambient sound
  const [ambientSound, setAmbientSound] = useState<AmbientSoundSettings>(DEFAULT_AMBIENT_SOUND)
  const [showSoundPicker, setShowSoundPicker] = useState(false)
  const audioContextRef = useRef<AudioContext | null>(null)
  const ambientNodesRef = useRef<AudioNode[]>([])
  const gainNodeRef = useRef<GainNode | null>(null)
  const isAmbientPlaying = useRef(false)
  const currentSoundTypeRef = useRef<AmbientSoundType>("off")

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as PomodoroPreferences
        setPreferences(parsed)
        setTimeLeft(parsed.focusDuration * 60)
      } catch (e) {
        console.error("Failed to parse stored preferences")
      }
    }
    const storedAmbient = localStorage.getItem(AMBIENT_SOUND_KEY)
    if (storedAmbient) {
      try {
        const parsed = JSON.parse(storedAmbient) as AmbientSoundSettings
        setAmbientSound(parsed)
      } catch (e) {
        console.error("Failed to parse ambient sound settings")
      }
    }
    // Restore task panel visibility
    const storedPanel = localStorage.getItem(TASK_PANEL_KEY)
    if (storedPanel !== null) {
      setTaskPanelVisible(storedPanel === "true")
    }
  }, [])

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences))
  }, [preferences])

  useEffect(() => {
    localStorage.setItem(AMBIENT_SOUND_KEY, JSON.stringify(ambientSound))
  }, [ambientSound])

  useEffect(() => {
    localStorage.setItem(TASK_PANEL_KEY, String(taskPanelVisible))
  }, [taskPanelVisible])

  const getDuration = (timerMode: TimerMode): number => {
    switch (timerMode) {
      case "focus": return preferences.focusDuration * 60
      case "shortBreak": return preferences.breakDuration * 60
      case "longBreak": return preferences.longBreakDuration * 60
    }
  }

  const createWhiteNoiseSource = useCallback((ctx: AudioContext) => {
    const bufferSize = 2 * ctx.sampleRate
    const buffer = ctx.createBuffer(2, bufferSize, ctx.sampleRate)
    for (let ch = 0; ch < 2; ch++) {
      const data = buffer.getChannelData(ch)
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1
      }
    }
    const src = ctx.createBufferSource()
    src.buffer = buffer
    src.loop = true
    src.start()
    return src
  }, [])

  const buildSoundGraph = useCallback((ctx: AudioContext, soundType: AmbientSoundType, destination: AudioNode): AudioNode[] => {
    const nodes: AudioNode[] = []

    if (soundType === "whiteNoise") {
      const src = createWhiteNoiseSource(ctx)
      nodes.push(src)
      const hs = ctx.createBiquadFilter()
      hs.type = "highshelf"
      hs.frequency.value = 8000
      hs.gain.value = -3
      src.connect(hs)
      hs.connect(destination)
      nodes.push(hs)
    } else if (soundType === "brownNoise") {
      const src = createWhiteNoiseSource(ctx)
      nodes.push(src)
      const lp1 = ctx.createBiquadFilter()
      lp1.type = "lowpass"; lp1.frequency.value = 400; lp1.Q.value = 0.5
      const lp2 = ctx.createBiquadFilter()
      lp2.type = "lowpass"; lp2.frequency.value = 800; lp2.Q.value = 0.5
      const boostGain = ctx.createGain()
      boostGain.gain.value = 4.0
      src.connect(lp1); lp1.connect(lp2); lp2.connect(boostGain); boostGain.connect(destination)
      nodes.push(lp1, lp2, boostGain)
    } else if (soundType === "pinkNoise") {
      const src = createWhiteNoiseSource(ctx)
      nodes.push(src)
      const f1 = ctx.createBiquadFilter(); f1.type = "lowshelf"; f1.frequency.value = 200; f1.gain.value = 6
      const f2 = ctx.createBiquadFilter(); f2.type = "highshelf"; f2.frequency.value = 4000; f2.gain.value = -8
      const f3 = ctx.createBiquadFilter(); f3.type = "peaking"; f3.frequency.value = 1000; f3.Q.value = 0.5; f3.gain.value = 2
      const pinkGain = ctx.createGain(); pinkGain.gain.value = 1.5
      src.connect(f1); f1.connect(f2); f2.connect(f3); f3.connect(pinkGain); pinkGain.connect(destination)
      nodes.push(f1, f2, f3, pinkGain)
    } else if (soundType === "rain") {
      const rainSrc = createWhiteNoiseSource(ctx); nodes.push(rainSrc)
      const bp1 = ctx.createBiquadFilter(); bp1.type = "bandpass"; bp1.frequency.value = 3000; bp1.Q.value = 0.4
      const bp2 = ctx.createBiquadFilter(); bp2.type = "highpass"; bp2.frequency.value = 800; bp2.Q.value = 0.3
      const rainGain = ctx.createGain(); rainGain.gain.value = 2.5
      rainSrc.connect(bp1); bp1.connect(bp2); bp2.connect(rainGain); rainGain.connect(destination)
      nodes.push(bp1, bp2, rainGain)
      const rumbleSrc = createWhiteNoiseSource(ctx); nodes.push(rumbleSrc)
      const rumbleLp = ctx.createBiquadFilter(); rumbleLp.type = "lowpass"; rumbleLp.frequency.value = 200; rumbleLp.Q.value = 0.7
      const rumbleGain = ctx.createGain(); rumbleGain.gain.value = 1.5
      const rumbleLfo = ctx.createOscillator(); rumbleLfo.type = "sine"; rumbleLfo.frequency.value = 0.15
      const rumbleLfoGain = ctx.createGain(); rumbleLfoGain.gain.value = 0.6
      rumbleLfo.connect(rumbleLfoGain); rumbleLfoGain.connect(rumbleGain.gain); rumbleLfo.start()
      rumbleSrc.connect(rumbleLp); rumbleLp.connect(rumbleGain); rumbleGain.connect(destination)
      nodes.push(rumbleLp, rumbleGain, rumbleLfo, rumbleLfoGain)
      const splashSrc = createWhiteNoiseSource(ctx); nodes.push(splashSrc)
      const splashHp = ctx.createBiquadFilter(); splashHp.type = "highpass"; splashHp.frequency.value = 6000
      const splashGain = ctx.createGain(); splashGain.gain.value = 0.5
      splashSrc.connect(splashHp); splashHp.connect(splashGain); splashGain.connect(destination)
      nodes.push(splashHp, splashGain)
    } else if (soundType === "lightRain") {
      const src = createWhiteNoiseSource(ctx); nodes.push(src)
      const hp = ctx.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 3000; hp.Q.value = 0.3
      const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 8000; lp.Q.value = 0.5
      const lightGain = ctx.createGain(); lightGain.gain.value = 0.8
      src.connect(hp); hp.connect(lp); lp.connect(lightGain); lightGain.connect(destination)
      nodes.push(hp, lp, lightGain)
      const dripSrc = createWhiteNoiseSource(ctx); nodes.push(dripSrc)
      const dripBp = ctx.createBiquadFilter(); dripBp.type = "bandpass"; dripBp.frequency.value = 5000; dripBp.Q.value = 3
      const dripGain = ctx.createGain(); dripGain.gain.value = 0.15
      const dripLfo = ctx.createOscillator(); dripLfo.type = "sine"; dripLfo.frequency.value = 0.5
      const dripLfoGain = ctx.createGain(); dripLfoGain.gain.value = 0.1
      dripLfo.connect(dripLfoGain); dripLfoGain.connect(dripGain.gain); dripLfo.start()
      dripSrc.connect(dripBp); dripBp.connect(dripGain); dripGain.connect(destination)
      nodes.push(dripBp, dripGain, dripLfo, dripLfoGain)
    } else if (soundType === "ocean") {
      const waveSrc = createWhiteNoiseSource(ctx); nodes.push(waveSrc)
      const waveLp = ctx.createBiquadFilter(); waveLp.type = "lowpass"; waveLp.frequency.value = 1500; waveLp.Q.value = 0.3
      const waveGain = ctx.createGain(); waveGain.gain.value = 0
      const waveLfo = ctx.createOscillator(); waveLfo.type = "sine"; waveLfo.frequency.value = 0.12
      const waveLfoGain = ctx.createGain(); waveLfoGain.gain.value = 1.8
      const waveLfoOffset = ctx.createConstantSource(); waveLfoOffset.offset.value = 1.8
      waveLfo.connect(waveLfoGain); waveLfoGain.connect(waveGain.gain); waveLfoOffset.connect(waveGain.gain)
      waveLfo.start(); waveLfoOffset.start()
      waveSrc.connect(waveLp); waveLp.connect(waveGain); waveGain.connect(destination)
      nodes.push(waveLp, waveGain, waveLfo, waveLfoGain, waveLfoOffset)
      const foamSrc = createWhiteNoiseSource(ctx); nodes.push(foamSrc)
      const foamHp = ctx.createBiquadFilter(); foamHp.type = "highpass"; foamHp.frequency.value = 2000
      const foamLp = ctx.createBiquadFilter(); foamLp.type = "lowpass"; foamLp.frequency.value = 7000
      const foamGain = ctx.createGain(); foamGain.gain.value = 0
      const foamLfo = ctx.createOscillator(); foamLfo.type = "sine"; foamLfo.frequency.value = 0.12
      const foamLfoGain = ctx.createGain(); foamLfoGain.gain.value = 0.6
      const foamOffset = ctx.createConstantSource(); foamOffset.offset.value = 0.5
      foamLfo.connect(foamLfoGain); foamLfoGain.connect(foamGain.gain); foamOffset.connect(foamGain.gain)
      foamLfo.start(); foamOffset.start()
      foamSrc.connect(foamHp); foamHp.connect(foamLp); foamLp.connect(foamGain); foamGain.connect(destination)
      nodes.push(foamHp, foamLp, foamGain, foamLfo, foamLfoGain, foamOffset)
      const subSrc = createWhiteNoiseSource(ctx); nodes.push(subSrc)
      const subLp = ctx.createBiquadFilter(); subLp.type = "lowpass"; subLp.frequency.value = 150
      const subGain = ctx.createGain(); subGain.gain.value = 1.2
      subSrc.connect(subLp); subLp.connect(subGain); subGain.connect(destination)
      nodes.push(subLp, subGain)
    } else if (soundType === "wind") {
      fetch("/wind-ambient.mp3")
        .then((r) => r.arrayBuffer())
        .then((ab) => ctx.decodeAudioData(ab))
        .then((audioBuffer) => {
          if (currentSoundTypeRef.current === "wind" && isAmbientPlaying.current) {
            const windSource = ctx.createBufferSource()
            windSource.buffer = audioBuffer; windSource.loop = true
            windSource.connect(destination); windSource.start()
            nodes.push(windSource); ambientNodesRef.current.push(windSource)
          }
        })
        .catch(() => {
          const fb = createWhiteNoiseSource(ctx)
          const fbBp = ctx.createBiquadFilter(); fbBp.type = "bandpass"; fbBp.frequency.value = 600; fbBp.Q.value = 0.8
          const fbGain = ctx.createGain(); fbGain.gain.value = 2.0
          fb.connect(fbBp); fbBp.connect(fbGain); fbGain.connect(destination)
          nodes.push(fb, fbBp, fbGain); ambientNodesRef.current.push(fb, fbBp, fbGain)
        })
    } else if (soundType === "cafe") {
      fetch("/cafe-ambient.mp3")
        .then((r) => r.arrayBuffer())
        .then((ab) => ctx.decodeAudioData(ab))
        .then((audioBuffer) => {
          if (currentSoundTypeRef.current === "cafe" && isAmbientPlaying.current) {
            const cafeSource = ctx.createBufferSource()
            cafeSource.buffer = audioBuffer; cafeSource.loop = true
            cafeSource.connect(destination); cafeSource.start()
            nodes.push(cafeSource); ambientNodesRef.current.push(cafeSource)
          }
        })
        .catch(() => {
          const fb = createWhiteNoiseSource(ctx)
          const fbLp = ctx.createBiquadFilter(); fbLp.type = "lowpass"; fbLp.frequency.value = 800; fbLp.Q.value = 0.5
          const fbGain = ctx.createGain(); fbGain.gain.value = 1.5
          fb.connect(fbLp); fbLp.connect(fbGain); fbGain.connect(destination)
          nodes.push(fb, fbLp, fbGain); ambientNodesRef.current.push(fb, fbLp, fbGain)
        })
    }
    return nodes
  }, [createWhiteNoiseSource])

  const stopAmbientSound = useCallback(() => {
    if (!isAmbientPlaying.current) return
    try {
      for (const node of ambientNodesRef.current) {
        try {
          if ("stop" in node && typeof (node as AudioBufferSourceNode).stop === "function") {
            (node as AudioBufferSourceNode).stop()
          }
          node.disconnect()
        } catch {}
      }
      ambientNodesRef.current = []
      if (gainNodeRef.current) { gainNodeRef.current.disconnect(); gainNodeRef.current = null }
      isAmbientPlaying.current = false
      currentSoundTypeRef.current = "off"
    } catch {}
  }, [])

  const startAmbientSound = useCallback((soundType: AmbientSoundType, volume: number) => {
    if (soundType === "off") { stopAmbientSound(); return }
    if (isAmbientPlaying.current && currentSoundTypeRef.current === soundType) return
    stopAmbientSound()
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
      }
      const ctx = audioContextRef.current
      if (ctx.state === "suspended") ctx.resume()
      const gainNode = ctx.createGain()
      gainNode.gain.value = volume / 100
      gainNode.connect(ctx.destination)
      gainNodeRef.current = gainNode
      const graphNodes = buildSoundGraph(ctx, soundType, gainNode)
      ambientNodesRef.current = graphNodes
      isAmbientPlaying.current = true
      currentSoundTypeRef.current = soundType
    } catch (e) { console.error("Failed to start ambient sound:", e) }
  }, [buildSoundGraph, stopAmbientSound])

  useEffect(() => {
    const shouldPlay = ambientSound.enabled && ambientSound.soundType !== "off" && isRunning && mode === "focus"
    if (shouldPlay) { startAmbientSound(ambientSound.soundType, ambientSound.volume) }
    else { stopAmbientSound() }
  }, [ambientSound.enabled, ambientSound.soundType, isRunning, mode, startAmbientSound, stopAmbientSound])

  useEffect(() => {
    if (gainNodeRef.current) { gainNodeRef.current.gain.value = ambientSound.volume / 100 }
  }, [ambientSound.volume])

  useEffect(() => {
    return () => {
      stopAmbientSound()
      if (audioContextRef.current) { audioContextRef.current.close(); audioContextRef.current = null }
    }
  }, [stopAmbientSound])

  const updateAmbientSound = useCallback((updates: Partial<AmbientSoundSettings>) => {
    setAmbientSound(prev => {
      const next = { ...prev, ...updates }
      if (updates.soundType && updates.soundType !== "off") next.enabled = true
      if (updates.soundType === "off") next.enabled = false
      return next
    })
  }, [])

  useEffect(() => {
    const interval = setInterval(() => { setCurrentTime(new Date()) }, 1000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    const fetchTasks = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase
        .from("tasks")
        .select("*")
        .eq("user_id", user.id)
        .eq("completed", false)
        .order("due_date", { ascending: true })
        .limit(10)
      if (data) {
        setTasks(data)
        if (data.length > 0 && !selectedTask) {
          setSelectedTask(data[0])
        }
      }
    }
    fetchTasks()
  }, [supabase, selectedTask])

  useEffect(() => {
    let interval: NodeJS.Timeout
    if (isRunning && timeLeft > 0) {
      interval = setInterval(() => { setTimeLeft((prev) => prev - 1) }, 1000)
    } else if (timeLeft === 0) {
      setIsRunning(false)
      if (soundEnabled) {
        const audio = new Audio("/notification.mp3")
        audio.play().catch(() => {})
      }
      if (mode === "focus") {
        saveSession().then((saved) => {
          if (saved) setSessionsCompleted((prev) => prev + 1)
        })
      }
    }
    return () => clearInterval(interval)
  }, [isRunning, timeLeft, mode, soundEnabled])

  useEffect(() => {
    if (preferences.theme !== "default") {
      if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null }
      setBgIndex(0)
      return
    }
    intervalRef.current = setInterval(() => {
      setBgIndex((prev) => (prev + 1) % BACKGROUND_IMAGES.length)
    }, 2 * 60 * 1000)
    return () => { if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null } }
  }, [preferences.theme])

  useEffect(() => {
    if (preferences.theme === "default") setBgIndex(0)
  }, [preferences.theme])

  const saveSession = async (): Promise<boolean> => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || !currentSessionId) return false
    const { data: existing } = await supabase
      .from("pomodoro_sessions")
      .select("id")
      .eq("session_id", currentSessionId)
      .maybeSingle()
    if (existing) return false
    const actualDuration = sessionStartTime
      ? Math.round((Date.now() - sessionStartTime) / 1000 / 60)
      : preferences.focusDuration
    if (actualDuration <= 0 || actualDuration > 180) return false
    const { error } = await supabase.from("pomodoro_sessions").insert({
      user_id: user.id,
      task_id: selectedTask?.id || null,
      session_id: currentSessionId,
      duration_minutes: actualDuration,
      completed: true,
      started_at: sessionStartTime ? new Date(sessionStartTime).toISOString() : new Date().toISOString(),
      completed_at: new Date().toISOString(),
    })
    if (error) { if (error.code === '23505') return false; return false }
    setCurrentSessionId(null); setSessionStartTime(null)
    return true
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
  }

  const formatDate = (date: Date) => {
    const options: Intl.DateTimeFormatOptions = { weekday: "long", month: "short", day: "numeric" }
    return date.toLocaleDateString("en-US", options).toUpperCase()
  }

  const formatCurrentTime = (date: Date) => {
    return date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true })
  }

  const handleModeChange = (newMode: TimerMode) => {
    setMode(newMode)
    setTimeLeft(getDuration(newMode))
    setIsRunning(false)
  }

  const handleReset = () => {
    setTimeLeft(getDuration(mode))
    setIsRunning(false)
    if (currentSessionId) { setCurrentSessionId(null); setSessionStartTime(null) }
  }

  const toggleTimer = () => {
    if (!isRunning && mode === "focus") {
      const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      setCurrentSessionId(sessionId)
      setSessionStartTime(Date.now())
    }
    setIsRunning(!isRunning)
  }

  const completeTask = async (taskId: string) => {
    await supabase.from("tasks").update({ completed: true, completed_at: new Date().toISOString() }).eq("id", taskId)
    setTasks(tasks.filter((t) => t.id !== taskId))
    if (selectedTask?.id === taskId) {
      setSelectedTask(tasks.filter((t) => t.id !== taskId)[0] || null)
    }
  }

  const selectTask = (task: Task) => {
    setSelectedTask(task)
  }

  const updatePreference = <K extends keyof PomodoroPreferences>(key: K, value: PomodoroPreferences[K]) => {
    setPreferences((prev) => ({ ...prev, [key]: value }))
    if (!isRunning) {
      if (key === "focusDuration" && mode === "focus") setTimeLeft((value as number) * 60)
      else if (key === "breakDuration" && mode === "shortBreak") setTimeLeft((value as number) * 60)
      else if (key === "longBreakDuration" && mode === "longBreak") setTimeLeft((value as number) * 60)
    }
  }

  const progress = ((getDuration(mode) - timeLeft) / getDuration(mode)) * 100
  const currentThemeOverlay = THEME_STYLES[preferences.theme].overlay
  const otherTasks = tasks.filter((t) => t.id !== selectedTask?.id)
  const visibleOtherTasks = showAllTasks ? otherTasks : otherTasks.slice(0, 3)

  let backgroundImageStyle: string
  if (preferences.theme === "default") {
    backgroundImageStyle = `url('${BACKGROUND_IMAGES[bgIndex]}')`
  } else if (preferences.theme === "darkCalm") {
    backgroundImageStyle = "linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)"
  } else if (preferences.theme === "softGradient") {
    backgroundImageStyle = `url('/soft-gradient-bg.jpeg')`
  } else {
    backgroundImageStyle = "none"
  }

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat transition-all duration-500"
        style={{ backgroundImage: backgroundImageStyle }}
      >
        {currentThemeOverlay && <div className={`absolute inset-0 ${currentThemeOverlay}`} />}
      </div>

      {/* Content */}
      <div className="relative z-10 p-4 sm:p-6 lg:p-8 min-h-screen flex flex-col">
        {/* Top Bar */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <div className="text-white">
            <p className="text-sm sm:text-base font-medium opacity-90">{formatDate(currentTime)}</p>
            <p className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight">{formatCurrentTime(currentTime)}</p>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/dashboard">
              <Button variant="ghost" className="text-white hover:bg-white/20 gap-2 px-4">
                <Home className="h-5 w-5" />
                <span className="hidden sm:inline">Dashboard</span>
              </Button>
            </Link>
            {/* Task panel toggle */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setTaskPanelVisible(!taskPanelVisible)}
              className={`text-white hover:bg-white/20 h-10 w-10 relative ${!taskPanelVisible ? "bg-white/10" : ""}`}
              title={taskPanelVisible ? "Hide task panel" : "Show task panel"}
            >
              {taskPanelVisible ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              {!taskPanelVisible && tasks.length > 0 && (
                <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-primary text-[10px] font-bold flex items-center justify-center text-white">
                  {tasks.length > 9 ? "9+" : tasks.length}
                </span>
              )}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowSettings(!showSettings)}
              className={`text-white hover:bg-white/20 h-10 w-10 ${showSettings ? "bg-white/20" : ""}`}
            >
              <Settings className="h-5 w-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSoundEnabled(!soundEnabled)}
              className="text-white hover:bg-white/20 h-10 w-10"
            >
              {soundEnabled ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
            </Button>
          </div>
        </div>

        {/* White noise notice */}
        <div className="mb-5 max-w-md mx-auto w-full">
          <div className="flex items-center gap-2 bg-yellow-100/10 border border-yellow-400/30 rounded-lg px-3 py-2 text-yellow-100 text-sm font-medium shadow-md transition-colors">
            <Sparkles className="h-4 w-4 text-yellow-300" />
            <span>White noise available in Pomodoro settings</span>
          </div>
        </div>

        {showSettings && (
          <Card className="mb-6 bg-white/10 backdrop-blur-md border-white/20 text-white max-w-md mx-auto w-full">
            <div className="p-4 sm:p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-lg flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  Timer Settings
                </h3>
                <Button variant="ghost" size="icon" onClick={() => setShowSettings(false)} className="text-white hover:bg-white/20 h-8 w-8">
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="focusDuration" className="text-white/90">Focus Duration (minutes)</Label>
                  <Input id="focusDuration" type="number" min={1} max={90} value={preferences.focusDuration}
                    onChange={(e) => updatePreference("focusDuration", Math.min(90, Math.max(1, Number.parseInt(e.target.value) || 25)))}
                    className="bg-white/10 border-white/20 text-white placeholder:text-white/50" />
                  <p className="text-xs text-white/50">Max: 90 minutes</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="breakDuration" className="text-white/90">Short Break (minutes)</Label>
                  <Input id="breakDuration" type="number" min={1} max={30} value={preferences.breakDuration}
                    onChange={(e) => updatePreference("breakDuration", Math.min(30, Math.max(1, Number.parseInt(e.target.value) || 5)))}
                    className="bg-white/10 border-white/20 text-white placeholder:text-white/50" />
                  <p className="text-xs text-white/50">Max: 30 minutes</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="longBreakDuration" className="text-white/90">Long Break (minutes)</Label>
                  <Input id="longBreakDuration" type="number" min={1} max={60} value={preferences.longBreakDuration}
                    onChange={(e) => updatePreference("longBreakDuration", Math.min(60, Math.max(1, Number.parseInt(e.target.value) || 15)))}
                    className="bg-white/10 border-white/20 text-white placeholder:text-white/50" />
                  <p className="text-xs text-white/50">Max: 60 minutes</p>
                </div>
                <div className="space-y-2">
                  <Label className="text-white/90">Background Theme</Label>
                  <div className="grid grid-cols-3 gap-2">
                    <button onClick={() => updatePreference("theme", "default")}
                      className={`p-3 rounded-lg text-sm font-medium transition-all ${preferences.theme === "default" ? "bg-primary text-primary-foreground ring-2 ring-white" : "bg-white/10 hover:bg-white/20"}`}>
                      <div className="h-8 w-full rounded mb-2 bg-center bg-cover" style={{ backgroundImage: "url('/timer-background-1.jpg')" }} />
                      Default
                    </button>
                    <button onClick={() => updatePreference("theme", "darkCalm")}
                      className={`p-3 rounded-lg text-sm font-medium transition-all ${preferences.theme === "darkCalm" ? "bg-primary text-primary-foreground ring-2 ring-white" : "bg-white/10 hover:bg-white/20"}`}>
                      <div className="h-8 w-full rounded bg-gradient-to-br from-[#1a1a2e] to-[#0f3460] mb-2" />
                      Dark Calm
                    </button>
                    <button onClick={() => updatePreference("theme", "softGradient")}
                      className={`p-3 rounded-lg text-sm font-medium transition-all ${preferences.theme === "softGradient" ? "bg-primary text-primary-foreground ring-2 ring-white" : "bg-white/10 hover:bg-white/20"}`}>
                      <div className="h-8 w-full rounded mb-2 bg-center bg-cover" style={{ backgroundImage: "url('/soft-gradient-bg.jpeg')" }} />
                      Soft Gradient
                    </button>
                  </div>
                </div>
                <div className="space-y-3 pt-2 border-t border-white/10">
                  <div className="flex items-center justify-between">
                    <Label className="text-white/90 flex items-center gap-2">
                      <Waves className="h-4 w-4" />
                      Ambient Sound
                    </Label>
                    <button
                      onClick={() => updateAmbientSound({ enabled: !ambientSound.enabled })}
                      className={`relative w-11 h-6 rounded-full transition-colors ${ambientSound.enabled ? "bg-primary" : "bg-white/20"}`}
                      aria-label={ambientSound.enabled ? "Disable ambient sound" : "Enable ambient sound"}
                    >
                      <span className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${ambientSound.enabled ? "translate-x-5" : "translate-x-0"}`} />
                    </button>
                  </div>
                  <p className="text-xs text-white/50">Plays during focus sessions to help you concentrate</p>
                  <div className="relative">
                    <button
                      onClick={() => setShowSoundPicker(!showSoundPicker)}
                      className="w-full flex items-center justify-between px-3 py-2.5 bg-white/10 hover:bg-white/15 rounded-xl border border-white/15 text-sm text-white transition-colors"
                    >
                      <span className="flex items-center gap-2">
                        {ambientSound.soundType === "off" && <VolumeX className="h-4 w-4 text-white/50" />}
                        {(ambientSound.soundType === "whiteNoise" || ambientSound.soundType === "brownNoise" || ambientSound.soundType === "pinkNoise") && <Waves className="h-4 w-4 text-blue-300" />}
                        {ambientSound.soundType === "rain" && <CloudRain className="h-4 w-4 text-blue-300" />}
                        {ambientSound.soundType === "lightRain" && <Droplets className="h-4 w-4 text-cyan-300" />}
                        {ambientSound.soundType === "cafe" && <Coffee className="h-4 w-4 text-amber-300" />}
                        {ambientSound.soundType === "wind" && <Wind className="h-4 w-4 text-green-300" />}
                        {ambientSound.soundType === "ocean" && <Waves className="h-4 w-4 text-teal-300" />}
                        {AMBIENT_SOUNDS.find(s => s.type === ambientSound.soundType)?.label || "Silence"}
                      </span>
                      <ChevronDown className={`h-4 w-4 text-white/50 transition-transform ${showSoundPicker ? "rotate-180" : ""}`} />
                    </button>
                    {showSoundPicker && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-black/80 backdrop-blur-xl border border-white/15 rounded-xl overflow-hidden z-20 max-h-56 overflow-y-auto">
                        {AMBIENT_SOUNDS.map((sound) => (
                          <button key={sound.type} onClick={() => { updateAmbientSound({ soundType: sound.type }); setShowSoundPicker(false) }}
                            className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-left transition-colors ${ambientSound.soundType === sound.type ? "bg-primary/30 text-white" : "text-white/80 hover:bg-white/10"}`}>
                            {sound.icon === "off" && <VolumeX className="h-4 w-4 text-white/40" />}
                            {sound.icon === "waves" && <Waves className="h-4 w-4 text-blue-300" />}
                            {sound.icon === "rain" && <CloudRain className="h-4 w-4 text-blue-300" />}
                            {sound.icon === "droplets" && <Droplets className="h-4 w-4 text-cyan-300" />}
                            {sound.icon === "coffee" && <Coffee className="h-4 w-4 text-amber-300" />}
                            {sound.icon === "wind" && <Wind className="h-4 w-4 text-green-300" />}
                            {sound.icon === "ocean" && <Waves className="h-4 w-4 text-teal-300" />}
                            {sound.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  {ambientSound.soundType !== "off" && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-white/70">Volume</span>
                        <span className="text-white/90">{ambientSound.volume}%</span>
                      </div>
                      <input type="range" min="0" max="100" value={ambientSound.volume}
                        onChange={(e) => updateAmbientSound({ volume: Number(e.target.value) })}
                        className="w-full h-2 bg-white/20 rounded-lg appearance-none cursor-pointer accent-primary" aria-label="Ambient sound volume" />
                      <div className="flex justify-between text-xs text-white/40"><span>Quiet</span><span>Loud</span></div>
                    </div>
                  )}
                  {ambientSound.enabled && ambientSound.soundType !== "off" && isRunning && mode === "focus" && (
                    <div className="flex items-center gap-2 px-3 py-2 bg-primary/20 rounded-lg border border-primary/30">
                      <div className="flex gap-0.5 items-end h-3">
                        <span className="w-0.5 bg-primary rounded-full animate-pulse" style={{ height: "40%", animationDelay: "0ms" }} />
                        <span className="w-0.5 bg-primary rounded-full animate-pulse" style={{ height: "80%", animationDelay: "150ms" }} />
                        <span className="w-0.5 bg-primary rounded-full animate-pulse" style={{ height: "60%", animationDelay: "300ms" }} />
                        <span className="w-0.5 bg-primary rounded-full animate-pulse" style={{ height: "100%", animationDelay: "100ms" }} />
                        <span className="w-0.5 bg-primary rounded-full animate-pulse" style={{ height: "50%", animationDelay: "250ms" }} />
                      </div>
                      <span className="text-xs text-primary">{AMBIENT_SOUNDS.find(s => s.type === ambientSound.soundType)?.label} playing</span>
                    </div>
                  )}
                </div>
              </div>
              {isRunning && (
                <p className="mt-4 text-xs text-yellow-300/80 text-center">Duration changes will apply after current session ends or reset</p>
              )}
            </div>
          </Card>
        )}

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col lg:flex-row items-center lg:items-end justify-between gap-8">
          {/* Timer Section */}
          <div className="flex flex-col items-center lg:items-start order-2 lg:order-1">
            <div className="text-white mb-4 sm:mb-6">
              <p className="text-7xl sm:text-8xl lg:text-[12rem] font-bold tracking-tighter drop-shadow-2xl">
                {formatTime(timeLeft)}
              </p>
            </div>

            {/* Active task inline indicator (shown when task panel is hidden) */}
            {!taskPanelVisible && selectedTask && (
              <div className="mb-4 flex items-center gap-2 px-3 py-2 bg-white/10 backdrop-blur-sm rounded-full border border-white/20 text-white/90 text-sm max-w-xs">
                <div className="h-2 w-2 rounded-full bg-primary animate-pulse flex-shrink-0" />
                <span className="truncate">{selectedTask.title}</span>
              </div>
            )}

            <div className="flex items-center gap-3 sm:gap-4 mb-4 sm:mb-6">
              <Button onClick={toggleTimer} size="lg"
                className="h-14 w-14 sm:h-16 sm:w-16 rounded-full bg-white/20 backdrop-blur-sm hover:bg-white/30 text-white border border-white/30">
                {isRunning ? <Pause className="h-7 w-7" /> : <Play className="h-7 w-7 ml-1" />}
              </Button>
              <Button onClick={handleReset} size="lg"
                className="h-14 w-14 sm:h-16 sm:w-16 rounded-full bg-white/20 backdrop-blur-sm hover:bg-white/30 text-white border border-white/30">
                <RotateCcw className="h-6 w-6" />
              </Button>
            </div>

            <div className="flex gap-2 sm:gap-3">
              {(["focus", "shortBreak", "longBreak"] as TimerMode[]).map((m) => (
                <Button key={m} onClick={() => handleModeChange(m)}
                  className={`px-4 sm:px-6 py-2 rounded-full text-sm sm:text-base font-medium transition-all ${mode === m ? "bg-primary text-primary-foreground shadow-lg" : "bg-white/20 text-white hover:bg-white/30 backdrop-blur-sm border border-white/30"}`}>
                  {m === "focus" ? "Focus" : m === "shortBreak" ? "Short Break" : "Long Break"}
                </Button>
              ))}
            </div>

            <div className="mt-4 sm:mt-6 flex items-center gap-2 text-white/80">
              <Timer className="h-4 w-4" />
              <span className="text-sm">{sessionsCompleted} sessions completed today</span>
            </div>
          </div>

          {/* Task Panel - collapsible */}
          {taskPanelVisible && (
            <div className="w-full sm:w-80 lg:w-96 order-1 lg:order-2 lg:self-start">
              <Card className="bg-white/10 backdrop-blur-md border-white/20 text-white overflow-hidden">
                {/* Header */}
                <div className="p-4 sm:p-5 pb-3">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <ListTodo className="h-5 w-5 text-primary" />
                      <h3 className="font-semibold text-lg">Tasks</h3>
                      {tasks.length > 0 && (
                        <span className="text-xs bg-white/15 px-2 py-0.5 rounded-full text-white/70">
                          {tasks.length} remaining
                        </span>
                      )}
                    </div>
                    <Button variant="ghost" size="icon"
                      onClick={() => setTaskPanelVisible(false)}
                      className="text-white/50 hover:text-white hover:bg-white/10 h-7 w-7"
                      title="Hide task panel">
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {/* Active / selected task */}
                {selectedTask ? (
                  <div className="px-4 sm:px-5 pb-3">
                    <p className="text-xs text-white/50 uppercase tracking-wider mb-2 flex items-center gap-1">
                      <Circle className="h-2 w-2 fill-primary text-primary" />
                      Focusing on
                    </p>
                    <div className="bg-primary/20 border border-primary/30 rounded-xl p-3 ring-1 ring-primary/20">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold text-base sm:text-lg leading-tight truncate">{selectedTask.title}</h4>
                          {selectedTask.description && (
                            <p className="text-sm text-white/60 mt-1 line-clamp-2">{selectedTask.description}</p>
                          )}
                          {selectedTask.subject && (
                            <span className="inline-block mt-2 px-2 py-0.5 bg-white/10 rounded text-xs text-white/70">
                              {selectedTask.subject}
                            </span>
                          )}
                        </div>
                      </div>
                      <Button onClick={() => completeTask(selectedTask.id)}
                        className="w-full mt-3 bg-green-500/80 hover:bg-green-500 text-white h-8 text-sm">
                        <CheckCircle2 className="h-4 w-4 mr-2" />
                        Mark Complete
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="px-4 sm:px-5 pb-3 text-center py-4 text-white/50">
                    <p className="text-sm">No tasks. Add some in the Planner.</p>
                  </div>
                )}

                {/* Other tasks list */}
                {otherTasks.length > 0 && (
                  <div className="border-t border-white/10">
                    <div className="px-4 sm:px-5 pt-3 pb-1">
                      <p className="text-xs text-white/50 uppercase tracking-wider">Up Next</p>
                    </div>
                    <div className="px-3 pb-3 space-y-1 max-h-48 overflow-y-auto">
                      {visibleOtherTasks.map((task) => (
                        <button key={task.id} onClick={() => selectTask(task)}
                          className="w-full text-left px-3 py-2.5 rounded-lg bg-white/5 hover:bg-white/12 border border-transparent hover:border-white/15 transition-all group flex items-center gap-2">
                          <Circle className="h-2 w-2 text-white/30 group-hover:text-primary/60 flex-shrink-0 transition-colors" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate text-white/80 group-hover:text-white transition-colors">{task.title}</p>
                            {task.subject && <p className="text-xs text-white/40 truncate">{task.subject}</p>}
                          </div>
                          <span className="text-[10px] text-white/30 group-hover:text-white/60 transition-colors flex-shrink-0">Focus →</span>
                        </button>
                      ))}
                    </div>
                    {otherTasks.length > 3 && (
                      <div className="px-4 sm:px-5 pb-3">
                        <button onClick={() => setShowAllTasks(!showAllTasks)}
                          className="flex items-center gap-1 text-xs text-white/50 hover:text-white/80 transition-colors">
                          {showAllTasks ? (
                            <><ChevronUp className="h-3 w-3" />Show less</>
                          ) : (
                            <><ChevronDown className="h-3 w-3" />{otherTasks.length - 3} more tasks</>
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </Card>

              {/* Progress Ring */}
              <div className="mt-4 flex justify-center">
                <div className="relative h-20 w-20">
                  <svg className="h-20 w-20 -rotate-90 transform">
                    <circle cx="40" cy="40" r="36" stroke="rgba(255,255,255,0.2)" strokeWidth="6" fill="none" />
                    <circle cx="40" cy="40" r="36" stroke="hsl(var(--primary))" strokeWidth="6" fill="none"
                      strokeDasharray={`${2 * Math.PI * 36}`}
                      strokeDashoffset={`${2 * Math.PI * 36 * (1 - progress / 100)}`}
                      strokeLinecap="round" className="transition-all duration-1000" />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-white text-sm font-medium">{Math.round(progress)}%</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* When panel is hidden, show progress ring next to timer */}
          {!taskPanelVisible && (
            <div className="order-1 lg:order-2 lg:self-end mb-2">
              <div className="relative h-16 w-16">
                <svg className="h-16 w-16 -rotate-90 transform">
                  <circle cx="32" cy="32" r="28" stroke="rgba(255,255,255,0.2)" strokeWidth="5" fill="none" />
                  <circle cx="32" cy="32" r="28" stroke="hsl(var(--primary))" strokeWidth="5" fill="none"
                    strokeDasharray={`${2 * Math.PI * 28}`}
                    strokeDashoffset={`${2 * Math.PI * 28 * (1 - progress / 100)}`}
                    strokeLinecap="round" className="transition-all duration-1000" />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-white text-xs font-medium">{Math.round(progress)}%</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
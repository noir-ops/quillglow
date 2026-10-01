"use client"

import { create } from "zustand"
import { persist } from "zustand/middleware"
import type { Task } from "@/lib/types/study"

interface StudyStore {
  // Streak tracking
  lastActivityDate: string | null
  streakDays: number
  updateStreak: () => void

  // Daily quote
  dailyQuote: string
  setDailyQuote: (quote: string) => void

  // Pomodoro state
  pomodoroActive: boolean
  pomodoroTimeLeft: number
  pomodoroTaskId: string | null
  activeTaskId: string | null
  setActiveTaskId: (taskId: string | null) => void
  startPomodoro: (taskId?: string) => void
  pausePomodoro: () => void
  resetPomodoro: () => void
  tickPomodoro: () => void

  // Theme
  theme: "light" | "dark"
  toggleTheme: () => void

  optimisticTasks: Task[]
  addOptimisticTask: (task: Task) => void
  removeOptimisticTask: (tempId: string) => void
  confirmOptimisticTask: (tempId: string, realId: string) => void
}

const motivationalQuotes = [
  "Success is the sum of small efforts repeated day in and day out.",
  "The expert in anything was once a beginner.",
  "Don't watch the clock; do what it does. Keep going.",
  "The secret of getting ahead is getting started.",
  "Study while others are sleeping; work while others are loafing.",
  "Education is the passport to the future.",
  "The beautiful thing about learning is that no one can take it away from you.",
  "Push yourself, because no one else is going to do it for you.",
  "Great things never come from comfort zones.",
  "Dream it. Wish it. Do it.",
  "Success doesn't just find you. You have to go out and get it.",
  "The harder you work for something, the greater you'll feel when you achieve it.",
  "Don't stop when you're tired. Stop when you're done.",
  "Wake up with determination. Go to bed with satisfaction.",
  "Do something today that your future self will thank you for.",
  "Little things make big days.",
  "It's going to be hard, but hard does not mean impossible.",
  "Don't wait for opportunity. Create it.",
  "Sometimes we're tested not to show our weaknesses, but to discover our strengths.",
  "The key to success is to focus on goals, not obstacles.",
]

export const useStudyStore = create<StudyStore>()(
  persist(
    (set, get) => ({
      // Streak
      lastActivityDate: null,
      streakDays: 0,
      updateStreak: () => {
        const today = new Date().toDateString()
        const lastDate = get().lastActivityDate

        if (lastDate === today) {
          return
        }

        const yesterday = new Date()
        yesterday.setDate(yesterday.getDate() - 1)
        const yesterdayStr = yesterday.toDateString()

        if (lastDate === yesterdayStr) {
          set({ streakDays: get().streakDays + 1, lastActivityDate: today })
        } else if (lastDate === null) {
          set({ streakDays: 1, lastActivityDate: today })
        } else {
          set({ streakDays: 1, lastActivityDate: today })
        }
      },

      // Quote
      dailyQuote: motivationalQuotes[0],
      setDailyQuote: (quote) => set({ dailyQuote: quote }),

      // Pomodoro
      pomodoroActive: false,
      pomodoroTimeLeft: 25 * 60,
      pomodoroTaskId: null,
      activeTaskId: null,
      setActiveTaskId: (taskId) => set({ activeTaskId: taskId }),
      startPomodoro: (taskId) => set({ pomodoroActive: true, pomodoroTaskId: taskId || null }),
      pausePomodoro: () => set({ pomodoroActive: false }),
      resetPomodoro: () => set({ pomodoroActive: false, pomodoroTimeLeft: 25 * 60, pomodoroTaskId: null }),
      tickPomodoro: () => {
        const timeLeft = get().pomodoroTimeLeft
        if (timeLeft > 0) {
          set({ pomodoroTimeLeft: timeLeft - 1 })
        } else {
          set({ pomodoroActive: false })
        }
      },

      // Theme
      theme: "light",
      toggleTheme: () => set((state) => ({ theme: state.theme === "light" ? "dark" : "light" })),

      optimisticTasks: [],
      addOptimisticTask: (task) => set((state) => ({ optimisticTasks: [task, ...state.optimisticTasks] })),
      removeOptimisticTask: (tempId) =>
        set((state) => ({ optimisticTasks: state.optimisticTasks.filter((t) => t.id !== tempId) })),
      confirmOptimisticTask: (tempId, realId) =>
        set((state) => ({
          optimisticTasks: state.optimisticTasks.map((t) =>
            t.id === tempId ? { ...t, id: realId, isOptimistic: undefined } : t,
          ),
        })),
    }),
    {
      name: "quillglow-storage",
      partialize: (state) => ({
        lastActivityDate: state.lastActivityDate,
        streakDays: state.streakDays,
        dailyQuote: state.dailyQuote,
        theme: state.theme,
      }),
    },
  ),
)

// Initialize daily quote
if (typeof window !== "undefined") {
  const today = new Date().toDateString()
  const storedDate = localStorage.getItem("quote-date")

  if (storedDate !== today) {
    const randomQuote = motivationalQuotes[Math.floor(Math.random() * motivationalQuotes.length)]
    useStudyStore.getState().setDailyQuote(randomQuote)
    localStorage.setItem("quote-date", today)
  }
}

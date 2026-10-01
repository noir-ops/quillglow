"use client"

import { create } from "zustand"
import { persist } from "zustand/middleware"

interface GlobalTimerState {
  // Timer state
  isRunning: boolean
  isPaused: boolean
  elapsedSeconds: number
  startTimestamp: number | null
  pausedElapsed: number
  sessionName: string
  taskReference: string | null

  // Actions
  startTimer: (name?: string, taskId?: string) => void
  pauseTimer: () => void
  resumeTimer: () => void
  stopTimer: () => { duration: number; startTime: number; name: string; taskId: string | null } | null
  tick: () => void
  setSessionName: (name: string) => void
  setTaskReference: (taskId: string | null) => void
  resetTimer: () => void
}

export const useGlobalTimerStore = create<GlobalTimerState>()(
  persist(
    (set, get) => ({
      isRunning: false,
      isPaused: false,
      elapsedSeconds: 0,
      startTimestamp: null,
      pausedElapsed: 0,
      sessionName: "",
      taskReference: null,

      startTimer: (name?: string, taskId?: string) => {
        set({
          isRunning: true,
          isPaused: false,
          elapsedSeconds: 0,
          startTimestamp: Date.now(),
          pausedElapsed: 0,
          sessionName: name || "",
          taskReference: taskId || null,
        })
      },

      pauseTimer: () => {
        const state = get()
        if (!state.isRunning || state.isPaused) return
        set({
          isPaused: true,
          pausedElapsed: state.elapsedSeconds,
        })
      },

      resumeTimer: () => {
        const state = get()
        if (!state.isRunning || !state.isPaused) return
        set({
          isPaused: false,
          // Adjust startTimestamp so elapsed calculation continues correctly
          startTimestamp: Date.now() - state.pausedElapsed * 1000,
        })
      },

      stopTimer: () => {
        const state = get()
        if (!state.isRunning && !state.isPaused) return null

        const duration = state.elapsedSeconds
        const startTime = state.startTimestamp || Date.now() - duration * 1000

        const result = {
          duration,
          startTime,
          name: state.sessionName,
          taskId: state.taskReference,
        }

        set({
          isRunning: false,
          isPaused: false,
          elapsedSeconds: 0,
          startTimestamp: null,
          pausedElapsed: 0,
          sessionName: "",
          taskReference: null,
        })

        return result
      },

      tick: () => {
        const state = get()
        if (!state.isRunning || state.isPaused || !state.startTimestamp) return
        const elapsed = Math.floor((Date.now() - state.startTimestamp) / 1000)
        if (elapsed !== state.elapsedSeconds) {
          set({ elapsedSeconds: elapsed })
        }
      },

      setSessionName: (name: string) => set({ sessionName: name }),
      setTaskReference: (taskId: string | null) => set({ taskReference: taskId }),

      resetTimer: () =>
        set({
          isRunning: false,
          isPaused: false,
          elapsedSeconds: 0,
          startTimestamp: null,
          pausedElapsed: 0,
          sessionName: "",
          taskReference: null,
        }),
    }),
    {
      name: "quillglow-global-timer",
      partialize: (state) => ({
        isRunning: state.isRunning,
        isPaused: state.isPaused,
        elapsedSeconds: state.elapsedSeconds,
        startTimestamp: state.startTimestamp,
        pausedElapsed: state.pausedElapsed,
        sessionName: state.sessionName,
        taskReference: state.taskReference,
      }),
    },
  ),
)

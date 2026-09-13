"use client"

import { useEffect, useState, useCallback } from "react"
import { type UserTheme, applyThemeToElement, removeThemeFromElement } from "@/lib/theme-utils"
import { useStudyStore } from "@/lib/store/study-store"

export function useUserTheme() {
  const [userTheme, setUserTheme] = useState<UserTheme | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [previewTheme, setPreviewTheme] = useState<UserTheme | null>(null)
  const { theme: mode } = useStudyStore()

  // Fetch user theme on mount
  useEffect(() => {
    async function fetchTheme() {
      try {
        const response = await fetch("/api/user-theme")
        const data = await response.json()
        if (data.theme) {
          setUserTheme(data.theme)
        }
      } catch (error) {
        console.error("[v0] Error fetching theme:", error)
      } finally {
        setIsLoading(false)
      }
    }
    fetchTheme()
  }, [])

  // Apply theme when it changes or when mode changes
  useEffect(() => {
    const appThemeRoot = document.getElementById("app-theme-root")
    if (!appThemeRoot) return

    const themeToApply = previewTheme || userTheme
    if (themeToApply) {
      const palette = mode === "dark" ? themeToApply.dark : themeToApply.light
      applyThemeToElement(appThemeRoot, palette, mode === "dark")
    } else {
      removeThemeFromElement(appThemeRoot)
    }
  }, [userTheme, previewTheme, mode])

  const saveTheme = useCallback(async (theme: UserTheme) => {
    try {
      const response = await fetch("/api/user-theme", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ theme }),
      })
      if (response.ok) {
        setUserTheme(theme)
        setPreviewTheme(null)
        return true
      }
      return false
    } catch (error) {
      console.error("[v0] Error saving theme:", error)
      return false
    }
  }, [])

  const resetTheme = useCallback(async () => {
    try {
      const response = await fetch("/api/user-theme", { method: "DELETE" })
      if (response.ok) {
        setUserTheme(null)
        setPreviewTheme(null)
        const appThemeRoot = document.getElementById("app-theme-root")
        if (appThemeRoot) {
          removeThemeFromElement(appThemeRoot)
        }
        return true
      }
      return false
    } catch (error) {
      console.error("[v0] Error resetting theme:", error)
      return false
    }
  }, [])

  const startPreview = useCallback((theme: UserTheme) => {
    setPreviewTheme(theme)
  }, [])

  const cancelPreview = useCallback(() => {
    setPreviewTheme(null)
  }, [])

  return {
    userTheme,
    isLoading,
    saveTheme,
    resetTheme,
    startPreview,
    cancelPreview,
    previewTheme,
    currentMode: mode,
  }
}

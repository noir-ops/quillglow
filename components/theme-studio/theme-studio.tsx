"use client"

import { useState, useEffect } from "react"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Palette, RotateCcw, Save, X, Sun, Moon, Sparkles } from "lucide-react"
import { useUserTheme } from "@/hooks/use-user-theme"
import { type UserTheme, type ThemePalette, DEFAULT_THEME, hexToOklch, oklchToHex } from "@/lib/theme-utils"
import { cn } from "@/lib/utils"

interface ThemeStudioProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const COLOR_OPTIONS = [
  { key: "primary", label: "Primary", description: "Buttons, links, active states" },
  { key: "background", label: "Background", description: "Page background" },
  { key: "foreground", label: "Text", description: "Main text color" },
  { key: "card", label: "Cards", description: "Card backgrounds" },
  { key: "border", label: "Borders", description: "Borders and dividers" },
  { key: "accent", label: "Accent", description: "Highlights and badges" },
] as const

const CHART_OPTIONS = [
  { key: "chart-1", label: "Chart 1", description: "Primary chart color" },
  { key: "chart-2", label: "Chart 2", description: "Secondary chart color" },
  { key: "chart-3", label: "Chart 3", description: "Tertiary chart color" },
] as const

export function ThemeStudio({ open, onOpenChange }: ThemeStudioProps) {
  const { userTheme, saveTheme, resetTheme, startPreview, cancelPreview, currentMode } = useUserTheme()
  const [editingTheme, setEditingTheme] = useState<UserTheme>(userTheme || DEFAULT_THEME)
  const [editMode, setEditMode] = useState<"light" | "dark">("light")
  const [isSaving, setIsSaving] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)

  // Initialize editing theme when opening
  useEffect(() => {
    if (open) {
      setEditingTheme(userTheme || DEFAULT_THEME)
      setEditMode(currentMode as "light" | "dark")
    }
  }, [open, userTheme, currentMode])

  // Live preview as user edits
  useEffect(() => {
    if (open) {
      startPreview(editingTheme)
    }
  }, [editingTheme, open, startPreview])

  const handleColorChange = (key: keyof ThemePalette, hexValue: string) => {
    const oklchValue = hexToOklch(hexValue)
    setEditingTheme((prev) => ({
      ...prev,
      [editMode]: {
        ...prev[editMode],
        [key]: oklchValue,
      },
    }))
  }

  const handleSave = async () => {
    setIsSaving(true)
    const success = await saveTheme(editingTheme)
    setIsSaving(false)
    if (success) {
      onOpenChange(false)
    }
  }

  const handleReset = async () => {
    await resetTheme()
    setEditingTheme(DEFAULT_THEME)
  }

  const handleCancel = () => {
    cancelPreview()
    onOpenChange(false)
  }

  const getHexValue = (key: keyof ThemePalette) => {
    return oklchToHex(editingTheme[editMode][key])
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) handleCancel()
        else onOpenChange(isOpen)
      }}
    >
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader className="mb-6">
          <SheetTitle className="flex items-center gap-2">
            <Palette className="h-5 w-5 text-primary" />
            Theme Studio
          </SheetTitle>
          <SheetDescription>Customize your QuillGlow experience with your own colors</SheetDescription>
        </SheetHeader>

        {/* Mode Toggle */}
        <div className="mb-6">
          <Label className="text-sm font-medium mb-2 block">Editing Mode</Label>
          <div className="flex gap-2">
            <Button
              variant={editMode === "light" ? "default" : "outline"}
              size="sm"
              onClick={() => setEditMode("light")}
              className="flex-1"
            >
              <Sun className="h-4 w-4 mr-2" />
              Light
            </Button>
            <Button
              variant={editMode === "dark" ? "default" : "outline"}
              size="sm"
              onClick={() => setEditMode("dark")}
              className="flex-1"
            >
              <Moon className="h-4 w-4 mr-2" />
              Dark
            </Button>
          </div>
        </div>

        {/* Color Pickers */}
        <div className="space-y-6">
          <div>
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Sparkles className="h-4 w-4" />
              Main Colors
            </h3>
            <div className="grid gap-4">
              {COLOR_OPTIONS.map(({ key, label, description }) => (
                <div key={key} className="flex items-center gap-3">
                  <div className="relative">
                    <input
                      type="color"
                      value={getHexValue(key)}
                      onChange={(e) => handleColorChange(key, e.target.value)}
                      className="w-12 h-12 rounded-lg cursor-pointer border-2 border-border hover:border-primary transition-colors"
                      style={{ padding: 0 }}
                    />
                  </div>
                  <div className="flex-1">
                    <Label className="text-sm font-medium">{label}</Label>
                    <p className="text-xs text-muted-foreground">{description}</p>
                  </div>
                  <code className="text-xs bg-muted px-2 py-1 rounded font-mono">{getHexValue(key).toUpperCase()}</code>
                </div>
              ))}
            </div>
          </div>

          {/* Advanced - Chart Colors */}
          <div>
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="text-sm font-semibold mb-3 flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <span className={cn("transition-transform", showAdvanced && "rotate-90")}>▶</span>
              Chart Colors
            </button>
            {showAdvanced && (
              <div className="grid gap-4 pl-4 border-l-2 border-border">
                {CHART_OPTIONS.map(({ key, label, description }) => (
                  <div key={key} className="flex items-center gap-3">
                    <input
                      type="color"
                      value={getHexValue(key)}
                      onChange={(e) => handleColorChange(key, e.target.value)}
                      className="w-10 h-10 rounded-lg cursor-pointer border-2 border-border hover:border-primary transition-colors"
                      style={{ padding: 0 }}
                    />
                    <div className="flex-1">
                      <Label className="text-sm font-medium">{label}</Label>
                      <p className="text-xs text-muted-foreground">{description}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Preview Box */}
        <div className="mt-6 p-4 rounded-xl border bg-card">
          <p className="text-sm font-medium mb-2">Preview</p>
          <div className="flex gap-2 flex-wrap">
            <Button size="sm">Primary</Button>
            <Button size="sm" variant="outline">
              Outline
            </Button>
            <Button size="sm" variant="ghost">
              Ghost
            </Button>
            <div className="w-full mt-2 p-3 rounded-lg bg-muted text-muted-foreground text-sm">
              Muted background with muted text
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="mt-8 flex flex-col gap-3">
          <Button onClick={handleSave} disabled={isSaving} className="w-full">
            <Save className="h-4 w-4 mr-2" />
            {isSaving ? "Saving..." : "Save Theme"}
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleReset} className="flex-1 bg-transparent">
              <RotateCcw className="h-4 w-4 mr-2" />
              Reset to Default
            </Button>
            <Button variant="ghost" onClick={handleCancel} className="flex-1">
              <X className="h-4 w-4 mr-2" />
              Cancel
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}

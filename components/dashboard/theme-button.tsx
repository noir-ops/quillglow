"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Palette } from "lucide-react"
import { ThemeStudio } from "@/components/theme-studio/theme-studio"

export function ThemeButton() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)} className="gap-2">
        <Palette className="h-4 w-4" />
        <span className="hidden sm:inline">Customize</span>
      </Button>
      <ThemeStudio open={open} onOpenChange={setOpen} />
    </>
  )
}

"use client"

import { useEffect, useState } from "react"
import { X } from "lucide-react"
import { Button } from "@/components/ui/button"

export function DiscordBannerPopup() {
  const [isOpen, setIsOpen] = useState(false)
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    setIsMounted(true)

    // Check if banner was dismissed
    const isDismissed = localStorage.getItem("discord-banner-dismissed")
    if (isDismissed) return

    // Show banner after 15 seconds
    const timer = setTimeout(() => {
      setIsOpen(true)
    }, 15000)

    return () => clearTimeout(timer)
  }, [])

  const handleClose = () => {
    setIsOpen(false)
    localStorage.setItem("discord-banner-dismissed", "true")
  }

  const handleJoin = () => {
    window.open("https://discord.gg/vDMGQ6HUYG", "_blank")
    handleClose()
  }

  if (!isMounted || !isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={handleClose} />

      {/* Banner Content */}
      <div className="relative w-full max-w-2xl overflow-hidden rounded-2xl shadow-2xl animate-in fade-in zoom-in-95 duration-500">
        {/* Background Image */}
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage: "url(/quillglow-banner.jpg)",
          }}
        />

        {/* Overlay Gradient for better text readability */}
        <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/50 to-transparent" />

        {/* Content */}
        <div className="relative z-10 flex flex-col items-center justify-center gap-6 px-6 py-12 sm:px-12 sm:py-16">
          {/* Close Button */}
          <button
            onClick={handleClose}
            className="absolute right-4 top-4 rounded-full p-2 hover:bg-white/20 transition-colors"
            aria-label="Close banner"
          >
            <X className="h-6 w-6 text-white" />
          </button>

          {/* Heading */}
          <div className="text-center space-y-4">
            <h2 className="text-3xl sm:text-4xl font-bold text-white text-balance">
              Study Together.
              <br />
              Grow Together.
            </h2>
            <p className="text-lg sm:text-xl text-white/90">Join the QuillGlow Discord Study Server</p>
          </div>

          {/* CTA Button */}
          <Button
            onClick={handleJoin}
            className="bg-gradient-to-r from-orange-400 to-amber-400 hover:from-orange-500 hover:to-amber-500 text-gray-900 font-semibold px-8 py-6 text-lg rounded-lg transition-all hover:shadow-lg"
          >
            Join the crew now
          </Button>

          {/* Discord Icon Badge */}
          <div className="absolute left-6 top-6 sm:left-10 sm:top-10 h-12 w-12 sm:h-16 sm:w-16 rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center">
            <svg className="h-6 w-6 sm:h-8 sm:w-8 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.607 1.25a18.27 18.27 0 0 0-5.487 0c-.163-.386-.395-.875-.607-1.25a.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.042-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.294.075.075 0 0 1 .078-.01c3.928 1.793 8.18 1.793 12.062 0a.075.075 0 0 1 .079.009c.12.098.246.198.373.294a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.076.076 0 0 0-.041.107c.352.699.764 1.365 1.226 1.994a.078.078 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.057c.5-4.761-.838-8.898-3.549-12.56a.06.06 0 0 0-.031-.027zM8.02 15.33c-1.183 0-2.157-.965-2.157-2.156 0-1.193.974-2.157 2.157-2.157 1.183 0 2.157.964 2.157 2.157 0 1.191-.974 2.156-2.157 2.156zm7.975 0c-1.183 0-2.157-.965-2.157-2.156 0-1.193.974-2.157 2.157-2.157 1.183 0 2.157.964 2.157 2.157 0 1.191-.974 2.156-2.157 2.156z" />
            </svg>
          </div>
        </div>
      </div>
    </div>
  )
}

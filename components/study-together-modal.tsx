"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { CheckCircle2 } from "lucide-react"

interface StudyTogetherModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function StudyTogetherModal({ open, onOpenChange }: StudyTogetherModalProps) {
  const [selectedOption, setSelectedOption] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [hasSubmitted, setHasSubmitted] = useState(false)
  const [alreadyResponded, setAlreadyResponded] = useState(false)

  useEffect(() => {
    if (open) {
      // Check if user already submitted feedback
      fetch("/api/feature-feedback?feature_name=study-together")
        .then((res) => res.json())
        .then((data) => {
          if (data.hasSubmitted) {
            setAlreadyResponded(true)
            setSelectedOption(data.selectedOption)
          }
        })
        .catch((error) => {
          console.error("[v0] Failed to check feedback status:", error)
        })
    }
  }, [open])

  const handleSubmit = async (option: string) => {
    if (isSubmitting || alreadyResponded) return

    setSelectedOption(option)
    setIsSubmitting(true)

    try {
      const response = await fetch("/api/feature-feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          feature_name: "study-together",
          selected_option: option,
        }),
      })

      if (response.ok) {
        setHasSubmitted(true)
      } else {
        const data = await response.json()
        if (data.error === "Feedback already submitted") {
          setAlreadyResponded(true)
        }
      }
    } catch (error) {
      console.error("[v0] Failed to submit feedback:", error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const options = [
    { value: "yes", label: "Yes, I would use this" },
    { value: "maybe", label: "Maybe — only if it's optional" },
    { value: "no", label: "No, I prefer studying alone" },
  ]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {alreadyResponded ? (
          <div className="text-center py-6">
            <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-4" />
            <DialogTitle className="text-xl mb-2">Thank you</DialogTitle>
            <DialogDescription className="text-base">
              You've already shared your thoughts on this feature. Your feedback helps shape QuillGlow.
            </DialogDescription>
          </div>
        ) : hasSubmitted ? (
          <div className="text-center py-6">
            <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-4" />
            <DialogTitle className="text-xl mb-2">Thanks for your feedback</DialogTitle>
            <DialogDescription className="text-base">Your feedback helps shape QuillGlow.</DialogDescription>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="text-xl">We're exploring a new feature</DialogTitle>
              <DialogDescription className="text-base leading-relaxed pt-2">
                Some students have asked for a way to collaborate or study together inside QuillGlow. Before building
                anything, we'd love to know how you feel about it.
              </DialogDescription>
            </DialogHeader>

            <div className="pt-4">
              <p className="text-sm font-medium text-foreground mb-4">
                Would you personally use a 'Study Together' feature?
              </p>

              <div className="space-y-2">
                {options.map((option) => (
                  <Button
                    key={option.value}
                    variant="outline"
                    className="w-full justify-start text-left h-auto py-3 px-4 hover:bg-accent hover:text-accent-foreground disabled:opacity-50 bg-transparent"
                    onClick={() => handleSubmit(option.value)}
                    disabled={isSubmitting}
                  >
                    {option.label}
                  </Button>
                ))}
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

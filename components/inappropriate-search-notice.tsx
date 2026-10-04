"use client"

import { Dialog, DialogContent } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { ShieldCheck, Sparkles } from "lucide-react"

interface InappropriateSearchNoticeProps {
  isOpen: boolean
  onClose: () => void
}

export function InappropriateSearchNotice({ isOpen, onClose }: InappropriateSearchNoticeProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md border-2">
        <div className="flex flex-col items-center text-center p-4 sm:p-6">
          {/* Icon */}
          <div className="relative mb-6">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-emerald-100 to-blue-100 flex items-center justify-center">
              <ShieldCheck className="h-10 w-10 text-emerald-600" />
            </div>
            <div className="absolute -top-1 -right-1">
              <Sparkles className="h-6 w-6 text-yellow-500 fill-yellow-500" />
            </div>
          </div>

          {/* Title */}
          <h2 className="text-2xl font-bold text-foreground mb-3">Let's Keep Learning Safe! 🎓</h2>

          {/* Message */}
          <p className="text-muted-foreground mb-2 leading-relaxed">
            Oops! It looks like your search might not be appropriate for our educational platform.
          </p>
          <p className="text-muted-foreground mb-6 leading-relaxed">
            QuillGlow is designed to help you learn and grow. Let's search for something educational instead!
          </p>

          {/* Suggestions */}
          <div className="w-full bg-gradient-to-r from-emerald-50 to-blue-50 dark:from-emerald-950/30 dark:to-blue-950/30 rounded-xl p-4 mb-6 border-2 border-emerald-200 dark:border-emerald-800">
            <p className="text-sm font-semibold text-foreground mb-2">Try searching for:</p>
            <ul className="text-sm text-muted-foreground space-y-1 text-left">
              <li>• Science topics (e.g., "Explain photosynthesis")</li>
              <li>• Math help (e.g., "How to solve quadratic equations")</li>
              <li>• History lessons (e.g., "World War 2 timeline")</li>
              <li>• Study tips and techniques</li>
            </ul>
          </div>

          {/* Action Button */}
          <Button
            onClick={onClose}
            size="lg"
            className="w-full sm:w-auto px-8 rounded-xl font-semibold bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-700 hover:to-emerald-600"
          >
            Got it, let's learn!
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

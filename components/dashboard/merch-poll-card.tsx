'use client'

import Link from "next/link"
import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Gift, ArrowRight } from "lucide-react"

export function MerchPollCard() {
  const supabase = createClient()
  const [hasVoted, setHasVoted] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const checkVote = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          setIsLoading(false)
          return
        }

        const { data } = await supabase
          .from("feature_feedback")
          .select("id")
          .eq("user_id", user.id)
          .eq("feature_name", "merch")
          .maybeSingle()

        setHasVoted(!!data)
      } catch (error) {
        console.error("Error checking vote:", error)
      } finally {
        setIsLoading(false)
      }
    }

    checkVote()
  }, [supabase])

  if (isLoading) return null

  return (
    <Link href="/shop" className="group block">
      <Card className="overflow-hidden border-2 border-[#7C3AED]/20 bg-gradient-to-br from-[#EDE9FF]/50 to-[#F3F0FF]/30 hover:border-[#7C3AED]/40 hover:shadow-lg transition-all duration-300 p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex gap-4 flex-1 min-w-0">
            {/* Icon */}
            <div className="flex-shrink-0 h-12 w-12 rounded-xl bg-[#7C3AED]/15 flex items-center justify-center border border-[#7C3AED]/20">
              <Gift className="h-6 w-6 text-[#7C3AED]" />
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-[#1C1917] text-base mb-1">
                {hasVoted ? "Thanks for voting!" : "Quick Poll: Merch?"}
              </h3>
              <p className="text-sm text-muted-foreground line-clamp-2">
                {hasVoted 
                  ? "Your feedback helps shape QuillGlow's future."
                  : "Would you wear QuillGlow hoodies or caps? Let us know!"}
              </p>
            </div>
          </div>

          {/* Arrow */}
          <Button
            variant="ghost"
            size="sm"
            className="flex-shrink-0 gap-1.5 text-[#7C3AED] hover:bg-[#7C3AED]/10"
            asChild
          >
            <span>
              {hasVoted ? "View" : "Vote"}
              <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
            </span>
          </Button>
        </div>
      </Card>
    </Link>
  )
}

"use client"

import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { CheckCircle, Loader2 } from "lucide-react"

export default function UpgradeSuccessPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  // Support both Polar checkout_id and legacy session_id
  const checkoutId = searchParams.get("checkout_id") || searchParams.get("session_id")
  const [verifying, setVerifying] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (checkoutId) {
      verifyPayment()
    } else {
      setError("No checkout ID found. Please try upgrading again.")
      setVerifying(false)
    }
  }, [checkoutId])

  const verifyPayment = async () => {
    try {
      const response = await fetch("/api/subscription/verify-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ checkoutId }),
      })

      if (!response.ok) {
        throw new Error("Failed to verify payment")
      }

      setVerifying(false)
    } catch (error) {
      console.error("[v0] Error verifying payment:", error)
      setError("Failed to verify payment. Please contact support.")
      setVerifying(false)
    }
  }

  if (verifying) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4" />
            <p className="text-lg">Verifying your payment...</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-red-500">Payment Verification Failed</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => router.push("/dashboard")} className="w-full">
              Back to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex items-center justify-center min-h-screen p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
          <CardTitle className="text-2xl">Welcome to Genius!</CardTitle>
          <CardDescription>
            Your subscription has been activated successfully. You now have unlimited access to all features.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button onClick={() => router.push("/dashboard")} className="w-full">
            Go to Dashboard
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

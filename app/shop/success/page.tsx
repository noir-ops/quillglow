"use client"

import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import Link from "next/link"
import {
  CheckCircle,
  Sparkles,
  ArrowRight,
  Mail,
  Download,
  Loader2,
} from "lucide-react"

interface OrderDetails {
  orderId: string
  customerEmail: string
  amount: number
  currency: string
  productName: string
  trackerFileUrl?: string
  emailSent?: boolean
}

export default function SuccessPage() {
  const searchParams = useSearchParams()
  const checkoutId = searchParams.get("checkout_id")
  const [orderDetails, setOrderDetails] = useState<OrderDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function verifyPayment() {
      if (!checkoutId) {
        setError("No checkout ID found. If you just completed a purchase, please check your email for the confirmation.")
        setLoading(false)
        return
      }

      try {
        const response = await fetch("/api/shop/verify-payment", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ checkoutId }),
        })

        const data = await response.json()

        if (!response.ok) {
          throw new Error(data.error || "Failed to verify payment")
        }

        setOrderDetails({
          orderId: data.orderId,
          customerEmail: data.customerEmail,
          amount: data.amount,
          currency: data.currency || "usd",
          productName: data.productName,
          trackerFileUrl: data.trackerFileUrl,
          emailSent: data.emailSent,
        })
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to verify payment")
      } finally {
        setLoading(false)
      }
    }

    verifyPayment()
  }, [checkoutId])

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 flex items-center justify-center p-4">
        <Card className="p-8 max-w-md w-full text-center bg-white/90 backdrop-blur-xl border-2 border-blue-200">
          <Loader2 className="w-12 h-12 animate-spin text-blue-600 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">
            Processing Your Order...
          </h2>
          <p className="text-gray-600">Please wait while we confirm your payment.</p>
        </Card>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 flex items-center justify-center p-4">
        <Card className="p-8 max-w-md w-full text-center bg-white/90 backdrop-blur-xl border-2 border-red-200">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">⚠️</span>
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">
            Verification Failed
          </h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <Link href="/shop">
            <Button className="bg-blue-600 hover:bg-blue-700">
              Return to Shop
            </Button>
          </Link>
        </Card>
      </div>
    )
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
      {/* Floating background shapes */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div
          animate={{
            y: [0, -20, 0],
            rotate: [0, 5, 0],
          }}
          transition={{ duration: 8, repeat: Number.POSITIVE_INFINITY }}
          className="absolute top-20 left-10 w-32 h-32 bg-gradient-to-br from-blue-300/30 to-purple-300/30 rounded-full blur-3xl"
        />
        <motion.div
          animate={{
            y: [0, 20, 0],
            rotate: [0, -5, 0],
          }}
          transition={{ duration: 10, repeat: Number.POSITIVE_INFINITY }}
          className="absolute top-40 right-20 w-40 h-40 bg-gradient-to-br from-pink-300/30 to-orange-300/30 rounded-full blur-3xl"
        />
      </div>

      <div className="container mx-auto px-4 py-16 max-w-3xl relative">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
        >
          <Card className="p-8 sm:p-12 bg-white/90 backdrop-blur-xl border-2 border-blue-200 shadow-2xl">
            {/* Success Icon */}
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
              className="flex justify-center mb-6"
            >
              <div className="relative">
                <div className="w-24 h-24 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-full flex items-center justify-center">
                  <CheckCircle className="w-14 h-14 text-white" />
                </div>
                <motion.div
                  animate={{
                    scale: [1, 1.2, 1],
                    opacity: [1, 0.5, 1],
                  }}
                  transition={{ duration: 2, repeat: Number.POSITIVE_INFINITY }}
                  className="absolute inset-0 bg-emerald-400/30 rounded-full blur-xl"
                />
              </div>
            </motion.div>

            {/* Success Message */}
            <div className="text-center mb-8">
              <h1 className="text-3xl sm:text-4xl font-black text-gray-900 mb-3">
                Payment Successful!
              </h1>
              <p className="text-lg text-gray-600">
                Thank you for your purchase. Your order has been confirmed!
              </p>
            </div>

            {/* Order Details */}
            {orderDetails && (
              <div className="space-y-4 mb-8">
                <div className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-xl p-6 border border-blue-100">
                  <h2 className="font-bold text-lg mb-4 text-gray-900">
                    Order Details
                  </h2>
                  <dl className="space-y-3">
                    <div className="flex justify-between items-center">
                      <dt className="text-gray-600">Product:</dt>
                      <dd className="font-semibold text-gray-900">
                        {orderDetails.productName}
                      </dd>
                    </div>
                    <div className="flex justify-between items-center">
                      <dt className="text-gray-600">Amount Paid:</dt>
                      <dd className="font-semibold text-emerald-600">
                        {orderDetails.currency?.toUpperCase()} ${(orderDetails.amount / 100).toFixed(2)}
                      </dd>
                    </div>
                    <div className="flex justify-between items-start">
                      <dt className="text-gray-600">Order ID:</dt>
                      <dd className="font-mono text-sm text-gray-700 text-right break-all max-w-[220px]">
                        {orderDetails.orderId}
                      </dd>
                    </div>
                  </dl>
                </div>

                {/* Download Button */}
                {orderDetails.trackerFileUrl && (
                  <a
                    href={orderDetails.trackerFileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 w-full py-3 px-6 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-bold rounded-xl shadow-lg transition-all hover:scale-[1.01]"
                  >
                    <Download className="w-5 h-5" />
                    Download Your Study Tracker
                  </a>
                )}

                {/* Email Confirmation */}
                <div className="flex items-start gap-3 p-4 bg-blue-50 rounded-xl border border-blue-100">
                  <Mail className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-gray-900 mb-1">
                      {orderDetails.emailSent ? "Confirmation Email Sent" : "Confirmation Email Queued"}
                    </p>
                    <p className="text-sm text-gray-600">
                      {orderDetails.emailSent
                        ? <>A receipt with your download link has been sent to{" "}<span className="font-semibold text-gray-900">{orderDetails.customerEmail}</span></>
                        : <>Check your inbox at{" "}<span className="font-semibold text-gray-900">{orderDetails.customerEmail}</span>{" "}for the download link.</>
                      }
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="space-y-3">
              <Link href="/dashboard" className="block">
                <Button
                  size="lg"
                  className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-bold h-12 rounded-xl shadow-lg"
                >
                  <Sparkles className="w-5 h-5 mr-2" />
                  Go to Dashboard
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
              </Link>
              <Link href="/shop/orders" className="block">
                <Button
                  variant="outline"
                  size="lg"
                  className="w-full border-blue-200 hover:bg-blue-50 font-semibold h-12 rounded-xl bg-transparent"
                >
                  <Download className="w-5 h-5 mr-2" />
                  View Order Status
                </Button>
              </Link>
            </div>

            {/* Support Note */}
            <p className="text-center text-sm text-gray-500 mt-6">
              Need help? Contact our support team anytime.
            </p>
          </Card>
        </motion.div>

        {/* Celebration Animation */}
        <div className="fixed inset-0 pointer-events-none flex items-center justify-center">
          {[...Array(20)].map((_, i) => (
            <motion.div
              key={i}
              initial={{
                opacity: 0,
                x: 0,
                y: 0,
                scale: 0,
              }}
              animate={{
                opacity: [0, 1, 0],
                x: Math.cos((i / 20) * Math.PI * 2) * 300,
                y: Math.sin((i / 20) * Math.PI * 2) * 300 - 200,
                scale: [0, 1, 0.5],
              }}
              transition={{
                duration: 2,
                delay: i * 0.05,
                ease: "easeOut",
              }}
              className="absolute w-3 h-3 bg-gradient-to-br from-blue-400 to-purple-400 rounded-full"
            />
          ))}
        </div>
      </div>
    </main>
  )
}

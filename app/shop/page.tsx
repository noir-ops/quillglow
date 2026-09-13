"use client"

import { useState } from "react"
import Link from "next/link"
import { useSearchParams, useRouter } from "next/navigation"
import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import {
  Check,
  ArrowLeft,
  ShoppingCart,
  Sparkles,
  Star,
  Zap,
  TrendingUp,
  Target,
  Loader2,
  BarChart3,
  Clock,
} from "lucide-react"
import { PRODUCTS } from "@/lib/products"
import { startCheckoutSession } from "@/app/actions/polar"
import { toast } from "sonner"
import { PayWithFamilyWallet } from "@/components/family-wallet/pay-with-family-wallet"

export default function ShopPage() {
  const [isLoading, setIsLoading] = useState(false)
  const searchParams = useSearchParams()
  const router = useRouter()
  const canceled = searchParams.get("canceled")

  const product = PRODUCTS[0]

  const handleCheckout = async () => {
    setIsLoading(true)
    try {
      const checkoutUrl = await startCheckoutSession(product.id)
      if (checkoutUrl) {
        window.location.href = checkoutUrl
      } else {
        throw new Error("Failed to create checkout session")
      }
    } catch (error) {
      console.error("[v0] Checkout error:", error)
      toast.error("Failed to start checkout. Please try again.")
      setIsLoading(false)
    }
  }

  // Format price
  const price = (product.priceInCents / 100).toFixed(2)
  const originalPrice = product.originalPriceInCents
    ? (product.originalPriceInCents / 100).toFixed(2)
    : null

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
        <motion.div
          animate={{
            y: [0, 15, 0],
            scale: [1, 1.1, 1],
          }}
          transition={{ duration: 7, repeat: Number.POSITIVE_INFINITY }}
          className="absolute bottom-20 left-1/4 w-48 h-48 bg-gradient-to-br from-purple-300/20 to-blue-300/20 rounded-full blur-3xl"
        />
      </div>

      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-xl border-b border-blue-100">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <span className="font-black text-xl bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              QuillGlow Shop
            </span>
          </Link>
          <Link href="/shop/orders">
            <Button variant="outline" size="sm" className="bg-white/50 border-blue-200 hover:bg-white/80">
              Order Status
            </Button>
          </Link>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8 max-w-5xl relative">
        {/* Back button */}
        <Link href="/">
          <Button
            variant="outline"
            size="sm"
            className="mb-6 bg-white/50 border-blue-200 hover:bg-white/80"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Home
          </Button>
        </Link>

        {/* Hero Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-12"
        >
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-black mb-4 leading-tight">
            <span className="text-gray-900">Level Up Your Studies with Our </span>
            <span className="bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
              Digital Study Tracker
            </span>
          </h1>
          <p className="text-lg sm:text-xl text-gray-600 max-w-2xl mx-auto">
            The ultimate productivity companion that combines tracking and analytics
            in one beautiful, organized system.
          </p>

          {/* Trust indicators */}
          <div className="flex items-center justify-center gap-6 mt-6 flex-wrap">
            <div className="flex items-center gap-2">
              <div className="flex">
                {[...Array(5)].map((_, i) => (
                  <Star
                    key={i}
                    className="w-5 h-5 fill-yellow-400 text-yellow-400"
                  />
                ))}
              </div>
              <span className="text-sm font-semibold text-gray-700">
                {product.rating.score}/5
              </span>
            </div>
            <div className="text-sm text-gray-600">
              {product.rating.count}+ students
            </div>
            <div className="flex items-center gap-1 text-sm text-emerald-600 font-semibold">
              <Zap className="w-4 h-4" />
              Instant Access
            </div>
          </div>
        </motion.div>

        {/* Product showcase images */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-12">
          {[1, 2, 3].map((index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
            >
              <Card className="overflow-hidden border-2 border-blue-100 bg-white/80 backdrop-blur-sm hover:shadow-xl transition-shadow">
                <div className="aspect-video bg-gradient-to-br from-blue-100 via-purple-100 to-pink-100 flex items-center justify-center">
                  <div className="text-center p-6">
                    {index === 1 && (
                      <>
                      <img
                        src="/images/study-tracker-preview-1.jpeg"
                        alt="Study Tracker Screenshot"
                        className="rounded-lg shadow-md w-[200px] h-[200px] object-cover"
                      />
                      </>
                    )}
                    {index === 2 && (
                      <>
                      <img
                        src="/images/study-tracker-preview-2.jpeg"
                        alt="Study Tracker Screenshot"
                        className="rounded-lg shadow-md w-[200px] h-[200px] object-cover"
                      />
                      </>
                    )}
                    {index === 3 && (
                      <>
                      <img
                        src="/images/study-tracker-preview-3.jpeg"
                        alt="Study Tracker Screenshot"
                        className="rounded-lg shadow-md w-[200px] h-[200px] object-cover"
                      />
                      </>
                    )}
                  </div>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Main Product Card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          <Card className="p-6 sm:p-8 md:p-10 bg-white/90 backdrop-blur-xl border-2 border-blue-200 shadow-2xl">
            {/* Title */}
            <div className="text-center mb-6">
              <h2 className="text-2xl sm:text-3xl font-black text-gray-900 mb-2">
                {product.name}
              </h2>
              <p className="text-gray-600">{product.description}</p>
            </div>

            {/* Rating */}
            <div className="flex items-center justify-center gap-2 mb-6">
              <div className="flex">
                {[...Array(5)].map((_, i) => (
                  <Star
                    key={i}
                    className={`w-5 h-5 ${
                      i < Math.floor(product.rating.score)
                        ? "fill-yellow-400 text-yellow-400"
                        : "fill-gray-200 text-gray-200"
                    }`}
                  />
                ))}
              </div>
              <span className="text-sm font-semibold text-gray-700">
                ({product.rating.score}/5 from {product.rating.count}+ students)
              </span>
            </div>

            {/* Price */}
            <div className="text-center mb-8">
              <div className="flex items-center justify-center gap-3 mb-2">
                <span className="text-5xl font-black bg-gradient-to-r from-emerald-600 to-emerald-500 bg-clip-text text-transparent">
                  ${price}
                </span>
                {originalPrice && (
                  <span className="text-2xl text-gray-400 line-through">
                    ${originalPrice}
                  </span>
                )}
              </div>
              {originalPrice && (
                <div className="inline-flex items-center gap-1 px-3 py-1 bg-orange-100 text-orange-700 rounded-full text-sm font-semibold">
                  <Zap className="w-4 h-4" />
                  Save {(((Number(originalPrice) - Number(price)) / Number(originalPrice)) * 100).toFixed(0)}% - Limited Time!
                </div>
              )}
            </div>

            {/* Features */}
            <div className="grid sm:grid-cols-2 gap-6 mb-8">
              {/* Tracker Features */}
              <div className="space-y-3">
                <h3 className="font-bold text-lg flex items-center gap-2 text-blue-600">
                  <Clock className="w-5 h-5" />
                  Study Tracker Features
                </h3>
                {product.features.tracker.map((feature, index) => (
                  <div key={index} className="flex items-start gap-2">
                    <Check className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" />
                    <span className="text-gray-700">{feature}</span>
                  </div>
                ))}
              </div>

              {/* Insights Features */}
              <div className="space-y-3">
                <h3 className="font-bold text-lg flex items-center gap-2 text-purple-600">
                  <BarChart3 className="w-5 h-5" />
                  Analytics & Insights
                </h3>
                {product.features.insights.map((feature, index) => (
                  <div key={index} className="flex items-start gap-2">
                    <Check className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" />
                    <span className="text-gray-700">{feature}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* What's Included */}
            <div className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-2xl p-6 mb-8 border border-blue-100">
              <h3 className="font-bold text-lg mb-4 text-gray-900">
                What's Included:
              </h3>
              <ul className="space-y-2">
                {product.whatsIncluded.map((item, index) => (
                  <li key={index} className="flex items-center gap-2 text-gray-700">
                    <div className="w-1.5 h-1.5 bg-blue-500 rounded-full" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            {/* CTA Button */}
            <Button
              size="lg"
              onClick={handleCheckout}
              disabled={isLoading}
              className="w-full bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 hover:from-blue-700 hover:via-purple-700 hover:to-pink-700 text-white font-black h-14 sm:h-16 text-base sm:text-lg rounded-2xl shadow-xl shadow-purple-500/25 transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl disabled:opacity-70 disabled:cursor-not-allowed disabled:hover:scale-100"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Redirecting to Checkout...
                </>
              ) : (
                <>
                  <ShoppingCart className="w-5 h-5 mr-2" />
                  Get Your Study Tracker Now
                </>
              )}
            </Button>

            <div className="mt-3">
              <PayWithFamilyWallet
                chargeEndpoint="/api/shop/pay-with-family-wallet"
                chargeBody={{ productId: product.id }}
                label={`Pay $${price} with family balance`}
                onSuccess={(data) => {
                  toast.success("Purchased with your family balance!")
                  router.push(`/shop/orders?order_id=${data.orderId}`)
                }}
              />
            </div>

            <p className="text-center text-sm text-gray-500 mt-4">
              Secure checkout powered by Polar
            </p>
          </Card>
        </motion.div>

        {/* Purchase Guidelines */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.5 }}
          className="mt-12"
        >
          <Card className="p-6 sm:p-8 bg-white/80 backdrop-blur-sm border border-blue-100">
            <h3 className="font-bold text-xl mb-4 text-gray-900">
              Purchase & Order Guidelines
            </h3>
            <ul className="space-y-3 text-gray-700">
              <li className="flex items-start gap-2">
                <div className="w-1.5 h-1.5 bg-blue-500 rounded-full mt-2 flex-shrink-0" />
                <span>
                  After you complete payment, your order will be processed and you'll receive instant access.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <div className="w-1.5 h-1.5 bg-blue-500 rounded-full mt-2 flex-shrink-0" />
                <span>
                  To check your order status, use your email address by clicking the Order Status button above.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <div className="w-1.5 h-1.5 bg-blue-500 rounded-full mt-2 flex-shrink-0" />
                <span>
                  If you have any issues or questions, please contact our support team.
                </span>
              </li>
            </ul>
          </Card>
        </motion.div>
      </div>

      {/* Canceled Message */}
      {canceled && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-6 py-4 bg-orange-100 border-2 border-orange-300 rounded-2xl shadow-xl max-w-md"
        >
          <p className="text-orange-800 font-semibold text-center">
            Checkout was canceled. Feel free to try again when you're ready!
          </p>
        </motion.div>
      )}
    </main>
  )
}

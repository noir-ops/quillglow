"use client"

import React from "react"

import { useState } from "react"
import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import Link from "next/link"
import {
  Search,
  ArrowLeft,
  Package,
  Mail,
  Calendar,
  Download,
  Loader2,
  Sparkles,
} from "lucide-react"

interface Order {
  id: string
  product_name: string
  amount: number
  currency: string
  email: string
  name: string
  status: string
  tracker_file_url: string | null
  created_at: string
}

export default function OrdersPage() {
  const [email, setEmail] = useState("")
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!email.trim()) {
      return
    }

    setLoading(true)
    setError(null)
    setSearched(true)

    try {
      const response = await fetch(
        `/api/orders/search?email=${encodeURIComponent(email)}`
      )

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch orders")
      }

      setOrders(data.orders || [])
    } catch (err) {
      console.error("[v0] Orders search error:", err)
      setError(err instanceof Error ? err.message : "Failed to fetch orders")
    } finally {
      setLoading(false)
    }
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

      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-xl border-b border-blue-100">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/shop" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <span className="font-black text-xl bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              QuillGlow Shop
            </span>
          </Link>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8 max-w-4xl relative">
        {/* Back button */}
        <Link href="/shop">
          <Button
            variant="outline"
            size="sm"
            className="mb-6 bg-white/50 border-blue-200 hover:bg-white/80"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Shop
          </Button>
        </Link>

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-8"
        >
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-black mb-3">
            <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              Order Status
            </span>
          </h1>
          <p className="text-gray-600 text-lg">
            Enter your email to view your order history
          </p>
        </motion.div>

        {/* Search Form */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <Card className="p-6 sm:p-8 bg-white/90 backdrop-blur-xl border-2 border-blue-200 shadow-xl mb-8">
            <form onSubmit={handleSearch} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-gray-900 font-semibold">
                  Email Address
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="your.email@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="pl-10 h-12 border-blue-200 focus:border-blue-400 bg-white"
                  />
                </div>
              </div>

              <Button
                type="submit"
                size="lg"
                disabled={loading}
                className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-bold h-12 rounded-xl shadow-lg"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Searching...
                  </>
                ) : (
                  <>
                    <Search className="w-5 h-5 mr-2" />
                    Search Orders
                  </>
                )}
              </Button>
            </form>
          </Card>
        </motion.div>

        {/* Error State */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Card className="p-6 bg-red-50 border-2 border-red-200 mb-8">
              <p className="text-red-800 text-center font-semibold">{error}</p>
            </Card>
          </motion.div>
        )}

        {/* Orders List */}
        {searched && !loading && !error && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="space-y-4"
          >
            {orders.length === 0 ? (
              <Card className="p-12 text-center bg-white/90 backdrop-blur-xl border-2 border-blue-200">
                <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-gray-900 mb-2">
                  No Orders Found
                </h3>
                <p className="text-gray-600">
                  We couldn't find any orders associated with this email address.
                </p>
              </Card>
            ) : (
              <>
                <h2 className="text-2xl font-bold text-gray-900 mb-4">
                  Your Orders ({orders.length})
                </h2>
                {orders.map((order, index) => (
                  <motion.div
                    key={order.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3, delay: index * 0.1 }}
                  >
                    <Card className="p-6 bg-white/90 backdrop-blur-xl border-2 border-blue-100 hover:shadow-xl transition-shadow">
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <h3 className="font-bold text-lg text-gray-900 mb-1">
                            {order.product_name}
                          </h3>
                          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-sm font-semibold">
                            {order.status === "completed" ? "✓ Completed" : order.status}
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-black text-gray-900">
                            ${(order.amount / 100).toFixed(2)}
                          </p>
                          <p className="text-sm text-gray-500 uppercase">
                            {order.currency}
                          </p>
                        </div>
                      </div>

                      <div className="grid sm:grid-cols-2 gap-4 pt-4 border-t border-gray-100">
                        <div className="flex items-center gap-2 text-sm">
                          <Mail className="w-4 h-4 text-gray-400" />
                          <span className="text-gray-600">{order.email}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <Calendar className="w-4 h-4 text-gray-400" />
                          <span className="text-gray-600">
                            {new Date(order.created_at).toLocaleDateString("en-US", {
                              year: "numeric",
                              month: "long",
                              day: "numeric",
                            })}
                          </span>
                        </div>
                      </div>

                      {order.tracker_file_url && (
                        <div className="mt-4 pt-4 border-t border-gray-100">
                          <a
                            href={order.tracker_file_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white text-sm font-semibold rounded-lg transition-all"
                          >
                            <Download className="w-4 h-4" />
                            Download Study Tracker
                          </a>
                        </div>
                      )}

                      <div className="mt-3">
                        <p className="text-xs text-gray-400">
                          Order ID: <span className="font-mono">{order.id}</span>
                        </p>
                      </div>
                    </Card>
                  </motion.div>
                ))}
              </>
            )}
          </motion.div>
        )}
      </div>
    </main>
  )
}

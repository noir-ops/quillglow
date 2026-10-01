"use server"

// Polar.sh API client helper

const POLAR_BASE_URL = process.env.POLAR_BASE_URL || "https://api.polar.sh/v1"
const POLAR_ACCESS_TOKEN = process.env.POLAR_ACCESS_TOKEN

export async function polarFetch(endpoint: string, options: RequestInit = {}) {
  if (!POLAR_ACCESS_TOKEN) {
    throw new Error("POLAR_ACCESS_TOKEN is not configured")
  }

  const response = await fetch(`${POLAR_BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${POLAR_ACCESS_TOKEN}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  })

  return response
}

export interface PolarCheckoutCreate {
  product_id: string
  success_url: string
  metadata?: Record<string, string>
  customer_email?: string
}

export interface PolarCheckout {
  id: string
  url: string
  status: "open" | "expired" | "succeeded"
  customer_id?: string
  subscription_id?: string
  product_id: string
  metadata?: Record<string, string>
}

// Create a checkout session
export async function createPolarCheckout(data: PolarCheckoutCreate): Promise<PolarCheckout> {
  const response = await polarFetch("/checkouts/custom/", {
    method: "POST",
    body: JSON.stringify({
      product_id: data.product_id,
      success_url: data.success_url,
      metadata: data.metadata,
      customer_email: data.customer_email,
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Polar checkout creation failed: ${error}`)
  }

  return response.json()
}

// Get checkout session details (for verification)
export async function getPolarCheckout(checkoutId: string): Promise<PolarCheckout> {
  const response = await polarFetch(`/checkouts/custom/${checkoutId}`)

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Failed to get Polar checkout: ${error}`)
  }

  return response.json()
}

// Get subscription details
export async function getPolarSubscription(subscriptionId: string) {
  const response = await polarFetch(`/subscriptions/${subscriptionId}`)

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Failed to get Polar subscription: ${error}`)
  }

  return response.json()
}

// Cancel subscription
export async function cancelPolarSubscription(subscriptionId: string) {
  const response = await polarFetch(`/subscriptions/${subscriptionId}`, {
    method: "DELETE",
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Failed to cancel Polar subscription: ${error}`)
  }

  return response.json()
}

"use server"

import { STORE_COMING_SOON } from "@/lib/store-status"
import { createPolarCheckout } from "@/lib/polar"
import { PRODUCTS } from "@/lib/products"
import { headers } from "next/headers"

export async function startCheckoutSession(productId: string) {
  if (STORE_COMING_SOON) throw new Error("The Store is coming soon. New purchases are paused.")
  const product = PRODUCTS.find((p) => p.id === productId)
  if (!product) {
    throw new Error(`Product with id "${productId}" not found`)
  }

  // Get the origin for redirect URLs
  const headersList = await headers()
  const host = headersList.get("host") || ""
  const protocol = host.includes("localhost") ? "http" : "https"
  const baseUrl = `${protocol}://${host}`

  // Use the Polar product ID for shop items
  const polarProductId = process.env.POLAR_PRODUCT_ID_SHOP || process.env.POLAR_PRODUCT_ID_GENIUS

  if (!polarProductId) {
    throw new Error("POLAR_PRODUCT_ID is not configured")
  }

  // Create Polar checkout session
  const checkout = await createPolarCheckout({
    product_id: polarProductId,
    success_url: `${baseUrl}/shop/success?checkout_id={CHECKOUT_ID}`,
    metadata: {
      product_id: product.id,
      product_name: product.name,
    },
  })

  // Return the checkout URL for redirect
  return checkout.url
}

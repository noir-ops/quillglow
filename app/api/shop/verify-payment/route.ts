import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getPolarCheckout } from "@/lib/polar"

async function sendOrderEmail({
  to,
  customerName,
  productName,
  amount,
  currency,
  orderId,
  trackerFileUrl,
}: {
  to: string
  customerName: string
  productName: string
  amount: number
  currency: string
  orderId: string
  trackerFileUrl: string
}) {
  const apiKey = process.env.MAILERSEND_API_KEY
  const fromEmail = process.env.MAILERSEND_FROM_EMAIL || "noreply@quillglow.com"
  const fromName = process.env.MAILERSEND_FROM_NAME || "QuillGlow"

  if (!apiKey) {
    console.error("[v0] MAILERSEND_API_KEY not set — skipping email")
    return false
  }

  const amountFormatted = (amount / 100).toFixed(2)
  const currencyUpper = currency?.toUpperCase?.() ?? ""

  const htmlBody = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f8fafc; margin: 0; padding: 40px 20px;">
  <div style="max-width: 560px; margin: 0 auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08);">
    <!-- Header -->
    <div style="background: linear-gradient(135deg, #3b82f6, #8b5cf6); padding: 32px 40px; text-align: center;">
      <h1 style="color: white; margin: 0; font-size: 24px; font-weight: 900; letter-spacing: -0.5px;">QuillGlow</h1>
      <p style="color: rgba(255,255,255,0.85); margin: 8px 0 0; font-size: 15px;">Your order is confirmed</p>
    </div>
    <!-- Body -->
    <div style="padding: 40px;">
      <p style="color: #1e293b; font-size: 17px; margin: 0 0 8px;">Hi ${customerName || "there"},</p>
      <p style="color: #475569; font-size: 15px; margin: 0 0 32px; line-height: 1.6;">
        Thank you for your purchase! Your <strong>${productName}</strong> is ready. Use the button below to access your file.
      </p>

      <!-- Order details box -->
      <div style="background: #f1f5f9; border-radius: 12px; padding: 24px; margin-bottom: 32px;">
        <h3 style="margin: 0 0 16px; color: #0f172a; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px;">Order Summary</h3>
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 6px 0; color: #64748b; font-size: 14px;">Product</td>
            <td style="padding: 6px 0; color: #0f172a; font-size: 14px; font-weight: 600; text-align: right;">${productName}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #64748b; font-size: 14px;">Amount</td>
            <td style="padding: 6px 0; color: #059669; font-size: 14px; font-weight: 700; text-align: right;">${currencyUpper} ${amountFormatted}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #64748b; font-size: 14px;">Order ID</td>
            <td style="padding: 6px 0; color: #475569; font-size: 12px; font-family: monospace; text-align: right;">${orderId}</td>
          </tr>
        </table>
      </div>

      <!-- Download button -->
      <div style="text-align: center; margin-bottom: 32px;">
        <a href="${trackerFileUrl}" style="display: inline-block; background: linear-gradient(135deg, #3b82f6, #8b5cf6); color: white; text-decoration: none; padding: 14px 36px; border-radius: 10px; font-size: 16px; font-weight: 700; letter-spacing: -0.2px;">
          Download Your Study Tracker
        </a>
      </div>

      <p style="color: #94a3b8; font-size: 13px; text-align: center; margin: 0;">
        Need help? Reply to this email or visit our support page.<br>
        <a href="https://quillglow.com/shop/orders" style="color: #3b82f6;">View Order Status</a>
      </p>
    </div>
  </div>
</body>
</html>
`

  const response = await fetch("https://api.mailersend.com/v1/email", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: { email: fromEmail, name: fromName },
      to: [{ email: to, name: customerName || to }],
      subject: `Your ${productName} is ready — QuillGlow`,
      html: htmlBody,
    }),
  })

  return response.ok
}

export async function POST(request: NextRequest) {
  try {
    const { checkoutId } = await request.json()

    if (!checkoutId) {
      return NextResponse.json({ error: "checkout_id is required" }, { status: 400 })
    }

    const supabase = await createClient()

    // Check if already processed (idempotency) - by polar_session_id
    const { data: existing } = await supabase
      .from("study_tracker_orders")
      .select("id, email, product_name, price, currency, payment_status, created_at")
      .eq("polar_session_id", checkoutId)
      .maybeSingle()

    if (existing) {
      return NextResponse.json({
        orderId: existing.id,
        customerEmail: existing.email,
        price: existing.price,
        productName: existing.product_name,
        alreadyProcessed: true,
      })
    }

    // Verify checkout with Polar
    const checkout = await getPolarCheckout(checkoutId)

    if (checkout.status !== "succeeded") {
      return NextResponse.json(
        { error: `Payment not completed. Status: ${checkout.status}` },
        { status: 402 }
      )
    }

    // Extract order data from checkout
    const customerEmail = (checkout as any).customer_email || (checkout as any).customer?.email || ""
    const customerName = (checkout as any).customer_name || (checkout as any).customer?.name || ""
    const productName =
      (checkout as any).metadata?.product_name ||
      (checkout as any).product?.name ||
      "Study Tracker for Students"
    const price = (checkout as any).amount || (checkout as any).total_amount || 0
    const currency = (checkout as any).currency || null

    const trackerFileUrl = process.env.STUDY_TRACKER_TEMPLATE_URL || ""

    // Get logged-in user if any (optional)
    const { data: { user } } = await supabase.auth.getUser()

    // Insert order into study_tracker_orders according to new schema
    const { data: order, error: insertError } = await supabase
      .from("study_tracker_orders")
      .insert({
        user_id: user?.id ?? null,
        email: customerEmail,
        product_name: productName,
        price,
        payment_provider: "polar",
        payment_status: "completed",
        polar_session_id: checkoutId,
        currency: currency,
      })
      .select("id")
      .single()

    if (insertError) {
      console.error("[v0] Failed to insert order:", insertError)
      return NextResponse.json({ error: "Failed to save order" }, { status: 500 })
    }

    // Send confirmation email
    let emailSent = false
    if (customerEmail) {
      emailSent = await sendOrderEmail({
        to: customerEmail,
        customerName,
        productName,
        amount: price,
        currency,
        orderId: order.id,
        trackerFileUrl,
      })
    }

    return NextResponse.json({
      orderId: order.id,
      customerEmail,
      price,
      currency,
      productName,
      trackerFileUrl,
      emailSent,
    })
  } catch (error) {
    console.error("[v0] Shop verify-payment error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

import { createServerClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"

// GET - Verify a certificate by unique ID (public endpoint)
export async function GET(request: NextRequest) {
  const supabase = await createServerClient()
  const { searchParams } = new URL(request.url)
  const uniqueId = searchParams.get("id")

  if (!uniqueId) {
    return NextResponse.json({ error: "Certificate ID is required" }, { status: 400 })
  }

  // Search in certificate_data JSONB for the unique_id
  const { data: certificates, error } = await supabase
    .from("ambassador_certificates")
    .select("id, milestone, certificate_data, created_at")

  if (error) {
    return NextResponse.json({ valid: false, error: "Database error" }, { status: 500 })
  }

  // Find certificate with matching unique_id in certificate_data
  const certificate = certificates?.find(cert => {
    const data = cert.certificate_data as Record<string, unknown>
    return data?.unique_id === uniqueId
  })

  if (!certificate) {
    return NextResponse.json({ 
      valid: false, 
      error: "Certificate not found or invalid" 
    }, { status: 404 })
  }

  const certData = certificate.certificate_data as Record<string, unknown>

  return NextResponse.json({
    valid: true,
    certificate: {
      uniqueId: certData.unique_id,
      tier: certData.tier,
      title: certData.title,
      ambassadorName: certData.ambassador_name,
      university: certData.university,
      referralCount: certData.referral_count,
      issuedAt: certData.issued_at,
      founderSignature: certData.founder_signature,
      founderTitle: certData.founder_title,
    },
  })
}

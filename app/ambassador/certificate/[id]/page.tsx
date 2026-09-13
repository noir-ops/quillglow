"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Loader2, CheckCircle, XCircle, Award, Calendar, Users, GraduationCap, Shield } from "lucide-react"
import { cn } from "@/lib/utils"

interface CertificateData {
  uniqueId: string
  tier: string
  title: string
  ambassadorName: string
  university: string
  referralCount: number
  issuedAt: string
  founderSignature: string
  founderTitle: string
}

const TIER_STYLES: Record<string, { bg: string; border: string; text: string; badge: string; accent: string }> = {  
  bronze: {
    bg: "bg-gradient-to-br from-amber-50 via-orange-50 to-amber-100",
    border: "border-amber-400",
    text: "text-amber-800",
    badge: "bg-gradient-to-r from-amber-500 to-orange-500",
    accent: "text-amber-600",
  },
  silver: {
    bg: "bg-gradient-to-br from-slate-50 via-gray-100 to-slate-200",
    border: "border-slate-400",
    text: "text-slate-700",
    badge: "bg-gradient-to-r from-slate-500 to-gray-500",
    accent: "text-slate-600",
  },
  gold: {
    bg: "bg-gradient-to-br from-yellow-50 via-amber-50 to-yellow-100",
    border: "border-yellow-500",
    text: "text-yellow-800",
    badge: "bg-gradient-to-r from-yellow-500 to-amber-500",
    accent: "text-yellow-600",
  },
  platinum: {
    bg: "bg-gradient-to-br from-indigo-50 via-purple-50 to-indigo-100",
    border: "border-indigo-400",
    text: "text-indigo-800",
    badge: "bg-gradient-to-r from-indigo-500 to-purple-500",
    accent: "text-indigo-600",
  },
  diamond: {
    bg: "bg-gradient-to-br from-cyan-50 via-blue-50 to-cyan-100",
    border: "border-cyan-400",
    text: "text-cyan-800",
    badge: "bg-gradient-to-r from-cyan-500 to-blue-500",
    accent: "text-cyan-600",
  },
}

function CertificateDisplay({ certificate }: { certificate: CertificateData }) {
  const style = TIER_STYLES[certificate.tier] || TIER_STYLES.bronze

  return (
    <Card className={cn("border-4 shadow-2xl overflow-hidden relative", style.border, style.bg)}>
      {/* Decorative corners */}
      <div className="absolute top-0 left-0 w-20 h-20 border-t-4 border-l-4 border-current/20 rounded-tl-lg" />
      <div className="absolute top-0 right-0 w-20 h-20 border-t-4 border-r-4 border-current/20 rounded-tr-lg" />
      <div className="absolute bottom-0 left-0 w-20 h-20 border-b-4 border-l-4 border-current/20 rounded-bl-lg" />
      <div className="absolute bottom-0 right-0 w-20 h-20 border-b-4 border-r-4 border-current/20 rounded-br-lg" />

      <CardContent className="p-8 sm:p-12 relative">
        {/* Header */}
        <div className="text-center border-b-2 border-current/20 pb-8 mb-8">
          <div className="flex justify-center mb-4">
            <div className={cn("p-5 rounded-full shadow-lg", style.badge)}>
              <Award className="h-14 w-14 text-white" />
            </div>
          </div>
          <h1 className="text-xl uppercase tracking-[0.3em] text-muted-foreground font-semibold">QuillGlow</h1>
          <h2 className="text-3xl sm:text-4xl font-bold mt-3 tracking-tight">Certificate of Achievement</h2>
          <p className="text-muted-foreground mt-2">Campus Ambassador Program</p>
        </div>

        {/* Body */}
        <div className="text-center space-y-6">
          <p className="text-lg text-muted-foreground">This is to certify that</p>
          <h3 className={cn("text-4xl sm:text-5xl font-serif font-bold tracking-tight", style.text)}>
            {certificate.ambassadorName}
          </h3>
          <p className="text-lg text-muted-foreground">has successfully achieved the rank of</p>
          <Badge className={cn("text-xl px-8 py-3 text-white font-semibold shadow-lg", style.badge)}>
            {certificate.title}
          </Badge>
          <p className="text-muted-foreground max-w-md mx-auto">
            for outstanding contribution in spreading the power of AI-assisted learning 
            by successfully referring <span className="font-bold">{certificate.referralCount}</span> students to QuillGlow.
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-6 mt-10 pt-8 border-t-2 border-current/20">
          <div className="text-center">
            <div className={cn("w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-2", style.badge)}>
              <Users className="h-6 w-6 text-white" />
            </div>
            <p className="text-3xl font-bold">{certificate.referralCount}</p>
            <p className="text-sm text-muted-foreground">Referrals</p>
          </div>
          <div className="text-center">
            <div className={cn("w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-2", style.badge)}>
              <GraduationCap className="h-6 w-6 text-white" />
            </div>
            <p className="text-sm font-medium mt-1 line-clamp-2">{certificate.university || "N/A"}</p>
            <p className="text-sm text-muted-foreground">University</p>
          </div>
          <div className="text-center">
            <div className={cn("w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-2", style.badge)}>
              <Calendar className="h-6 w-6 text-white" />
            </div>
            <p className="text-sm font-medium mt-1">
              {new Date(certificate.issuedAt).toLocaleDateString("en-US", {
                month: "long",
                day: "numeric",
                year: "numeric",
              })}
            </p>
            <p className="text-sm text-muted-foreground">Issued</p>
          </div>
        </div>

        {/* Signature Section */}
        <div className="mt-10 pt-8 border-t-2 border-current/20">
          <div className="flex justify-between items-end">
            {/* Certificate ID */}
            <div className="text-left">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <Shield className="h-4 w-4" />
                <span className="text-xs uppercase tracking-wider">Certificate ID</span>
              </div>
              <p className="font-mono text-sm font-bold tracking-wider">{certificate.uniqueId}</p>
            </div>

            {/* Founder Signature */}
            <div className="text-right">
              <p className={cn("text-2xl font-serif italic", style.accent)}>
                {certificate.founderSignature}
              </p>
              <p className="text-sm text-muted-foreground mt-1">{certificate.founderTitle}</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export default function CertificateVerifyPage() {
  const params = useParams()
  const certificateId = params.id as string
  const [loading, setLoading] = useState(true)
  const [valid, setValid] = useState(false)
  const [certificate, setCertificate] = useState<CertificateData | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function verifyCertificate() {
      try {
        const res = await fetch(`/api/ambassador/certificate/verify?id=${certificateId}`)
        const data = await res.json()
        
        if (data.valid) {
          setValid(true)
          setCertificate(data.certificate)
        } else {
          setValid(false)
          setError(data.error || "Invalid certificate")
        }
      } catch {
        setError("Failed to verify certificate")
      } finally {
        setLoading(false)
      }
    }

    if (certificateId) {
      verifyCertificate()
    }
  }, [certificateId])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="mt-4 text-muted-foreground">Verifying certificate...</p>
        </div>
      </div>
    )
  }

  if (!valid || !certificate) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
        <Card className="max-w-md w-full border-red-200 bg-red-50">
          <CardContent className="pt-8 text-center">
            <XCircle className="h-16 w-16 mx-auto text-red-500" />
            <h1 className="mt-4 text-2xl font-bold text-red-700">Invalid Certificate</h1>
            <p className="mt-2 text-red-600">{error || "This certificate could not be verified."}</p>
            <p className="mt-4 text-sm text-muted-foreground">
              Certificate ID: {certificateId}
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100 p-4 py-12">
      <div className="max-w-2xl w-full">
        {/* Verification Badge */}
        <div className="flex justify-center mb-6">
          <Badge className="bg-green-500 text-white gap-2 px-5 py-2 text-sm shadow-lg">
            <CheckCircle className="h-4 w-4" />
            Verified Certificate
          </Badge>
        </div>

        {/* Certificate */}
        <CertificateDisplay certificate={certificate} />

        {/* Footer */}
        <p className="text-center text-sm text-muted-foreground mt-6">
          Verify any certificate at <span className="font-medium">quillglow.study/ambassador/certificate/[ID]</span>
        </p>
      </div>
    </div>
  )
}

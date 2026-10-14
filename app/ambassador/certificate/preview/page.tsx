"use client"

import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Award, Calendar, Users, GraduationCap, Shield, Eye, Download } from "lucide-react"
import { cn } from "@/lib/utils"

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

// Only milestones that include a certificate: 50, 100, 500
const SAMPLE_CERTIFICATES = [
  { tier: "silver", title: "Silver Ambassador", count: 50, reward: "Genius 3 Months + Certificate", name: "Malshan Dissanayaka", university: "University of Moratuwa" },
  { tier: "gold", title: "Gold Ambassador", count: 100, reward: "Genius 6 Months + Certificate", name: "Malshan Dissanayaka", university: "University of Moratuwa" },
  { tier: "diamond", title: "Diamond Ambassador", count: 500, reward: "Lifetime Genius + Certificate + Gift", name: "Malshan Dissanayaka", university: "University of Moratuwa" },
]

function CertificatePreview({ 
  tier, 
  title, 
  name, 
  university, 
  referralCount 
}: { 
  tier: string
  title: string
  name: string
  university: string
  referralCount: number
}) {
  const style = TIER_STYLES[tier] || TIER_STYLES.bronze
  const uniqueId = `QG-${tier.toUpperCase()}-PREVIEW01`
  const issuedAt = new Date().toISOString()

  return (
    <Card className={cn("border-4 shadow-2xl overflow-hidden relative", style.border, style.bg)}>
      {/* Decorative corners */}
      <div className="absolute top-0 left-0 w-16 h-16 border-t-4 border-l-4 border-current/20 rounded-tl-lg" />
      <div className="absolute top-0 right-0 w-16 h-16 border-t-4 border-r-4 border-current/20 rounded-tr-lg" />
      <div className="absolute bottom-0 left-0 w-16 h-16 border-b-4 border-l-4 border-current/20 rounded-bl-lg" />
      <div className="absolute bottom-0 right-0 w-16 h-16 border-b-4 border-r-4 border-current/20 rounded-br-lg" />

      <CardContent className="p-6 sm:p-10 relative">
        {/* Header */}
        <div className="text-center border-b-2 border-current/20 pb-6 mb-6">
          <div className="flex justify-center mb-3">
            <div className={cn("p-4 rounded-full shadow-lg", style.badge)}>
              <Award className="h-10 w-10 text-white" />
            </div>
          </div>
          <h1 className="text-lg uppercase tracking-[0.3em] text-muted-foreground font-semibold">QuillGlow</h1>
          <h2 className="text-2xl sm:text-3xl font-bold mt-2 tracking-tight">Certificate of Achievement</h2>
          <p className="text-sm text-muted-foreground mt-1">Campus Ambassador Program</p>
        </div>

        {/* Body */}
        <div className="text-center space-y-4">
          <p className="text-muted-foreground">This is to certify that</p>
          <h3 className={cn("text-3xl sm:text-4xl font-serif font-bold tracking-tight", style.text)}>
            {name}
          </h3>
          <p className="text-muted-foreground">has successfully achieved the rank of</p>
          <Badge className={cn("text-lg px-6 py-2 text-white font-semibold shadow-lg", style.badge)}>
            {title}
          </Badge>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto">
            for outstanding contribution in spreading the power of AI-assisted learning 
            by successfully referring <span className="font-bold">{referralCount}</span> students to QuillGlow.
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mt-8 pt-6 border-t-2 border-current/20">
          <div className="text-center">
            <div className={cn("w-10 h-10 rounded-full flex items-center justify-center mx-auto mb-1", style.badge)}>
              <Users className="h-5 w-5 text-white" />
            </div>
            <p className="text-2xl font-bold">{referralCount}</p>
            <p className="text-xs text-muted-foreground">Referrals</p>
          </div>
          <div className="text-center">
            <div className={cn("w-10 h-10 rounded-full flex items-center justify-center mx-auto mb-1", style.badge)}>
              <GraduationCap className="h-5 w-5 text-white" />
            </div>
            <p className="text-xs font-medium mt-1 line-clamp-2">{university}</p>
            <p className="text-xs text-muted-foreground">University</p>
          </div>
          <div className="text-center">
            <div className={cn("w-10 h-10 rounded-full flex items-center justify-center mx-auto mb-1", style.badge)}>
              <Calendar className="h-5 w-5 text-white" />
            </div>
            <p className="text-xs font-medium mt-1">
              {new Date(issuedAt).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </p>
            <p className="text-xs text-muted-foreground">Issued</p>
          </div>
        </div>

        {/* Signature Section */}
        <div className="mt-8 pt-6 border-t-2 border-current/20">
          <div className="flex justify-between items-end">
            {/* Certificate ID */}
            <div className="text-left">
              <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                <Shield className="h-3.5 w-3.5" />
                <span className="text-xs uppercase tracking-wider">Certificate ID</span>
              </div>
              <p className="font-mono text-xs font-bold tracking-wider">{uniqueId}</p>
            </div>

            {/* Founder Signature */}
            <div className="text-right">
              <p className={cn("text-xl font-serif italic", style.accent)}>
                Malshan Dissanayaka
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">Founder of QuillGlow</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export default function CertificatePreviewPage() {
  const [selectedTier, setSelectedTier] = useState("silver")
  const selected = SAMPLE_CERTIFICATES.find(c => c.tier === selectedTier) || SAMPLE_CERTIFICATES[0]

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-blue-50 to-slate-100 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <Badge className="bg-amber-500 text-white gap-1.5 px-4 py-1.5 mb-4">
            <Eye className="h-4 w-4" />
            Developer Preview
          </Badge>
          <h1 className="text-3xl font-bold">Certificate Preview</h1>
          <p className="text-muted-foreground mt-2">Preview all certificate tier designs before sending to students</p>
        </div>

        {/* Tier Selector */}
        <div className="flex flex-wrap justify-center gap-3 mb-8">
          {SAMPLE_CERTIFICATES.map((cert) => (
            <Button
              key={cert.tier}
              variant={selectedTier === cert.tier ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedTier(cert.tier)}
              className="capitalize"
            >
              {cert.title} — {cert.count} Referrals
            </Button>
          ))}
        </div>

        {/* Certificate Preview */}
        <div className="max-w-2xl mx-auto">
          <CertificatePreview
            tier={selected.tier}
            title={selected.title}
            name={selected.name}
            university={selected.university}
            referralCount={selected.count}
          />
        </div>

        {/* Milestone reward info */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
          {SAMPLE_CERTIFICATES.map((cert) => (
            <div key={cert.tier} className="rounded-xl border p-4 bg-white/60">
              <p className="font-semibold capitalize">{cert.title}</p>
              <p className="text-2xl font-bold mt-1">{cert.count} Referrals</p>
              <p className="text-sm text-muted-foreground mt-1">{cert.reward}</p>
            </div>
          ))}
        </div>

        <div className="mt-6 text-center space-y-1">
          <p className="text-sm text-muted-foreground">
            Each certificate has a unique ID (e.g., QG-SILVER-AB12XY78) for public verification.
          </p>
          <p className="text-sm text-muted-foreground">
            Verify at: <code className="bg-muted px-2 py-0.5 rounded">/ambassador/certificate/[ID]</code>
          </p>
        </div>

        {/* All Tiers Grid */}
        <div className="mt-12">
          <h2 className="text-xl font-bold text-center mb-6">All 3 Certificate Tiers Side-by-Side</h2>
          <div className="grid gap-6 md:grid-cols-3">
            {SAMPLE_CERTIFICATES.map((cert) => (
              <div key={cert.tier} className="transform scale-90 origin-top">
                <CertificatePreview
                  tier={cert.tier}
                  title={cert.title}
                  name={cert.name}
                  university={cert.university}
                  referralCount={cert.count}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

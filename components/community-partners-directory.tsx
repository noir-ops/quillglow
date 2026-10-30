"use client"

import { useState, useEffect } from "react"
import { Search, ExternalLink, Building2, Users, Star } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

interface Partner {
  id: string
  name: string
  type: "community" | "creator" | "platform"
  description: string
  tags: string[]
  link_url: string
  link_label: string
  logo_url?: string
  featured: boolean
}

export function CommunityPartnersDirectory() {
  const [partners, setPartners] = useState<Partner[]>([])
  const [filteredPartners, setFilteredPartners] = useState<Partner[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [typeFilter, setTypeFilter] = useState<"all" | "community" | "creator" | "platform">("all")
  const [sortBy, setSortBy] = useState<"featured" | "a-z">("featured")

  useEffect(() => {
    fetchPartners()
  }, [])

  useEffect(() => {
    filterAndSortPartners()
  }, [search, typeFilter, sortBy, partners])

  async function fetchPartners() {
    try {
      const response = await fetch("/api/partners")
      const data = await response.json()
      setPartners(data.partners || [])
    } catch (error) {
      console.error("[v0] Error fetching partners:", error)
    } finally {
      setLoading(false)
    }
  }

  function filterAndSortPartners() {
    let filtered = [...partners]

    // Apply filters
    if (typeFilter !== "all") {
      filtered = filtered.filter((p) => p.type === typeFilter)
    }

    if (search) {
      const searchLower = search.toLowerCase()
      filtered = filtered.filter(
        (p) =>
          p.name.toLowerCase().includes(searchLower) ||
          p.description.toLowerCase().includes(searchLower) ||
          p.tags.some((tag) => tag.toLowerCase().includes(searchLower)),
      )
    }

    // Apply sorting
    if (sortBy === "featured") {
      filtered.sort((a, b) => {
        if (a.featured === b.featured) {
          return a.name.localeCompare(b.name)
        }
        return a.featured ? -1 : 1
      })
    } else if (sortBy === "a-z") {
      filtered.sort((a, b) => a.name.localeCompare(b.name))
    }

    setFilteredPartners(filtered)
  }

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "community":
        return <Users className="h-5 w-5" />
      case "creator":
        return <Building2 className="h-5 w-5" />
      case "platform":
        return <Star className="h-5 w-5" />
      default:
        return null
    }
  }

  const getTypeLabel = (type: string) => {
    return type.charAt(0).toUpperCase() + type.slice(1)
  }

  const featuredPartners = filteredPartners.filter((p) => p.featured)

  return (
    <div className="bg-background rounded-[40px] overflow-hidden">
      {/* Intro */}
      <section className="py-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="text-center space-y-4">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground">Community &amp; Creator Partners</h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Communities and creators helping students discover QuillGlow.
          </p>
          <div className="flex gap-3 justify-center flex-wrap pt-4">
            <Button asChild variant="default">
              <a href="mailto:impact@quillglow.com">Apply to Partner</a>
            </Button>
            <Button asChild variant="outline">
              <a href="mailto:impact@quillglow.com">Contact Support</a>
            </Button>
          </div>
        </div>
      </section>

      {/* Filter & Search Section */}
      <section className="bg-background/80 backdrop-blur-md border-b border-border py-4 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search partners…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>

          <div className="flex flex-col sm:flex-row gap-4 items-stretch sm:items-center">
            {/* Type Filter */}
            <div className="flex flex-wrap gap-2">
              {["all", "community", "creator", "platform"].map((type) => (
                <button
                  key={type}
                  onClick={() => setTypeFilter(type as any)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    typeFilter === type
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary hover:bg-secondary/80 text-foreground"
                  }`}
                >
                  {type === "all" ? "All" : getTypeLabel(type)}
                </button>
              ))}
            </div>

            {/* Sort Dropdown */}
            <div className="ml-auto">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as "featured" | "a-z")}
                className="px-3 py-1.5 rounded-lg bg-secondary border border-border text-foreground text-sm font-medium"
              >
                <option value="featured">Featured first</option>
                <option value="a-z">A–Z</option>
              </select>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Partners */}
      {featuredPartners.length > 0 && (
        <section className="py-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
          <h3 className="text-2xl font-bold text-foreground mb-8">Featured Partners</h3>
          <div className="grid gap-6 md:grid-cols-2">
            {featuredPartners.map((partner) => (
              <div
                key={partner.id}
                className="group relative overflow-hidden rounded-2xl bg-card border border-border p-6 hover:shadow-lg hover:border-primary/50 transition-all duration-300"
              >
                <div className="absolute top-4 right-4 flex items-center gap-2">
                  <span className="bg-primary/20 text-primary px-2.5 py-1 rounded-full text-xs font-semibold flex items-center gap-1">
                    <Star className="h-3 w-3" />
                    Featured
                  </span>
                </div>

                <div className="flex items-start gap-4 mb-4">
                  {partner.logo_url ? (
                    <img
                      src={partner.logo_url || "/placeholder.svg"}
                      alt={partner.name}
                      className="h-16 w-16 rounded-xl object-cover bg-secondary"
                    />
                  ) : (
                    <div className="h-16 w-16 rounded-xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center text-white">
                      {getTypeIcon(partner.type)}
                    </div>
                  )}
                  <div className="flex-1">
                    <h4 className="text-lg font-semibold text-foreground">{partner.name}</h4>
                    <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                      {getTypeIcon(partner.type)}
                      {getTypeLabel(partner.type)}
                    </p>
                  </div>
                </div>

                <p className="text-foreground/80 text-sm mb-4 line-clamp-2">{partner.description}</p>

                {partner.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-4">
                    {partner.tags.map((tag) => (
                      <span key={tag} className="bg-secondary text-foreground/80 px-2 py-1 rounded text-xs font-medium">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}

                <Button asChild className="w-full group">
                  <a href={partner.link_url} target="_blank" rel="noopener noreferrer">
                    {partner.link_label}
                    <ExternalLink className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                  </a>
                </Button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* All Partners */}
      <section className="py-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <h3 className="text-2xl font-bold text-foreground mb-8">All Partners</h3>

        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-primary border-r-transparent"></div>
            <p className="text-muted-foreground mt-2">Loading partners…</p>
          </div>
        ) : filteredPartners.length === 0 ? (
          <div className="rounded-2xl border border-border bg-card p-12 text-center">
            <h4 className="text-lg font-semibold text-foreground mb-2">No partners found</h4>
            <p className="text-muted-foreground mb-6">Try a different keyword or filter.</p>
            <Button asChild variant="outline">
              <a href="mailto:impact@quillglow.com">Become a Partner</a>
            </Button>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {filteredPartners.map((partner) => (
              <div
                key={partner.id}
                className="group relative overflow-hidden rounded-2xl bg-card border border-border p-6 hover:shadow-lg hover:border-primary/50 transition-all duration-300"
              >
                {partner.featured && (
                  <div className="absolute top-4 right-4 flex items-center gap-2 z-10">
                    <span className="bg-primary/20 text-primary px-2.5 py-1 rounded-full text-xs font-semibold flex items-center gap-1">
                      <Star className="h-3 w-3" />
                      Featured
                    </span>
                  </div>
                )}
                <div className="flex items-start gap-4 mb-4">
                  {partner.logo_url ? (
                    <img
                      src={partner.logo_url || "/placeholder.svg"}
                      alt={partner.name}
                      className={partner.featured ? "h-16 w-16 rounded-xl object-cover bg-secondary" : "h-12 w-12 rounded-lg object-cover bg-secondary"}
                    />
                  ) : (
                    <div className={partner.featured
                        ? "h-16 w-16 rounded-xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center text-white"
                        : "h-12 w-12 rounded-lg bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center text-white flex-shrink-0"}
                    >
                      {getTypeIcon(partner.type)}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <h4 className={partner.featured ? "text-lg font-semibold text-foreground" : "text-base font-semibold text-foreground truncate"}>
                      {partner.name}
                    </h4>
                    <p className={partner.featured ? "text-sm text-muted-foreground flex items-center gap-1 mt-1" : "text-xs text-muted-foreground flex items-center gap-1 mt-1"}>
                      {getTypeIcon(partner.type)}
                      {getTypeLabel(partner.type)}
                    </p>
                  </div>
                </div>

                <p className={partner.featured ? "text-foreground/80 text-sm mb-4 line-clamp-2" : "text-foreground/80 text-sm mb-3 line-clamp-2"}>
                  {partner.description}
                </p>

                {partner.tags.length > 0 && (
                  <div className={`flex flex-wrap gap-2 mb-4`}>
                    {(partner.featured ? partner.tags : partner.tags.slice(0, 2)).map((tag) => (
                      <span
                        key={tag}
                        className="bg-secondary text-foreground/80 px-2 py-0.5 rounded text-xs font-medium"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}

                <Button
                  asChild
                  size={partner.featured ? undefined : "sm"}
                  className="w-full group"
                  variant="default"
                >
                  <a href={partner.link_url} target="_blank" rel="noopener noreferrer">
                    {partner.link_label}
                    <ExternalLink className={partner.featured ? "ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" : "ml-2 h-3 w-3 group-hover:translate-x-0.5 transition-transform"} />
                  </a>
                </Button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Trust Block */}
      <section className="py-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="rounded-2xl border border-border bg-card p-8 text-center">
          <p className="text-foreground/80 text-sm leading-relaxed max-w-2xl mx-auto mb-4">
            We only list partners that support students and respect community guidelines.
          </p>
          <p className="text-muted-foreground text-sm">
            Want to partner?{" "}
            <a href="mailto:impact@quillglow.com" className="text-primary hover:underline font-medium">
              Email impact@quillglow.com
            </a>
          </p>
        </div>
      </section>
    </div>
  )
}
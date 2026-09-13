"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Search,
  Sparkles,
  BookmarkPlus,
  ExternalLink,
  Youtube,
  FileText,
  Loader2,
  BookOpen,
  Video,
  Calculator,
  Share2,
  Play,
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { VideoPlayerModal } from "@/components/video-player-modal"
import { InappropriateSearchNotice } from "@/components/inappropriate-search-notice"

export default function SearchPage() {
  const [query, setQuery] = useState("")
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<any>(null)
  const [bookmarkedUrls, setBookmarkedUrls] = useState<Set<string>>(new Set())
  const [recentSearches, setRecentSearches] = useState<any[]>([])
  const [selectedVideo, setSelectedVideo] = useState<{ id: string; title: string } | null>(null)
  const [showInappropriateNotice, setShowInappropriateNotice] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    fetchRecentSearches()
  }, [])

  const fetchRecentSearches = async () => {
    try {
      const response = await fetch("/api/search/history")
      if (response.ok) {
        const data = await response.json()
        setRecentSearches(data.history?.slice(0, 5) || [])
      }
    } catch (error) {
      // Silent fail for recent searches
    }
  }

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!query.trim()) return

    setLoading(true)
    try {
      const response = await fetch("/api/search/web", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, searchType: "all" }),
      })

      if (response.status === 403) {
        const data = await response.json()
        if (data.error === "inappropriate_content") {
          setShowInappropriateNotice(true)
          setLoading(false)
          return
        }
      }

      if (!response.ok) throw new Error("Search failed")

      const data = await response.json()
      setResults(data)
      fetchRecentSearches()
    } catch (error) {
      toast({
        title: "Search failed",
        description: "Please try again",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleBookmark = async (item: any, type: "video" | "article") => {
    try {
      const response = await fetch("/api/search/bookmarks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: item.title,
          url: item.url,
          description: item.description,
          thumbnail: item.thumbnail,
          source_type: type,
        }),
      })

      if (response.ok) {
        setBookmarkedUrls((prev) => new Set(prev).add(item.url))
        toast({
          title: "Bookmarked!",
          description: "Added to your collection",
        })
      } else if (response.status === 409) {
        toast({
          title: "Already bookmarked",
          description: "This item is already in your collection",
        })
      }
    } catch (error) {
      toast({
        title: "Failed to bookmark",
        description: "Please try again",
        variant: "destructive",
      })
    }
  }

  const handleQuickAction = (searchQuery: string) => {
    setQuery(searchQuery)
    // Auto-submit the search
    const form = document.querySelector("form")
    if (form) {
      form.dispatchEvent(new Event("submit", { cancelable: true, bubbles: true }))
    }
  }

  const handleNewSearch = () => {
    setResults(null)
    setQuery("")
  }

  const extractVideoId = (url: string) => {
    const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&]+)/)
    return match ? match[1] : ""
  }

  const handlePlayVideo = (video: any) => {
    const videoId = extractVideoId(video.url)
    if (videoId) {
      setSelectedVideo({ id: videoId, title: video.title })
    }
  }

  if (!results && !loading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 max-w-5xl">
          {/* Hero Section */}
          <div className="text-center mb-8 sm:mb-12 mt-4 sm:mt-8">
            <div className="inline-flex p-3 sm:p-4 bg-emerald-100 rounded-2xl mb-4 sm:mb-6">
              <Search className="h-8 w-8 sm:h-12 sm:w-12 text-emerald-600" />
            </div>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-foreground mb-3 sm:mb-4 px-4">
              Search Smarter, Learn Faster
            </h1>
            <p className="text-base sm:text-lg text-muted-foreground px-4">
              AI-powered search with instant summaries and educational content
            </p>
          </div>

          {/* Search Bar */}
          <form onSubmit={handleSearch} className="mb-8 sm:mb-12">
            <div className="flex flex-col sm:flex-row gap-3 max-w-3xl mx-auto">
              <div className="relative flex-1">
                <Search className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Ask anything... (e.g., 'Explain photosynthesis')"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="h-12 sm:h-14 pl-10 sm:pl-12 text-sm sm:text-base rounded-xl border-2"
                />
              </div>
              <Button type="submit" size="lg" className="h-12 sm:h-14 px-6 sm:px-8 rounded-xl font-semibold">
                Search
              </Button>
            </div>
          </form>

          {/* Quick Actions */}
          <div className="mb-8 sm:mb-12">
            <h2 className="text-base sm:text-lg font-semibold text-muted-foreground mb-3 sm:mb-4 px-2">
              Quick Actions
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <Card
                className="cursor-pointer hover:shadow-lg transition-shadow border-2"
                onClick={() => handleQuickAction("Explain quantum physics")}
              >
                <CardContent className="p-4 sm:p-6">
                  <div className="flex items-start gap-3 sm:gap-4">
                    <div className="p-2 sm:p-3 bg-blue-100 rounded-lg flex-shrink-0">
                      <BookOpen className="h-5 w-5 sm:h-6 sm:w-6 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-base sm:text-lg mb-1">Study Guide</h3>
                      <p className="text-xs sm:text-sm text-muted-foreground">Get AI summaries</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card
                className="cursor-pointer hover:shadow-lg transition-shadow border-2"
                onClick={() => handleQuickAction("How to solve calculus problems")}
              >
                <CardContent className="p-4 sm:p-6">
                  <div className="flex items-start gap-3 sm:gap-4">
                    <div className="p-2 sm:p-3 bg-purple-100 rounded-lg flex-shrink-0">
                      <Video className="h-5 w-5 sm:h-6 sm:w-6 text-purple-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-base sm:text-lg mb-1">Video Lessons</h3>
                      <p className="text-xs sm:text-sm text-muted-foreground">Find tutorials</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card
                className="cursor-pointer hover:shadow-lg transition-shadow border-2"
                onClick={() => handleQuickAction("World War 2 history")}
              >
                <CardContent className="p-4 sm:p-6">
                  <div className="flex items-start gap-3 sm:gap-4">
                    <div className="p-2 sm:p-3 bg-orange-100 rounded-lg flex-shrink-0">
                      <FileText className="h-5 w-5 sm:h-6 sm:w-6 text-orange-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-base sm:text-lg mb-1">History Topics</h3>
                      <p className="text-xs sm:text-sm text-muted-foreground">Learn history</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card
                className="cursor-pointer hover:shadow-lg transition-shadow border-2"
                onClick={() => handleQuickAction("Solve algebra equations")}
              >
                <CardContent className="p-4 sm:p-6">
                  <div className="flex items-start gap-3 sm:gap-4">
                    <div className="p-2 sm:p-3 bg-green-100 rounded-lg flex-shrink-0">
                      <Calculator className="h-5 w-5 sm:h-6 sm:w-6 text-green-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-base sm:text-lg mb-1">Math Help</h3>
                      <p className="text-xs sm:text-sm text-muted-foreground">Get solutions</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Recent Searches */}
          <div>
            <h2 className="text-base sm:text-lg font-semibold text-muted-foreground mb-3 sm:mb-4 px-2">
              Recent Searches
            </h2>
            {recentSearches.length === 0 ? (
              <Card className="border-2">
                <CardContent className="p-6 sm:p-8 text-center">
                  <p className="text-sm sm:text-base text-muted-foreground">No recent searches yet. Start exploring!</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {recentSearches.map((item) => (
                  <Card
                    key={item.id}
                    className="cursor-pointer hover:shadow-md transition-shadow border-2"
                    onClick={() => {
                      setQuery(item.query)
                      handleQuickAction(item.query)
                    }}
                  >
                    <CardContent className="p-3 sm:p-4">
                      <div className="flex items-center gap-3">
                        <Search className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        <span className="text-sm font-medium truncate">{item.query}</span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 max-w-5xl">
        {/* Search Bar */}
        <form onSubmit={handleSearch} className="mb-6 sm:mb-8">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Ask anything..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="h-11 sm:h-12 pl-10 sm:pl-12 text-sm sm:text-base rounded-xl border-2"
              />
            </div>
            <Button
              type="submit"
              disabled={loading}
              size="lg"
              className="h-11 sm:h-12 px-6 sm:px-8 rounded-xl font-semibold"
            >
              {loading ? <Loader2 className="h-4 w-4 sm:h-5 sm:w-5 animate-spin" /> : "Search"}
            </Button>
          </div>
        </form>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          results && (
            <div className="space-y-6 sm:space-y-8">
              {/* AI Summary */}
              {results.aiSummary && (
                <Card className="border-2 bg-blue-50 dark:bg-blue-950/30">
                  <CardContent className="p-4 sm:p-6">
                    <div className="flex items-start gap-3 mb-4">
                      <Sparkles className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-1 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-2 gap-2">
                          <h2 className="text-base sm:text-lg font-semibold">AI Summary</h2>
                          <Badge variant="secondary" className="text-xs flex-shrink-0">
                            Powered by AI
                          </Badge>
                        </div>
                        <p className="text-sm leading-relaxed text-foreground">{results.aiSummary}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Video Lessons */}
              {results.videos && results.videos.length > 0 && (
                <div>
                  <h2 className="text-lg sm:text-xl font-bold mb-3 sm:mb-4 px-1">Video Lessons</h2>
                  <div className="space-y-3 sm:space-y-4">
                    {results.videos.map((video: any, index: number) => (
                      <Card key={index} className="border-2 hover:shadow-md transition-shadow">
                        <CardContent className="p-3 sm:p-4">
                          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                            <div
                              className="relative w-full sm:w-40 h-32 sm:h-24 flex-shrink-0 rounded-lg overflow-hidden bg-gray-200 cursor-pointer"
                              onClick={() => handlePlayVideo(video)}
                            >
                              {video.thumbnail ? (
                                <img
                                  src={video.thumbnail || "/placeholder.svg"}
                                  alt={video.title}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                  <Youtube className="h-8 w-8 text-gray-400" />
                                </div>
                              )}
                              <div className="absolute inset-0 flex items-center justify-center bg-black/30 hover:bg-black/40 transition-colors">
                                <div className="w-12 h-12 sm:w-10 sm:h-10 rounded-full bg-red-600 flex items-center justify-center">
                                  <Play className="h-6 w-6 sm:h-5 sm:w-5 text-white ml-1" fill="white" />
                                </div>
                              </div>
                              <Badge className="absolute top-2 right-2 text-xs bg-blue-600">N/A</Badge>
                            </div>
                            <div className="flex-1 min-w-0">
                              <h3 className="font-semibold text-sm sm:text-base mb-1 line-clamp-2">{video.title}</h3>
                              <p className="text-xs sm:text-sm text-muted-foreground mb-3">{video.channel}</p>
                              <div className="flex items-center gap-2 flex-wrap">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleBookmark(video, "video")}
                                  className="h-8 px-3 text-xs sm:text-sm"
                                >
                                  <BookmarkPlus className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                                  Save
                                </Button>
                                <Button size="sm" variant="ghost" asChild className="h-8 px-3 text-xs sm:text-sm">
                                  <a href={video.url} target="_blank" rel="noopener noreferrer">
                                    <ExternalLink className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                                    YouTube
                                  </a>
                                </Button>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}

              {/* Web Resources */}
              {results.articles && results.articles.length > 0 && (
                <div>
                  <h2 className="text-lg sm:text-xl font-bold mb-3 sm:mb-4 px-1">Web Resources</h2>
                  <div className="space-y-3 sm:space-y-4">
                    {results.articles.map((article: any, index: number) => (
                      <Card key={index} className="border-2 hover:shadow-md transition-shadow">
                        <CardContent className="p-4 sm:p-6">
                          <div className="flex items-start justify-between mb-2 gap-3">
                            <h3 className="font-semibold text-sm sm:text-base flex-1 pr-2">{article.title}</h3>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleBookmark(article, "article")}
                              className="h-8 w-8 p-0 flex-shrink-0"
                            >
                              <BookmarkPlus className="h-4 w-4" />
                            </Button>
                          </div>
                          <p className="text-xs sm:text-sm text-muted-foreground mb-4 line-clamp-2">
                            {article.description}
                          </p>
                          <div className="flex items-center gap-2 flex-wrap">
                            <Button
                              size="sm"
                              variant="outline"
                              asChild
                              className="h-8 px-3 sm:px-4 bg-transparent text-xs sm:text-sm"
                            >
                              <a href={article.url} target="_blank" rel="noopener noreferrer">
                                <ExternalLink className="h-3 w-3 mr-1" />
                                Visit
                              </a>
                            </Button>
                            <Button size="sm" variant="ghost" className="h-8 px-3 sm:px-4 text-xs sm:text-sm">
                              <Share2 className="h-3 w-3 mr-1" />
                              Share
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}

              {/* New Search Button */}
              <div className="flex justify-center pt-6 sm:pt-8">
                <Button
                  variant="outline"
                  size="lg"
                  onClick={handleNewSearch}
                  className="rounded-xl font-semibold border-2 bg-transparent w-full sm:w-auto"
                >
                  <Search className="h-4 w-4 mr-2" />
                  New Search
                </Button>
              </div>
            </div>
          )
        )}
      </div>

      {/* Inappropriate Search Notice Modal */}
      <InappropriateSearchNotice
        isOpen={showInappropriateNotice}
        onClose={() => {
          setShowInappropriateNotice(false)
          setQuery("")
        }}
      />

      {selectedVideo && (
        <VideoPlayerModal
          isOpen={!!selectedVideo}
          onClose={() => setSelectedVideo(null)}
          videoId={selectedVideo.id}
          title={selectedVideo.title}
        />
      )}
    </div>
  )
}

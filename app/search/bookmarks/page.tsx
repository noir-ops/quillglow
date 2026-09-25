"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Bookmark, ExternalLink, Trash2, Youtube, FileText, Loader2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

export default function BookmarksPage() {
  const [bookmarks, setBookmarks] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()

  useEffect(() => {
    fetchBookmarks()
  }, [])

  const fetchBookmarks = async () => {
    try {
      const response = await fetch("/api/search/bookmarks")
      if (!response.ok) throw new Error("Failed to fetch")
      const data = await response.json()
      setBookmarks(data.bookmarks || [])
    } catch (error) {
      toast({
        title: "Failed to load bookmarks",
        description: "Please try again",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      const response = await fetch(`/api/search/bookmarks?id=${id}`, {
        method: "DELETE",
      })

      if (!response.ok) throw new Error("Failed to delete")

      setBookmarks((prev) => prev.filter((b) => b.id !== id))
      toast({
        title: "Bookmark removed",
        description: "Successfully deleted",
      })
    } catch (error) {
      toast({
        title: "Failed to delete",
        description: "Please try again",
        variant: "destructive",
      })
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b-4 border-primary bg-card">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-primary/10 rounded-lg border-2 border-primary">
              <Bookmark className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-black text-foreground uppercase tracking-tight">Bookmarks</h1>
              <p className="text-sm text-muted-foreground font-medium">Your saved resources</p>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        {bookmarks.length === 0 ? (
          <div className="text-center py-16">
            <div className="inline-flex p-6 bg-primary/10 rounded-full border-4 border-primary mb-4">
              <Bookmark className="h-12 w-12 text-primary" />
            </div>
            <h2 className="text-2xl font-black text-foreground mb-2 uppercase">No Bookmarks Yet</h2>
            <p className="text-muted-foreground">Start searching and save resources for later</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {bookmarks.map((bookmark) => (
              <Card
                key={bookmark.id}
                className="border-2 border-border hover:border-primary transition-colors overflow-hidden"
              >
                {bookmark.thumbnail && (
                  <div className="relative aspect-video">
                    <img
                      src={bookmark.thumbnail || "/placeholder.svg"}
                      alt={bookmark.title}
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
                <CardContent className="p-4">
                  <div className="flex items-start gap-2 mb-2">
                    {bookmark.source_type === "video" ? (
                      <Youtube className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                    ) : (
                      <FileText className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                    )}
                    <h3 className="font-bold text-foreground line-clamp-2 flex-1">{bookmark.title}</h3>
                  </div>
                  {bookmark.description && (
                    <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{bookmark.description}</p>
                  )}
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      {bookmark.source_type}
                    </Badge>
                    <div className="flex-1" />
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDelete(bookmark.id)}
                      className="h-8 px-2 text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="ghost" asChild className="h-8 px-2">
                      <a href={bookmark.url} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

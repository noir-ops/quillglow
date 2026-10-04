"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { History, Trash2, Search, Loader2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { useRouter } from "next/navigation"

export default function HistoryPage() {
  const [history, setHistory] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()
  const router = useRouter()

  useEffect(() => {
    fetchHistory()
  }, [])

  const fetchHistory = async () => {
    try {
      const response = await fetch("/api/search/history")
      if (!response.ok) throw new Error("Failed to fetch")
      const data = await response.json()
      setHistory(data.history || [])
    } catch (error) {
      toast({
        title: "Failed to load history",
        description: "Please try again",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleClearAll = async () => {
    if (!confirm("Clear all search history?")) return

    try {
      const response = await fetch("/api/search/history", {
        method: "DELETE",
      })

      if (!response.ok) throw new Error("Failed to clear")

      setHistory([])
      toast({
        title: "History cleared",
        description: "All search history has been deleted",
      })
    } catch (error) {
      toast({
        title: "Failed to clear history",
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
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-primary/10 rounded-lg border-2 border-primary">
                <History className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h1 className="text-3xl font-black text-foreground uppercase tracking-tight">Search History</h1>
                <p className="text-sm text-muted-foreground font-medium">Your recent searches</p>
              </div>
            </div>
            {history.length > 0 && (
              <Button variant="destructive" onClick={handleClearAll} className="font-bold border-2">
                <Trash2 className="h-4 w-4 mr-2" />
                Clear All
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        {history.length === 0 ? (
          <div className="text-center py-16">
            <div className="inline-flex p-6 bg-primary/10 rounded-full border-4 border-primary mb-4">
              <History className="h-12 w-12 text-primary" />
            </div>
            <h2 className="text-2xl font-black text-foreground mb-2 uppercase">No Search History</h2>
            <p className="text-muted-foreground">Your searches will appear here</p>
          </div>
        ) : (
          <div className="space-y-3">
            {history.map((item) => (
              <Card
                key={item.id}
                className="border-2 border-border hover:border-primary transition-colors cursor-pointer"
                onClick={() => router.push(`/search?q=${item.query}`)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <Search className="h-5 w-5 text-primary flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-foreground">{item.query}</p>
                      <p className="text-sm text-muted-foreground">
                        {new Date(item.created_at).toLocaleDateString()} at{" "}
                        {new Date(item.created_at).toLocaleTimeString()}
                      </p>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {item.search_type}
                    </Badge>
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

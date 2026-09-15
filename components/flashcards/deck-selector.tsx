"use client"

import type React from "react"

import { useState } from "react"
import { motion } from "framer-motion"
import { Plus, BookOpen, Trash2 } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createBrowserClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import Link from "next/link"

interface DeckSelectorProps {
  decks: any[]
  selectedDeckId?: string
}

export function DeckSelector({ decks: initialDecks, selectedDeckId }: DeckSelectorProps) {
  const [decks, setDecks] = useState(initialDecks)
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createBrowserClient()

  const handleCreateDeck = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)

    const formData = new FormData(e.currentTarget)
    const name = formData.get("name") as string
    const subject = formData.get("subject") as string

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return

    const { data, error } = await supabase
      .from("flashcard_decks")
      .insert({
        user_id: user.id,
        name,
        subject,
      })
      .select()
      .single()

    if (error) {
      toast.error("Failed to create deck")
    } else {
      toast.success("Deck created!")
      setDecks([data, ...decks])
      setOpen(false)
      router.refresh()
    }

    setLoading(false)
  }

  const handleDeleteDeck = async (deckId: string) => {
    const { error } = await supabase.from("flashcard_decks").delete().eq("id", deckId)

    if (error) {
      toast.error("Failed to delete deck")
    } else {
      toast.success("Deck deleted")
      setDecks(decks.filter((d) => d.id !== deckId))
      router.push("/flashcards")
      router.refresh()
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            Decks
          </span>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="icon" variant="ghost">
                <Plus className="h-4 w-4" />
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Deck</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreateDeck} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Deck Name *</Label>
                  <Input id="name" name="name" placeholder="e.g., Biology Chapter 3" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="subject">Subject</Label>
                  <Input id="subject" name="subject" placeholder="e.g., Biology" />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Creating..." : "Create Deck"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {decks.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">No decks yet. Create one to start!</p>
        ) : (
          <div className="space-y-2">
            {decks.map((deck, index) => (
              <motion.div
                key={deck.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <Link href={`/flashcards?deck=${deck.id}`}>
                  <div
                    className={`p-3 rounded-lg border transition-colors group ${
                      selectedDeckId === deck.id
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-card hover:bg-accent"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{deck.name}</p>
                        {deck.subject && <p className="text-xs opacity-80 mt-1">{deck.subject}</p>}
                        <p className="text-xs opacity-60 mt-1">{deck.flashcards?.[0]?.count || 0} cards</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => {
                          e.preventDefault()
                          handleDeleteDeck(deck.id)
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

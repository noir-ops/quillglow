"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { Layers, Plus, Sparkles, FileText, Upload, Image as ImageIcon } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createBrowserClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

interface FlashcardEmptyStateProps {
  hasDecks: boolean
}

export function FlashcardEmptyState({ hasDecks }: FlashcardEmptyStateProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createBrowserClient()

  const handleCreateSet = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)

    const formData = new FormData(e.currentTarget)
    const name = formData.get("name") as string
    const subject = formData.get("subject") as string

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      setLoading(false)
      return
    }

    const { data, error } = await supabase
      .from("flashcard_decks")
      .insert({
        user_id: user.id,
        name,
        subject: subject || null,
      })
      .select()
      .single()

    if (error) {
      toast.error("Failed to create set")
    } else {
      toast.success("Set created!")
      setOpen(false)
      router.push(`/flashcards?deck=${data.id}`)
      router.refresh()
    }

    setLoading(false)
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <Card className="border-dashed">
        <CardContent className="py-16">
          <div className="text-center max-w-md mx-auto">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-6">
              <Layers className="h-8 w-8 text-primary" />
            </div>

            <h3 className="text-xl font-semibold mb-2">
              {hasDecks ? "Select a Set" : "Create Your First Flashcard Set"}
            </h3>

            <p className="text-muted-foreground mb-6">
              {hasDecks
                ? "Choose a flashcard set from the sidebar to start studying, or create a new one."
                : "Organize your flashcards into sets for easy navigation. Each set can contain cards for a specific topic or chapter."}
            </p>

            {!hasDecks && (
              <div className="grid grid-cols-3 gap-4 mb-6 text-sm">
                <div className="p-4 rounded-xl bg-muted/50">
                  <FileText className="h-5 w-5 mx-auto mb-2 text-blue-500" />
                  <p className="font-medium">From Text</p>
                  <p className="text-xs text-muted-foreground">Paste notes</p>
                </div>
                <div className="p-4 rounded-xl bg-muted/50">
                  <Upload className="h-5 w-5 mx-auto mb-2 text-green-500" />
                  <p className="font-medium">From PDF</p>
                  <p className="text-xs text-muted-foreground">Upload docs</p>
                </div>
                <div className="p-4 rounded-xl bg-muted/50">
                  <ImageIcon className="h-5 w-5 mx-auto mb-2 text-purple-500" />
                  <p className="font-medium">From Image</p>
                  <p className="text-xs text-muted-foreground">Scan photos</p>
                </div>
              </div>
            )}

            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button size="lg" className="gap-2">
                  <Plus className="h-4 w-4" />
                  Create New Set
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create Flashcard Set</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleCreateSet} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Set Name *</Label>
                    <Input
                      id="name"
                      name="name"
                      placeholder="e.g., Biology Chapter 3"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="subject">Subject (optional)</Label>
                    <Input id="subject" name="subject" placeholder="e.g., Biology" />
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? "Creating..." : "Create Set"}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>

            {!hasDecks && (
              <p className="text-xs text-muted-foreground mt-4">
                <Sparkles className="h-3 w-3 inline mr-1" />
                AI will automatically generate flashcards from your content
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}

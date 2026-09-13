"use client"

import type React from "react"

import { useState } from "react"
import { motion } from "framer-motion"
import { Plus, Search, Folder, Trash2, Menu, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { createBrowserClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import Link from "next/link"
import type { Note } from "@/lib/types/study"

interface NotesSidebarProps {
  notes: Note[]
  selectedNoteId?: string
}

export function NotesSidebar({ notes: initialNotes, selectedNoteId }: NotesSidebarProps) {
  const [notes, setNotes] = useState(initialNotes)
  const [searchQuery, setSearchQuery] = useState("")
  const [open, setOpen] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createBrowserClient()

  const filteredNotes = notes.filter(
    (note) =>
      note.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      note.content?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      note.subject?.toLowerCase().includes(searchQuery.toLowerCase()),
  )

  const groupedNotes = filteredNotes.reduce(
    (acc, note) => {
      const subject = note.subject || "Uncategorized"
      if (!acc[subject]) acc[subject] = []
      acc[subject].push(note)
      return acc
    },
    {} as Record<string, Note[]>,
  )

  const handleCreateNote = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)

    const formData = new FormData(e.currentTarget)
    const title = formData.get("title") as string
    const subject = formData.get("subject") as string

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return

    const { data, error } = await supabase
      .from("notes")
      .insert({
        user_id: user.id,
        title,
        subject,
        content: "",
      })
      .select()
      .single()

    if (error) {
      toast.error("Failed to create note")
    } else {
      toast.success("Note created!")
      setNotes([data, ...notes])
      setOpen(false)
      setMobileOpen(false)
      router.push(`/notes?note=${data.id}`)
      router.refresh()
    }

    setLoading(false)
  }

  const handleDeleteNote = async (noteId: string) => {
    const { error } = await supabase.from("notes").delete().eq("id", noteId)

    if (error) {
      toast.error("Failed to delete note")
    } else {
      toast.success("Note deleted")
      setNotes(notes.filter((n) => n.id !== noteId))
      if (selectedNoteId === noteId) {
        router.push("/notes")
      }
      router.refresh()
    }
  }

  const handleNoteClick = () => {
    setMobileOpen(false)
  }

  const SidebarContent = () => (
    <div className="flex flex-col h-full bg-card border-r border-border">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Notes</h2>
          <div className="flex gap-2">
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button size="icon" variant="ghost">
                  <Plus className="h-4 w-4" />
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create New Note</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleCreateNote} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="title">Note Title *</Label>
                    <Input id="title" name="title" placeholder="e.g., Biology Lecture 5" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="subject">Subject/Folder</Label>
                    <Input id="subject" name="subject" placeholder="e.g., Biology" />
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? "Creating..." : "Create Note"}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
            <Button size="icon" variant="ghost" className="md:hidden" onClick={() => setMobileOpen(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search notes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Notes List */}
      <div className="flex-1 overflow-y-auto p-4">
        {Object.keys(groupedNotes).length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">No notes found</p>
        ) : (
          <div className="space-y-4">
            {Object.entries(groupedNotes).map(([subject, subjectNotes]) => (
              <div key={subject}>
                <div className="flex items-center gap-2 mb-2 text-sm font-medium text-muted-foreground">
                  <Folder className="h-4 w-4" />
                  {subject}
                </div>
                <div className="space-y-1 ml-6">
                  {subjectNotes.map((note, index) => (
                    <motion.div
                      key={note.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                    >
                      <Link href={`/notes?note=${note.id}`} onClick={handleNoteClick}>
                        <div
                          className={`group p-3 rounded-lg transition-colors ${
                            selectedNoteId === note.id ? "bg-primary text-primary-foreground" : "hover:bg-accent"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <p className="font-medium truncate">{note.title}</p>
                              <p className="text-xs opacity-60 mt-1">
                                {new Date(note.updated_at).toLocaleDateString()}
                              </p>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="opacity-0 group-hover:opacity-100 transition-opacity h-6 w-6"
                              onClick={(e) => {
                                e.preventDefault()
                                handleDeleteNote(note.id)
                              }}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      </Link>
                    </motion.div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )

  return (
    <>
      {/* Mobile Toggle */}
      <Button
        variant="outline"
        size="icon"
        className="md:hidden fixed top-20 left-4 z-50 bg-transparent"
        onClick={() => setMobileOpen(true)}
      >
        <Menu className="h-4 w-4" />
      </Button>

      {/* Desktop Sidebar */}
      <div className="hidden md:block w-80">
        <SidebarContent />
      </div>

      {/* Mobile Sidebar */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50 bg-background">
          <SidebarContent />
        </div>
      )}
    </>
  )
}

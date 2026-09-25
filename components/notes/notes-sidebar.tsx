"use client"

import type React from "react"

import { useState } from "react"
import { motion } from "framer-motion"
import { Plus, Search, Folder, Trash2, Menu, X, ChevronLeft, ChevronRight } from "lucide-react"
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
  // Collapsing this frees up width for the note content next to it — the
  // list was previously a fixed w-80 with no way to close it.
  const [collapsed, setCollapsed] = useState(false)
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
    if (!confirm("Delete this note? This can't be undone.")) return
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
                              aria-label="Delete note"
                              className="h-6 w-6 text-muted-foreground opacity-70 hover:opacity-100 hover:text-destructive transition-opacity shrink-0"
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

      {/* Desktop Sidebar — collapsible. Collapsing it hands its width to the
          note content next to it, which was the whole point: the list and
          the note were fighting over the same narrow space with no way to
          give the note more room. */}
      <div className="hidden md:block relative shrink-0">
        <div className={`overflow-hidden transition-all duration-200 ${collapsed ? "w-0" : "w-80"}`}>
          <div className="w-80">
            <SidebarContent />
          </div>
        </div>
        <button
          onClick={() => setCollapsed((c) => !c)}
          aria-label={collapsed ? "Show notes list" : "Hide notes list"}
          title={collapsed ? "Show notes list" : "Hide notes list"}
          className={`flex absolute top-1/2 -translate-y-1/2 h-12 w-5 items-center justify-center rounded-r-md border border-l-0 bg-card text-muted-foreground hover:text-foreground hover:bg-accent transition-colors z-10 ${
            collapsed ? "left-0" : "left-80"
          }`}
        >
          {collapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />}
        </button>
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

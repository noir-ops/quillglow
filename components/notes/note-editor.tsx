"use client"

import { useState, useEffect, useRef } from "react"
import { motion } from "framer-motion"
import { Save, Download, FileText, Paperclip, X, Link as LinkIcon, ExternalLink, Image as ImageIcon, FileIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { createBrowserClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import type { Note } from "@/lib/types/study"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command"

interface NoteEditorProps {
  note: Note
}

export function NoteEditor({ note: initialNote }: NoteEditorProps) {
  const [note, setNote] = useState(initialNote)
  const [isSaving, setIsSaving] = useState(false)
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const supabase = createBrowserClient()
  const [attachments, setAttachments] = useState<Array<{ type: string; url: string; name: string }>>(
    initialNote.attachments || []
  )
  const [linkedNotes, setLinkedNotes] = useState<string[]>(initialNote.linked_note_ids || [])
  const [allNotes, setAllNotes] = useState<Note[]>([])
  const [showLinkDialog, setShowLinkDialog] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setNote(initialNote)
    setAttachments(initialNote.attachments || [])
    setLinkedNotes(initialNote.linked_note_ids || [])
    fetchAllNotes()
  }, [initialNote])

  const fetchAllNotes = async () => {
    const { data } = await supabase.from("notes").select("id, title, subject").order("updated_at", { ascending: false })
    if (data) {
      setAllNotes(data.filter((n) => n.id !== note.id))
    }
  }

  const handleChange = (field: keyof Note, value: string) => {
    setNote((prev) => ({ ...prev, [field]: value }))

    // Auto-save after 2 seconds of inactivity
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }

    saveTimeoutRef.current = setTimeout(() => {
      handleSave({ ...note, [field]: value })
    }, 2000)
  }

  const handleSave = async (noteToSave = note) => {
    setIsSaving(true)

    const { error } = await supabase
      .from("notes")
      .update({
        title: noteToSave.title,
        content: noteToSave.content,
        subject: noteToSave.subject,
        attachments: attachments,
        linked_note_ids: linkedNotes,
        updated_at: new Date().toISOString(),
      })
      .eq("id", noteToSave.id)

    if (error) {
      toast.error("Failed to save note")
    } else {
      toast.success("Note saved!")
    }

    setIsSaving(false)
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    const file = files[0]
    const maxSize = 10 * 1024 * 1024 // 10MB

    if (file.size > maxSize) {
      toast.error("File size must be less than 10MB")
      return
    }

    // For demo, we'll store as data URL (for production, use Vercel Blob or similar)
    const reader = new FileReader()
    reader.onload = (event) => {
      const result = event.target?.result as string
      const attachment = {
        type: file.type.startsWith("image/") ? "image" : "pdf",
        url: result,
        name: file.name,
      }
      setAttachments((prev) => [...prev, attachment])
      toast.success(`Added ${file.name}`)
    }
    reader.readAsDataURL(file)
  }

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index))
    toast.success("Attachment removed")
  }

  const toggleLinkedNote = (noteId: string) => {
    setLinkedNotes((prev) => (prev.includes(noteId) ? prev.filter((id) => id !== noteId) : [...prev, noteId]))
  }

  const removeLinkedNote = (noteId: string) => {
    setLinkedNotes((prev) => prev.filter((id) => id !== noteId))
  }

  const getLinkedNoteDetails = (noteId: string) => {
    return allNotes.find((n) => n.id === noteId)
  }

  const handleExport = () => {
    const blob = new Blob([note.content || ""], { type: "text/plain" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${note.title}.txt`
    a.click()
    URL.revokeObjectURL(url)
    toast.success("Note exported!")
  }

  const extractTags = (content: string) => {
    const words = content.toLowerCase().split(/\s+/)
    const commonWords = new Set(["the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for", "of", "with"])
    const wordFreq: Record<string, number> = {}

    words.forEach((word) => {
      const cleaned = word.replace(/[^a-z]/g, "")
      if (cleaned.length > 3 && !commonWords.has(cleaned)) {
        wordFreq[cleaned] = (wordFreq[cleaned] || 0) + 1
      }
    })

    return Object.entries(wordFreq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([word]) => word)
  }

  const autoTags = note.content ? extractTags(note.content) : []

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="h-full flex flex-col bg-background">
      {/* Header */}
      <div className="border-b border-border p-4">
        <div className="flex items-center justify-between gap-4 mb-4">
          <Input
            value={note.title}
            onChange={(e) => handleChange("title", e.target.value)}
            className="text-2xl font-bold border-none shadow-none focus-visible:ring-0 px-0"
            placeholder="Note title..."
          />
          <div className="flex gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,.pdf"
              onChange={handleFileUpload}
              className="hidden"
            />
            <Button variant="outline" size="icon" onClick={() => fileInputRef.current?.click()} title="Add attachment">
              <Paperclip className="h-4 w-4" />
            </Button>
            <Dialog open={showLinkDialog} onOpenChange={setShowLinkDialog}>
              <DialogTrigger asChild>
                <Button variant="outline" size="icon" title="Link to other notes">
                  <LinkIcon className="h-4 w-4" />
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Link to Other Notes</DialogTitle>
                </DialogHeader>
                <Command>
                  <CommandInput placeholder="Search notes..." />
                  <CommandEmpty>No notes found.</CommandEmpty>
                  <CommandGroup className="max-h-64 overflow-y-auto">
                    {allNotes.map((n) => (
                      <CommandItem
                        key={n.id}
                        onSelect={() => {
                          toggleLinkedNote(n.id)
                          setShowLinkDialog(false)
                        }}
                      >
                        <div className="flex items-center justify-between w-full">
                          <div>
                            <p className="font-medium">{n.title}</p>
                            {n.subject && <p className="text-xs text-muted-foreground">{n.subject}</p>}
                          </div>
                          {linkedNotes.includes(n.id) && <Badge variant="secondary">Linked</Badge>}
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </Command>
              </DialogContent>
            </Dialog>
            <Button variant="outline" size="icon" onClick={() => handleSave()} disabled={isSaving}>
              <Save className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" onClick={handleExport}>
              <Download className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <Input
            value={note.subject || ""}
            onChange={(e) => handleChange("subject", e.target.value)}
            className="w-48 text-sm"
            placeholder="Subject/Folder"
          />
          {isSaving && <span className="text-xs text-muted-foreground">Saving...</span>}
        </div>

        {/* Attachments */}
        {attachments.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap mt-3">
            <span className="text-xs text-muted-foreground">Attachments:</span>
            {attachments.map((att, idx) => (
              <Badge key={idx} variant="secondary" className="gap-1.5">
                {att.type === "image" ? <ImageIcon className="h-3 w-3" /> : <FileIcon className="h-3 w-3" />}
                <span className="max-w-[150px] truncate">{att.name}</span>
                <button
                  onClick={() => removeAttachment(idx)}
                  className="hover:text-destructive ml-1"
                  type="button"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}

        {/* Linked Notes */}
        {linkedNotes.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap mt-2">
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <LinkIcon className="h-3 w-3" />
              Linked:
            </span>
            {linkedNotes.map((noteId) => {
              const linkedNote = getLinkedNoteDetails(noteId)
              return linkedNote ? (
                <Badge key={noteId} variant="outline" className="gap-1.5">
                  <ExternalLink className="h-3 w-3" />
                  <span className="max-w-[150px] truncate">{linkedNote.title}</span>
                  <button
                    onClick={() => removeLinkedNote(noteId)}
                    className="hover:text-destructive ml-1"
                    type="button"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ) : null
            })}
          </div>
        )}
      </div>

      {/* Editor */}
      <div className="flex-1 overflow-y-auto p-6">
        <Textarea
          value={note.content || ""}
          onChange={(e) => handleChange("content", e.target.value)}
          className="min-h-[500px] text-base leading-relaxed border-none shadow-none focus-visible:ring-0 resize-none"
          placeholder="Start typing your notes..."
        />
      </div>

      {/* Attachment Viewer */}
      {attachments.length > 0 && (
        <div className="border-t border-border p-4">
          <h4 className="text-sm font-medium mb-3">Attachments ({attachments.length})</h4>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {attachments.map((att, idx) => (
              <div key={idx} className="relative group rounded-lg border overflow-hidden">
                {att.type === "image" ? (
                  <img src={att.url} alt={att.name} className="w-full h-32 object-cover" />
                ) : (
                  <div className="w-full h-32 bg-muted flex flex-col items-center justify-center">
                    <FileIcon className="h-8 w-8 text-muted-foreground mb-2" />
                    <p className="text-xs text-muted-foreground px-2 text-center truncate w-full">{att.name}</p>
                  </div>
                )}
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => window.open(att.url, "_blank")}
                  >
                    View
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => removeAttachment(idx)}
                  >
                    Remove
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tag Cloud */}
      {autoTags.length > 0 && (
        <div className="border-t border-border p-4">
          <div className="flex items-center gap-2 flex-wrap">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Suggested tags:</span>
            {autoTags.map((tag) => (
              <span key={tag} className="px-2 py-1 text-xs bg-primary/10 text-primary rounded-full">
                #{tag}
              </span>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  )
}
